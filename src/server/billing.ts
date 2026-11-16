import { reportError } from "@/lib/diagnostics";
// Autorizaciones y períodos pagados son estados distintos. Los eventos se concilian por espacio.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { publicPlan } from "./public-plan";
import { effectivePlan, paidUntil, planSettings } from "./plans";
import { queueBillingNotice, drainEmailOutbox } from "./billing-mail";

import { paymentFinancialFields, recordPaymentEvents, type ProviderPayment } from "./payment-finance";
import { BillingProviderHttpError, billingFailureMetadata } from "./billing-failure";

const API = "https://api.mercadopago.com";
type Tx = Prisma.TransactionClient;
type Cycle = "monthly" | "yearly";
type Preapproval = { back_url?: string; id: string; status: string; init_point?: string; external_reference?: string; last_modified?: string; next_payment_date?: string; auto_recurring?: { frequency: number; frequency_type?: string; start_date?: string; transaction_amount: number | string; currency_id: string } };
type AuthorizedPayment = { id: number | string; preapproval_id: string; transaction_amount: number | string; currency_id: string; status: string; date_created?: string; debit_date?: string; last_modified?: string; payment?: { id?: number | string; status?: string } };
const date = (v?: string | null) => v && Number.isFinite(Date.parse(v)) ? new Date(v) : null;
const latest = (...ds: (Date | null | undefined)[]) => ds.reduce<Date | null>((a, d) => d && (!a || d > a) ? d : a, null);
const identifier = (id: string) => { if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new UserError("Identificador de pago inválido."); return encodeURIComponent(id); };

export async function billingConfig(db: Db) {
  const token = process.env.MP_ACCESS_TOKEN;
  const ars = (await planSettings(db)).pricesArs;
  return { enabled: !!token && !!process.env.MP_WEBHOOK_SECRET && !!ars, token, currency: "ARS", monthly: ars?.monthly ?? 0, yearly: ars?.yearly ?? 0 };
}

class BillingBudgetExceeded extends Error {}
class PendingAuthorizationChanged extends UserError {}
const remaining = (deadline?: number) => {
  const ms = deadline === undefined ? 10_000 : Math.min(10_000, deadline - Date.now());
  if (ms <= 0) throw new BillingBudgetExceeded("Conciliación pausada por presupuesto de ejecución.");
  return ms;
};
async function mp<T>(path: string, init: RequestInit = {}, deadline?: number): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new UserError("Los cobros todavía no están activados.");
  const r = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(remaining(deadline)), redirect: "error", cache: "no-store" });
  if (!r.ok) throw new BillingProviderHttpError(r.status, path, init.method ?? "GET");
  return await r.json() as T;
}

// Todas las operaciones del mismo espacio se serializan, incluidos webhooks concurrentes.
async function locked<T>(db: Db, ws: string, run: (tx: Tx) => Promise<T>, deadline?: number) {
  const timeout = deadline === undefined ? 60_000 : Math.max(1, deadline - Date.now());
  if (deadline !== undefined) remaining(deadline);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${ws} FOR UPDATE`;
    return run(tx);
  }, { timeout: Math.min(60_000, timeout), maxWait: Math.min(10_000, timeout) });
}

export const splitRef = (ref: string | undefined) => { const [ws, coupon, checkout] = (ref ?? "").split("|"); return { ws: ws || null, coupon: coupon || null, checkout: checkout || null }; };

async function stopAgreement(id: string, pendingOnly = false, deadline?: number) {
  const p = await mp<Preapproval>(`/preapproval/${identifier(id)}`, {}, deadline);
  if (p.id !== id) throw new UserError("Suscripción inválida.");
  if (pendingOnly && p.status !== "pending" && p.status !== "cancelled") throw new PendingAuthorizationChanged("La solicitud ya fue autorizada mientras elegías el ciclo. No se canceló el contrato; actualizá Mi plan antes de continuar.");
  if (p.status !== "cancelled") {
    const stopped = await mp<Preapproval>(`/preapproval/${identifier(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }, deadline);
    if (stopped.id !== id || stopped.status !== "cancelled") throw new UserError("Mercado Pago todavía no confirmó la cancelación. Reintentá desde Tu plan.");
  }
}

function checkoutUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/(^|\.)mercadopago\.com(\.ar)?$/.test(url.hostname) || url.username || url.password) throw new UserError("El enlace de pago no es válido.");
  return url.href;
}

export async function startCheckout(db: Db, ws: string, payerEmail: string, cycle: Cycle, backUrl: string, discount?: { code: string; percentOff: number }, startDate?: Date | null, replacePendingId?: string, expectedAmount?: number) {
  const cfg = await billingConfig(db);
  if (!cfg.enabled) throw new UserError("Los cobros todavía no están activados.");
  await recoverPendingCheckout(db, ws, payerEmail);
  if (discount && (!Number.isFinite(discount.percentOff) || discount.percentOff <= 0 || discount.percentOff >= 100)) throw new UserError("El descuento no permite una suscripción recurrente. Consultá al equipo.");
  const amount = Math.round((cycle === "yearly" ? cfg.yearly : cfg.monthly) * (100 - (discount?.percentOff ?? 0))) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new UserError("El importe de la suscripción no es válido.");
  if (expectedAmount !== undefined && (!Number.isFinite(expectedAmount) || expectedAmount !== amount)) throw new UserError("El precio cambió desde que abriste la pantalla. Revisá el importe actualizado antes de continuar; no se creó un cobro.");
  const reservation = await locked(db, ws, async (tx) => {
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: ws } });
    if (workspace.billingDisabledAt) throw new UserError("La cuenta está en proceso de baja. No se pueden iniciar nuevos cobros.");
    if (await tx.invoice.count({ where: { workspaceId: ws, status: { in: ["pending", "in_process", "authorized"] } } })) throw new UserError("Hay un pago pendiente de confirmación. Revisá Mi plan; no se iniciará otra suscripción mientras siga pendiente.");
    if (await tx.billingAgreement.count({ where: { workspaceId: ws, cancelRequestedAt: { not: null } } })) throw new UserError("Estamos confirmando una cancelación anterior. No se iniciará otra suscripción hasta resolverla.");
    const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
    const offer = publicPlan(sub, true);
    if (!offer.canSubscribe && !(cycle === "yearly" && offer.canUpgradeAnnual)) throw new UserError("Ya tenés una suscripción o Pro permanente. Administrá tu plan para evitar otro cobro.");
    const pending = await tx.billingAgreement.findFirst({ where: { workspaceId: ws, status: { in: ["creating", "uncertain", "pending"] } }, orderBy: { createdAt: "desc" } });
    if (pending) {
      if (pending.status !== "pending") throw new UserError("Estamos verificando una solicitud anterior. No se iniciará otro cobro mientras esté pendiente.");
      const remote = pending.providerRef ? await mp<Preapproval>(`/preapproval/${identifier(pending.providerRef)}`) : null;
      if (!remote || remote.id !== pending.providerRef || remote.external_reference !== `${ws}|${pending.couponCode ?? ""}|${pending.id}`) throw new UserError("La referencia de la solicitud no coincide con este espacio.");
      if (remote.status === "pending" && (!remote.auto_recurring || Number(remote.auto_recurring.transaction_amount) !== Number(pending.amount) || remote.auto_recurring.currency_id !== pending.currency || remote.auto_recurring.frequency !== (pending.cycle === "yearly" ? 12 : 1))) throw new UserError("Mercado Pago informa otras condiciones para la solicitud. No se inició otra suscripción; contactá al equipo para revisarla.");
      if (remote?.status === "authorized") throw new UserError("Mercado Pago ya autorizó la solicitud. Esperá su confirmación antes de iniciar otra.");
      if (remote?.status === "pending" && pending.cycle === cycle && Number(pending.amount) === amount && pending.couponCode === (discount?.code ?? null) && pending.checkoutUrl) {
        checkoutUrl(pending.checkoutUrl);
        if (remote.back_url !== backUrl) await mp(`/preapproval/${identifier(pending.providerRef!)}`, { method: "PUT", body: JSON.stringify({ back_url: backUrl }) });
        return pending;
      }
      if (pending.id !== replacePendingId || !remote || remote.id !== pending.providerRef || remote.status !== "pending" || remote.external_reference !== `${ws}|${pending.couponCode ?? ""}|${pending.id}` || sub?.providerRef === pending.providerRef) throw new UserError("Ya hay una solicitud pendiente con otras condiciones. Revisá y confirmá su reemplazo antes de continuar; no se creó otra suscripción.");
      const payments = await mp<{ results: AuthorizedPayment[]; paging?: { total: number } }>(`/authorized_payments/search?preapproval_id=${identifier(pending.providerRef!)}`);
      if (!Array.isArray(payments.results) || payments.results.length || payments.paging?.total) throw new UserError("La solicitud ya tiene actividad de cobro. No se reemplazará automáticamente; revisá Mi plan.");
      // Guardar intención y confirmar el commit antes del PUT. La intención de
      // reemplazo sólo autoriza descartar pending, nunca un contrato autorizado.
      await tx.billingAgreement.update({ where: { id: pending.id }, data: { cancelRequestedAt: new Date(), cancelReason: "replacement" } });
      return { replacement: pending };
    }
    // Nunca adelantar un cobro por perder la prueba o el período ya pagado al cambiar de ciclo.
    const coveredUntil = latest(startDate, sub?.trialEndsAt, sub?.currentPeriodEnd);
    return tx.billingAgreement.create({ data: { workspaceId: ws, cycle, amount, couponCode: discount?.code, startsAt: coveredUntil && coveredUntil > new Date() ? coveredUntil : null } });
  });
  if ("replacement" in reservation) {
    const pending = reservation.replacement;
    try { await stopAgreement(pending.providerRef!, true); }
    catch (error) {
      if (error instanceof PendingAuthorizationChanged) await db.billingAgreement.update({ where: { id: pending.id }, data: { cancelRequestedAt: null, cancelReason: null } });
      throw error;
    }
    await applyPreapproval(db, pending.providerRef!);
    const after = await mp<{ results: AuthorizedPayment[]; paging?: { total: number } }>(`/authorized_payments/search?preapproval_id=${identifier(pending.providerRef!)}`);
    if (!Array.isArray(after.results) || after.results.length || after.paging?.total) { await reconcileWorkspaceBilling(db, ws); throw new UserError("Mercado Pago registró actividad durante el cambio. Actualizamos tu plan; no se inició otra suscripción."); }
    return startCheckout(db, ws, payerEmail, cycle, backUrl, discount, startDate, undefined, expectedAmount);
  }
  if (reservation.checkoutUrl) return checkoutUrl(reservation.checkoutUrl);
  try {
    const p = await mp<Preapproval>("/preapproval", { method: "POST", headers: { "X-Idempotency-Key": reservation.id }, body: JSON.stringify({
      reason: `somosguafra Pro · ${cycle === "yearly" ? "anual" : "mensual"}`,
      external_reference: `${ws}|${discount?.code ?? ""}|${reservation.id}`, payer_email: payerEmail, back_url: backUrl, status: "pending",
      auto_recurring: { frequency: cycle === "yearly" ? 12 : 1, frequency_type: "months", transaction_amount: amount, currency_id: "ARS", ...(reservation.startsAt ? { start_date: reservation.startsAt.toISOString() } : {}) },
    }) });
    if (!p.id || !p.init_point) throw new UserError("Mercado Pago no devolvió el enlace de pago.");
    identifier(p.id);
    const url = checkoutUrl(p.init_point);
    await db.billingAgreement.updateMany({ where: { id: reservation.id, status: { in: ["creating", "uncertain"] } }, data: { providerRef: p.id, checkoutUrl: url, status: "pending" } });
    // Un webhook puede haberse adelantado a la respuesta del POST: no volver de authorized a pending.
    await db.billingAgreement.update({ where: { id: reservation.id }, data: { providerRef: p.id, checkoutUrl: url } });
    return url;
  } catch (e) {
    // Ante un timeout puede haberse creado en MP: no crear otra autorización a ciegas.
    await db.billingAgreement.updateMany({ where: { id: reservation.id, status: "creating" }, data: { status: "uncertain" } });
    throw e;
  }
}

// Retomar conserva el importe y el cupón originales; no genera otro acuerdo.
export async function resumeCheckout(db: Db, ws: string, backUrl?: string) {
  if ((await db.workspace.findUniqueOrThrow({ where: { id: ws } })).billingDisabledAt) throw new UserError("La cuenta está en proceso de baja.");
  const pending = await db.billingAgreement.findFirst({ where: { workspaceId: ws, status: "pending", providerRef: { not: null } }, orderBy: { createdAt: "desc" } });
  if (!pending?.providerRef || !pending.checkoutUrl) throw new UserError("La solicitud todavía está en verificación. No inicies otro pago.");
  const remote = await mp<Preapproval>(`/preapproval/${identifier(pending.providerRef)}`);
  if (remote.id !== pending.providerRef || remote.external_reference !== `${ws}|${pending.couponCode ?? ""}|${pending.id}`) throw new UserError("La solicitud no coincide con este espacio.");
  if (remote.status !== "pending") {
    await applyPreapproval(db, pending.providerRef);
    return null;
  }
  if (!remote.auto_recurring || Number(remote.auto_recurring.transaction_amount) !== Number(pending.amount) || remote.auto_recurring.currency_id !== pending.currency || remote.auto_recurring.frequency !== (pending.cycle === "yearly" ? 12 : 1)) throw new UserError("Las condiciones de Mercado Pago cambiaron. Revisá la solicitud con el equipo antes de continuar.");
  if (backUrl && remote.back_url !== backUrl) await mp(`/preapproval/${identifier(pending.providerRef)}`, { method: "PUT", body: JSON.stringify({ back_url: backUrl }) });
  return checkoutUrl(pending.checkoutUrl);
}

// Descartar un checkout es una acción explícita distinta de cancelar una suscripción.
export async function discardPendingCheckout(db: Db, ws: string) {
  const pending = await locked(db, ws, async (tx) => {
    const candidate = await tx.billingAgreement.findFirst({ where: { workspaceId: ws, status: { in: ["creating", "uncertain", "pending"] } }, orderBy: { createdAt: "desc" } });
    if (!candidate) return null;
    if (candidate.status !== "pending" || !candidate.providerRef) throw new UserError("La solicitud todavía está en verificación. No se puede descartar hasta conocer su estado.");
    const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
    if (sub?.providerRef === candidate.providerRef) throw new UserError("La solicitud ya está vinculada a una suscripción. Revisá su estado desde Tu plan.");
    const remote = await mp<Preapproval>(`/preapproval/${identifier(candidate.providerRef)}`);
    if (remote.id !== candidate.providerRef || remote.external_reference !== `${ws}|${candidate.couponCode ?? ""}|${candidate.id}`) throw new UserError("La solicitud no coincide con este espacio.");
    if (remote.status !== "pending" && remote.status !== "cancelled") throw new UserError("Mercado Pago ya cambió el estado de la solicitud. Tocá Retomar para actualizarlo; no se canceló ninguna suscripción.");
    await tx.billingAgreement.update({ where: { id: candidate.id }, data: { cancelRequestedAt: new Date(), cancelReason: "replacement" } });
    return candidate;
  });
  if (!pending?.providerRef) return false;
  try { await stopAgreement(pending.providerRef, true); }
  catch (error) {
    if (error instanceof PendingAuthorizationChanged) await db.billingAgreement.update({ where: { id: pending.id }, data: { cancelRequestedAt: null, cancelReason: null } });
    throw error;
  }
  await applyPreapproval(db, pending.providerRef);
  return true;
}

async function recoverPendingCheckout(db: Db, ws: string, email: string, deadline?: number) {
  const pending = await db.billingAgreement.findFirst({ where: { workspaceId: ws, providerRef: null, status: { in: ["creating", "uncertain"] }, createdAt: { lt: new Date(Date.now() - 60_000) } } });
  if (!pending) return;
  let complete = false;
  const matches: Preapproval[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await mp<{ paging?: { total: number }; results: Preapproval[] }>(`/preapproval/search?payer_email=${encodeURIComponent(email)}&offset=${offset}&limit=100`, {}, deadline);
    if (!Array.isArray(page.results)) throw new UserError("No se pudo verificar la solicitud anterior.");
    for (const p of page.results) if (p.external_reference === `${ws}|${pending.couponCode ?? ""}|${pending.id}`) matches.push(p);
    if (page.results.length < 100 || (page.paging && offset + 100 >= page.paging.total)) { complete = true; break; }
  }
  if (!complete) throw new UserError("La verificación de la solicitud anterior necesita revisión del equipo.");
  if (matches.length > 1) {
    await db.auditLog.create({ data: { workspaceId: ws, action: "billing.duplicate_requires_review", entityId: pending.id } });
    throw new UserError("Encontramos más de un acuerdo asociado. El equipo debe revisarlos; no se canceló ninguno automáticamente.");
  }
  if (matches.length === 1) {
    const p = matches[0];
    await db.billingAgreement.updateMany({ where: { id: pending.id, providerRef: null }, data: { providerRef: p.id, status: "pending", checkoutUrl: p.init_point ? checkoutUrl(p.init_point) : null } });
    await applyPreapproval(db, p.id, deadline);
  } else if (pending.createdAt < new Date(Date.now() - 30 * 60_000)) {
    await db.billingAgreement.updateMany({ where: { id: pending.id, providerRef: null }, data: { status: "cancelled" } });
  }
}

async function recalculateAccess(tx: Tx, ws: string) {
  const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
  if (!sub || sub.provider !== "mercadopago") return;
  const invoices = await tx.invoice.findMany({ where: { workspaceId: ws, provider: "mercadopago", status: "approved", periodEnd: { not: null } }, select: { periodEnd: true } });
  const paidTo = latest(sub.legacyPaidUntil, ...invoices.map((p) => p.periodEnd));
  await tx.subscription.update({ where: { workspaceId: ws }, data: { currentPeriodEnd: latest(paidTo, sub.trialEndsAt), plan: "PRO" } });
}

export async function setManualPlan(db: Db, workspaceId: string, plan: "FREE" | "PRO") {
  await locked(db, workspaceId, async (tx) => {
    if (await tx.billingAgreement.count({ where: { workspaceId, status: { not: "cancelled" } } })) throw new UserError("Primero cancelá los cobros de Mercado Pago antes de cambiar a un plan manual.");
    await tx.subscription.upsert({ where: { workspaceId }, create: { workspaceId, plan, status: "ACTIVE", provider: "manual" }, update: { plan, status: "ACTIVE", provider: "manual", providerRef: null, trialEndsAt: null, currentPeriodEnd: null, legacyPaidUntil: null, nextPaymentAt: null, canceledAt: null } });
  });
}

// Se usa también antes del borrado administrativo: todos los acuerdos, no solo el último.
export async function cancelSubscription(db: Db, ws: string) {
  // La intención se confirma ANTES de tocar al proveedor. Si el proceso o el commit
  // posterior fallan, la conciliación puede terminar la misma baja, sin otro cobro.
  const refs = await locked(db, ws, async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
    const agreements = await tx.billingAgreement.findMany({ where: { workspaceId: ws, status: { not: "cancelled" } } });
    if (agreements.some((a) => !a.providerRef)) throw new UserError("Hay una autorización en verificación. Resolvela antes de dar de baja la cuenta.");
    const refs = new Set(agreements.map((a) => a.providerRef!));
    if (sub?.provider === "mercadopago" && sub.providerRef) refs.add(sub.providerRef);
    // Compatibilidad con contratos anteriores a BillingAgreement.
    for (const ref of refs) await tx.billingAgreement.upsert({ where: { providerRef: ref }, create: { workspaceId: ws, providerRef: ref, cycle: sub?.billingCycle ?? "monthly", amount: 0, cancelRequestedAt: new Date(), cancelReason: "user" }, update: { cancelRequestedAt: new Date(), cancelReason: "user" } });
    if (!refs.size && sub && sub.provider !== "mercadopago") await tx.subscription.update({ where: { workspaceId: ws }, data: { status: "CANCELED", canceledAt: new Date(), nextPaymentAt: null } });
    return [...refs];
  });
  for (const ref of refs) {
    await stopAgreement(ref);
    // La misma transición y dedupeKey se usan desde acción, webhook y cron.
    await applyPreapproval(db, ref);
  }
  await drainEmailOutbox(db).catch((e) => reportError("[email outbox]", e));
}

export function validSignature(signature: string | null, requestId: string | null, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !signature || !requestId || !/^[\w-]{1,100}$/.test(dataId)) return false;
  const parts = Object.fromEntries(signature.split(",").map((p) => p.trim().split("=")));
  if (!/^\d{10,13}$/.test(parts.ts ?? "") || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? "")) return false;
  const ts = Number(parts.ts) * (parts.ts.length === 10 ? 1000 : 1);
  if (Math.abs(Date.now() - ts) > 15 * 60_000) return false;
  const mine = createHmac("sha256", secret).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest("hex");
  return timingSafeEqual(Buffer.from(mine, "hex"), Buffer.from(parts.v1, "hex"));
}

async function applyPreapproval(db: Db, id: string, deadline?: number): Promise<void> {
  let p = await mp<Preapproval>(`/preapproval/${identifier(id)}`, {}, deadline);
  const ref = splitRef(p.external_reference);
  if (p.id !== id || !ref.ws || !["pending", "authorized", "paused", "cancelled"].includes(p.status)) throw new UserError("Estado de suscripción inválido.");
  const ws = ref.ws;
  const workspace = await db.workspace.findUnique({ where: { id: ws } });
  if (!workspace) return;
  const intent = await db.billingAgreement.findUnique({ where: { providerRef: id } });
  if (intent?.workspaceId === ws && intent.cancelRequestedAt && p.status !== "cancelled") {
    if (intent.cancelReason === "replacement" && p.status !== "pending") {
      await db.billingAgreement.update({ where: { id: intent.id }, data: { cancelRequestedAt: null, cancelReason: null } });
    } else {
      try { await stopAgreement(id, intent.cancelReason === "replacement", deadline); }
      catch (error) {
        if (error instanceof PendingAuthorizationChanged) await db.billingAgreement.update({ where: { id: intent.id }, data: { cancelRequestedAt: null, cancelReason: null } });
        throw error;
      }
      p = await mp<Preapproval>(`/preapproval/${identifier(id)}`, {}, deadline);
      if (p.status !== "cancelled") throw new UserError("La cancelación sigue en verificación.");
    }
  }
  // El archivo conserva sólo trazabilidad financiera. No recrear accesos ni enviar
  // avisos, y no mutar al proveedor sin una intención explícita pendiente.
  if (workspace.archivedAt) {
    if (!intent || intent.workspaceId !== ws || ref.checkout && (ref.checkout !== intent.id || (ref.coupon ?? "") !== (intent.couponCode ?? ""))) throw new UserError("La referencia no coincide con el registro financiero archivado.");
    await db.billingAgreement.updateMany({ where: { workspaceId: ws, providerRef: id }, data: { status: p.status, providerUpdatedAt: date(p.last_modified) ?? undefined, ...(p.status === "cancelled" ? { cancelRequestedAt: null, cancelReason: null } : {}) } });
    return;
  }
  const outcome = await locked(db, ws, async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
    let agreement = await tx.billingAgreement.findUnique({ where: { providerRef: id } });
    if (!agreement && ref.checkout) agreement = await tx.billingAgreement.findFirst({ where: { id: ref.checkout, workspaceId: ws, providerRef: null } });
    if (!agreement && sub?.providerRef === id) agreement = await tx.billingAgreement.create({ data: { workspaceId: ws, providerRef: id, cycle: sub.billingCycle ?? "monthly", amount: 0, status: "pending" } });
    if (!agreement || agreement.workspaceId !== ws) throw new UserError("Suscripción no reconocida.");
    if (ref.checkout && (ref.checkout !== agreement.id || (ref.coupon ?? "") !== (agreement.couponCode ?? ""))) throw new UserError("La referencia no coincide con la suscripción.");
    if ((await tx.workspace.findUniqueOrThrow({ where: { id: ws } })).billingDisabledAt && p.status !== "cancelled") { await stopAgreement(id, false, deadline); await tx.billingAgreement.update({ where: { id: agreement.id }, data: { status: "cancelled", providerRef: id } }); return; }
    const stamp = date(p.last_modified);
    if (stamp && agreement.providerUpdatedAt && stamp < agreement.providerUpdatedAt) return;
    if (agreement.status === "cancelled" && p.status !== "cancelled") { await stopAgreement(id, false, deadline); return; }
    const recurring = p.auto_recurring;
    if (p.status !== "cancelled" && Number(agreement.amount) > 0 && (!recurring || Number(recurring.transaction_amount) !== Number(agreement.amount) || recurring.currency_id !== agreement.currency || recurring.frequency !== (agreement.cycle === "yearly" ? 12 : 1) || (recurring.frequency_type && recurring.frequency_type !== "months"))) throw new UserError("El importe o ciclo no coincide con lo contratado.");
    if (p.status === "authorized" && agreement.couponCode && !agreement.couponCounted) {
      const coupon = await tx.coupon.findUnique({ where: { code: agreement.couponCode } });
      if (!coupon || !coupon.active || (coupon.maxUses != null && coupon.uses >= coupon.maxUses)) throw new UserError("El cupón ya no está disponible. El contrato requiere revisión del equipo.");
      const claimed = await tx.coupon.updateMany({ where: { id: coupon.id, uses: coupon.uses }, data: { uses: { increment: 1 } } });
      if (!claimed.count) throw new UserError("El cupón se está usando en otra solicitud. Reintentá en un momento.");
    }
    if (p.status === "authorized" && sub?.providerRef !== id) {
      const old = await tx.billingAgreement.findMany({ where: { workspaceId: ws, providerRef: { not: id }, status: { in: ["authorized", "paused"] } } });
      const oldRefs = new Set(old.map((a) => a.providerRef).filter((r): r is string => !!r));
      if (sub?.provider === "mercadopago" && sub.providerRef) {
        const currentAgreement = await tx.billingAgreement.findUnique({ where: { providerRef: sub.providerRef } });
        if (!currentAgreement || currentAgreement.status !== "cancelled") oldRefs.add(sub.providerRef);
      }
      if (oldRefs.size) {
        // Fase 1 durable; ningún PUT dentro de esta transacción. Un crash después
        // del PUT se recupera leyendo las intenciones y el estado del proveedor.
        for (const oldRef of oldRefs) {
          const current = await tx.billingAgreement.findUnique({ where: { providerRef: oldRef } });
          if (current?.cancelRequestedAt && current.cancelReason !== "switch") throw new UserError("La suscripción anterior tiene una cancelación en verificación.");
          await tx.billingAgreement.upsert({ where: { providerRef: oldRef }, create: { workspaceId: ws, providerRef: oldRef, cycle: sub?.billingCycle ?? "monthly", amount: 0, status: "authorized", cancelRequestedAt: new Date(), cancelReason: "switch" }, update: { cancelRequestedAt: new Date(), cancelReason: "switch" } });
        }
        await tx.billingAgreement.update({ where: { id: agreement.id }, data: { providerRef: id, status: "authorized", providerUpdatedAt: stamp ?? undefined, couponCounted: true, checkoutUrl: p.init_point ?? undefined } });
        return { switchRefs: [...oldRefs] };
      }
    }
    await tx.billingAgreement.update({ where: { id: agreement.id }, data: { providerRef: id, status: p.status, providerUpdatedAt: stamp ?? undefined, couponCounted: agreement.couponCounted || p.status === "authorized", checkoutUrl: p.init_point ?? undefined, ...(p.status === "cancelled" ? { cancelRequestedAt: null, cancelReason: null } : {}) } });
    // Una solicitud que nunca estuvo autorizada no es la baja de una suscripción.
    if (p.status === "cancelled" && sub?.providerRef !== id && !["authorized", "paused"].includes(agreement.status)) return;
    // La baja técnica del mensual durante un cambio no es una baja del cliente.
    if (p.status === "cancelled" && agreement.cancelReason === "switch") return;
    // Las notificaciones tardías de acuerdos cancelados no revocan una concesión manual.
    if (sub?.provider === "manual" && effectivePlan(sub) === "PRO" && p.status !== "authorized") return;
    // Un acuerdo viejo no puede reemplazar la suscripción actual al llegar tarde su webhook.
    if (sub?.providerRef && sub.providerRef !== id && p.status !== "authorized") return;
    if (p.status === "pending") return;
    const status = p.status === "cancelled" ? "CANCELED" : p.status === "authorized" ? "ACTIVE" : "PAST_DUE";
    await tx.subscription.upsert({ where: { workspaceId: ws }, create: { workspaceId: ws, plan: "PRO", status, provider: "mercadopago", providerRef: id, billingCycle: agreement.cycle, nextPaymentAt: date(p.next_payment_date) }, update: { plan: "PRO", status, provider: "mercadopago", providerRef: id, billingCycle: agreement.cycle, couponCode: agreement.couponCode, nextPaymentAt: p.status === "authorized" ? date(p.next_payment_date) : null, canceledAt: p.status === "cancelled" ? new Date() : null } });
    await recalculateAccess(tx, ws);
    await queueBillingNotice(tx, ws, `subscription-${id}-${p.status}`, p.status === "authorized" ? "Suscripción autorizada · somosguafra Pro" : p.status === "cancelled" ? "Suscripción cancelada · somosguafra Pro" : "Suscripción pausada · somosguafra Pro", p.status === "authorized" ? "Mercado Pago autorizó la suscripción. Pro se habilita durante la prueba vigente o el período cubierto por un pago aprobado. Los cobros siguen el ciclo contratado." : "Los nuevos cobros se detuvieron. Conservás el acceso durante el período ya cubierto, si corresponde.");
  }, deadline);
  if (outcome?.switchRefs) {
    try {
      for (const oldRef of outcome.switchRefs) {
        await stopAgreement(oldRef, false, deadline);
        await applyPreapproval(db, oldRef, deadline);
      }
    } catch (error) {
      // Compensación también durable: si detener el viejo falló, el nuevo no
      // debe quedar cobrando sin revisión. Si falla su PUT, cron retoma la baja.
      await db.billingAgreement.update({ where: { providerRef: id }, data: { cancelRequestedAt: new Date(), cancelReason: "switch-aborted" } });
      try {
        await stopAgreement(id, false, deadline); await applyPreapproval(db, id, deadline);
        // The annual replacement is now confirmed stopped. A failed switch must
        // not leave an instruction that cancels the still-active monthly later.
        await db.billingAgreement.updateMany({ where: { workspaceId: ws, providerRef: { in: outcome.switchRefs }, cancelReason: "switch" }, data: { cancelRequestedAt: null, cancelReason: null } });
        for (const oldRef of outcome.switchRefs) await applyPreapproval(db, oldRef, deadline);
      }
      catch { await db.auditLog.create({ data: { workspaceId: ws, action: "billing.switch_compensation_pending", entityId: id } }); }
      throw error;
    }
    await applyPreapproval(db, id, deadline);
  }
}

async function applyPayment(db: Db, id: string, deadline?: number) {
  const pay = await mp<AuthorizedPayment>(`/authorized_payments/${identifier(id)}`, {}, deadline);
  if (String(pay.id) !== id || !pay.preapproval_id) throw new UserError("Pago inválido.");
  // El cobro puede notificarse antes que la autorización. Conciliarla primero.
  await applyPreapproval(db, pay.preapproval_id, deadline);
  let agreement = await db.billingAgreement.findUnique({ where: { providerRef: pay.preapproval_id } });
  if (!agreement) { await applyPreapproval(db, pay.preapproval_id, deadline); agreement = await db.billingAgreement.findUnique({ where: { providerRef: pay.preapproval_id } }); }
  if (!agreement) throw new UserError("No encontramos la suscripción del pago.");
  const ws = agreement.workspaceId;
  // El estado del pago real es la autoridad para reembolsos/contracargos; el resumen puede quedar atrasado.
  const paymentId = pay.payment?.id ? String(pay.payment.id) : null;
  const payment = paymentId ? await mp<ProviderPayment>(`/v1/payments/${identifier(paymentId)}`, {}, deadline) : null;
  if (payment && String(payment.id) !== paymentId) throw new UserError("Pago inválido.");
  let status = payment?.status ?? pay.payment?.status ?? pay.status;
  const amount = Number(pay.transaction_amount);
  if (!Number.isFinite(amount) || amount <= 0 || pay.currency_id !== agreement.currency || (Number(agreement.amount) > 0 && amount !== Number(agreement.amount)) || (payment && (Number(payment.transaction_amount) !== amount || payment.currency_id !== pay.currency_id))) throw new UserError("El pago no coincide con la suscripción.");
  const refunded = Number(payment?.transaction_amount_refunded ?? (status === "refunded" ? amount : 0));
  if (!Number.isFinite(refunded) || refunded < 0 || refunded > amount) throw new UserError("Importe de devolución inválido.");
  if (refunded === amount && status === "approved") status = "refunded";
  const rawDate = [pay.debit_date, payment?.date_approved, pay.date_created].find((value) => date(value)) ?? "";
  const start = date(rawDate);
  if (!start) throw new UserError("El pago no tiene fecha válida.");
  const offset = rawDate.match(/([+-])(\d{2}):(\d{2})$/);
  const offsetMinutes = offset ? (offset[1] === "+" ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3])) : 0;
  const stamp = date(payment?.date_last_updated) ?? date(pay.last_modified);
  await locked(db, ws, async (tx) => {
    const before = await tx.invoice.findUnique({ where: { providerRef: id } });
    if (before && before.workspaceId !== ws) throw new UserError("Pago de otro espacio.");
    if (stamp && before?.providerUpdatedAt && stamp < before.providerUpdatedAt) return;
    // Sin versión de proveedor, un estado final no puede volver a "approved" por un evento atrasado.
    if (!stamp && before && ["refunded", "charged_back", "cancelled"].includes(before.status) && status === "approved") return;
    const current = await tx.subscription.findUnique({ where: { workspaceId: ws } });
    const nominalEnd = paidUntil(start, agreement!.cycle, offsetMinutes);
    const providerEnd = current?.providerRef === pay.preapproval_id ? current.nextPaymentAt : null;
    const span = providerEnd ? (providerEnd.getTime() - start.getTime()) / 864e5 : 0;
    const validSpan = agreement!.cycle === "yearly" ? span >= 330 && span <= 400 : span >= 20 && span <= 40;
    // El próximo débito del proveedor define el límite si pertenece a este ciclo.
    // No usar la fecha de otro ciclo al reenviar una factura meses después.
    const fixed = before?.periodEnd && ["approved", "refunded", "charged_back", "cancelled"].includes(before.status);
    const end = fixed ? before!.periodEnd! : validSpan ? providerEnd! : nominalEnd;
    const paidAt = ["approved", "refunded", "charged_back"].includes(status) ? date(payment?.date_approved) ?? before?.paidAt ?? (status === "approved" ? start : null) : before?.paidAt ?? null;
    const invoice = await tx.invoice.upsert({ where: { providerRef: id }, create: { ...paymentFinancialFields(payment), workspaceId: ws, provider: "mercadopago", providerRef: id, agreementRef: pay.preapproval_id, paymentId, refundedAmount: refunded.toFixed(2), amount: amount.toFixed(2), currency: pay.currency_id, status, periodStart: start, periodEnd: end, paidAt, providerUpdatedAt: stamp }, update: { ...paymentFinancialFields(payment), status, refundedAmount: refunded.toFixed(2), agreementRef: pay.preapproval_id, paymentId, periodStart: start, periodEnd: end, providerUpdatedAt: stamp ?? undefined, paidAt } });
    await recordPaymentEvents(tx, invoice);
    if (["refunded", "charged_back", "cancelled"].includes(status)) {
      // Una devolución total revoca ese período, no otros pagos válidos.
      const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
      if (sub?.legacyPaidUntil && sub.legacyPaidUntil <= end && sub.legacyPaidUntil > start) await tx.subscription.update({ where: { workspaceId: ws }, data: { legacyPaidUntil: null } });
    }
    if (status === "approved" && current && current.provider !== "mercadopago" && publicPlan(current, true).canSubscribe) {
      await tx.subscription.update({ where: { workspaceId: ws }, data: { plan: "PRO", provider: "mercadopago", providerRef: pay.preapproval_id, billingCycle: agreement!.cycle, status: agreement!.status === "authorized" ? "ACTIVE" : agreement!.status === "cancelled" ? "CANCELED" : "PAST_DUE", nextPaymentAt: null, canceledAt: agreement!.status === "cancelled" ? new Date() : null } });
    }
    await recalculateAccess(tx, ws);
    if (["approved", "rejected", "refunded", "cancelled", "charged_back"].includes(status)) {
      if (status === "approved" && refunded > 0 && Number(before?.refundedAmount ?? 0) !== refunded) {
        await queueBillingNotice(tx, ws, `payment-${id}-partial-${Math.round(refunded * 100)}`, "Reembolso parcial · somosguafra Pro", `Mercado Pago registra una devolución parcial de ARS ${refunded.toFixed(2)} sobre este pago. El período de Pro se mantiene hasta su vencimiento original. La devolución no cancela las próximas renovaciones.`);
      }
      const label: Record<string, string> = { approved: "Pago aprobado", rejected: "Pago rechazado", refunded: "Pago reembolsado", cancelled: "Pago cancelado", charged_back: "Pago con contracargo" };
      const total = new Intl.NumberFormat("es-AR", { style: "currency", currency: pay.currency_id }).format(amount);
      const zone = (await tx.workspace.findUniqueOrThrow({ where: { id: ws }, select: { timezone: true } })).timezone;
      const untilLabel = new Intl.DateTimeFormat("es-AR", { timeZone: zone, dateStyle: "medium", timeStyle: "short" }).format(end);
      await queueBillingNotice(tx, ws, `payment-${id}-${status}`, `${label[status]} · somosguafra Pro`, `${label[status]} por ${total}. ${status === "approved" ? `El pago cubre el período hasta ${untilLabel} (${zone}).` : status === "rejected" ? "Revisá el medio de pago en Mercado Pago. No se extendió el período de acceso." : "El acceso se recalculó según los pagos que siguen vigentes. Esto no cancela por sí solo las próximas renovaciones; podés cancelarlas desde Tu plan."}`);
    }
  }, deadline);
}

export async function applyNotification(db: Db, type: string, id: string) {
  if (type === "subscription_preapproval") await applyPreapproval(db, id);
  else if (type === "subscription_authorized_payment") await applyPayment(db, id);
  else if (type === "payment") {
    const results = await mp<{ results: AuthorizedPayment[] }>(`/authorized_payments/search?payment_id=${identifier(id)}`);
    for (const pay of results.results ?? []) if (String(pay.payment?.id) === id) await applyPayment(db, String(pay.id));
  }
  await drainEmailOutbox(db).catch((e) => reportError("[email outbox]", e));
}

// Avance durable por pago. Repetir una posición después de un crash es seguro;
// avanzar antes del commit de la factura no lo sería. Al completar se reinicia el
// barrido para volver a detectar devoluciones sobre períodos históricos.
async function reconcileAgreement(db: Db, id: string, deadline: number) {
  try {
  await applyPreapproval(db, id, deadline);
  const agreement = await db.billingAgreement.findUnique({ where: { providerRef: id } });
  if (!agreement) return true;
  let offset = agreement.reconcileOffset ?? 0;
  while (offset < 10000) {
    // This endpoint rejects explicit limit values. Advance by committed records,
    // using its reported total or an empty page, never an assumed page size.
    const page = await mp<{ paging?: { total: number }; results: AuthorizedPayment[] }>(`/authorized_payments/search?preapproval_id=${identifier(id)}&offset=${offset}`, {}, deadline);
    if (!Array.isArray(page.results)) throw new UserError("No se pudieron consultar los pagos.");
    const total = page.paging?.total;
    if (total !== undefined && (!Number.isSafeInteger(total) || total < 0)) throw new UserError("El proveedor informó una paginación inválida.");
    if (!page.results.length && total !== undefined && offset < total) throw new UserError("El proveedor devolvió un historial incompleto. La conciliación queda pendiente.");
    for (const p of page.results) {
      remaining(deadline);
      await applyPayment(db, String(p.id), deadline);
      offset++;
      await db.billingAgreement.update({ where: { id: agreement.id }, data: { reconcileOffset: offset } });
    }
    if (!page.results.length || (total !== undefined && offset >= total)) {
      await db.billingAgreement.update({ where: { id: agreement.id }, data: { reconcileOffset: 0, lastReconciledAt: new Date() } });
      return true;
    }
  }
  throw new UserError("El historial de pagos necesita revisión del equipo.");
  } catch (error) {
    if (error instanceof BillingBudgetExceeded || Date.now() >= deadline) return false;
    throw error;
  }
}

// Conciliación del regreso de checkout: solo acuerdos del espacio validado, nunca crea cobros.
export async function reconcileWorkspaceBilling(db: Db, workspaceId: string) {
  if (!process.env.MP_ACCESS_TOKEN) return;
  const deadline = Date.now() + 45_000;
  const agreements = await db.billingAgreement.findMany({ where: { workspaceId, providerRef: { not: null } }, orderBy: { createdAt: "desc" }, take: 2 });
  for (const a of agreements) { if (Date.now() >= deadline) break; await reconcileAgreement(db, a.providerRef!, deadline); }
  await drainEmailOutbox(db).catch((e) => reportError("[email outbox]", e));
}

// Recupera eventos perdidos consultando el estado actual; nunca genera pagos.
export async function reconcileBilling(db: Db, limit = 30, timeBudgetMs = 60_000) {
  const deadline = Date.now() + timeBudgetMs;
  if (!process.env.MP_ACCESS_TOKEN) return 0;
  const unresolved = await db.billingAgreement.findMany({ where: { providerRef: null, status: { in: ["creating", "uncertain"] } }, orderBy: { updatedAt: "asc" }, take: 3 });
  for (const a of unresolved) {
    if (Date.now() >= deadline) break;
    try {
      const owner = await db.membership.findFirst({ where: { workspaceId: a.workspaceId, role: "OWNER" }, include: { user: { select: { email: true } } } });
      if (owner) await recoverPendingCheckout(db, a.workspaceId, owner.user.email, deadline);
    } catch (e) { reportError("[billing checkout recovery]", e); }
    finally { await db.billingAgreement.updateMany({ where: { id: a.id }, data: { updatedAt: new Date() } }); }
  }
  const [cancellations, current, history] = await Promise.all([
    db.billingAgreement.findMany({ where: { providerRef: { not: null }, cancelRequestedAt: { not: null } }, orderBy: { cancelRequestedAt: "asc" }, take: limit }),
    db.billingAgreement.findMany({ where: { providerRef: { not: null }, status: { notIn: ["cancelled", "superseded"] } }, orderBy: { updatedAt: "asc" }, take: limit }),
    db.billingAgreement.findMany({ where: { providerRef: { not: null }, status: { in: ["cancelled", "superseded"] } }, orderBy: { updatedAt: "asc" }, take: 2 }),
  ]);
  const agreements = [...new Map([...cancellations, ...current, ...history].map(a => [a.id, a])).values()];
  let n = 0;
  for (const a of agreements) {
    if (Date.now() >= deadline) break;
    try { if (await reconcileAgreement(db, a.providerRef!, deadline)) n++; }
    catch (e) { await db.auditLog.create({ data: { workspaceId: a.workspaceId, action: "billing.reconcile_failed", entityId: a.providerRef, meta: { error: String(e).slice(0, 300), ...billingFailureMetadata(e) } } }); }
    finally { await db.billingAgreement.updateMany({ where: { id: a.id }, data: { updatedAt: new Date() } }); }
  }
  return n;
}
