import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";

export type ProviderPayment = {
  id: number | string; status: string; transaction_amount: number; transaction_amount_refunded?: number;
  currency_id: string; date_approved?: string; date_last_updated?: string;
  transaction_details?: { net_received_amount?: number | string | null };
  fee_details?: { type?: string; amount?: number | string; fee_payer?: string }[];
  money_release_date?: string; money_release_status?: string;
};
const money = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  try { const n = new Decimal(String(v)); return n.isFinite() ? n.toFixed(2) : null; } catch { return null; }
};
export function paymentFinancialFields(payment: ProviderPayment | null) {
  if (!payment) return {};
  const fee = payment.fee_details;
  const release = payment.money_release_date && Number.isFinite(Date.parse(payment.money_release_date)) ? new Date(payment.money_release_date) : null;
  return {
    netAmount: money(payment.transaction_details?.net_received_amount) ?? undefined,
    feeAmount: fee && fee.every(f => money(f.amount) !== null) ? fee.reduce((t, f) => t.plus(String(f.amount)), new Decimal(0)).toFixed(2) : undefined,
    feeDetails: fee as Prisma.InputJsonValue | undefined,
    releaseAt: release ?? undefined, releaseStatus: payment.money_release_status ?? undefined,
    financialSyncedAt: new Date(),
  };
}

// El neto es un dato del proveedor, no bruto menos una tasa universal.
export async function recordPaymentEvents(tx: Prisma.TransactionClient, invoice: { id: string; status: string; paidAt: Date | null; amount: { toString(): string }; refundedAmount: { toString(): string }; currency: string; providerUpdatedAt: Date | null }, now = new Date()) {
  const gross = new Decimal(invoice.amount.toString());
  if (invoice.paidAt && ["approved", "refunded", "charged_back"].includes(invoice.status)) await tx.paymentEvent.upsert({ where: { key: `payment/${invoice.id}/gross` }, update: {}, create: { invoiceId: invoice.id, key: `payment/${invoice.id}/gross`, kind: "gross", amount: gross.toFixed(2), currency: invoice.currency, occurredAt: invoice.paidAt } });
  const events = await tx.paymentEvent.findMany({ where: { invoiceId: invoice.id, kind: { in: ["refund", "chargeback", "recovery"] } }, select: { amount: true, kind: true } });
  const recorded = events.reduce((t, e) => e.kind === "recovery" ? t.minus(e.amount.toString()) : t.plus(e.amount.toString()), new Decimal(0));
  const reversed = invoice.status === "charged_back" || invoice.status === "refunded" ? gross : new Decimal(invoice.refundedAmount.toString());
  if (reversed.gt(recorded) && invoice.paidAt) await tx.paymentEvent.upsert({ where: { key: `payment/${invoice.id}/reversed/${reversed.toFixed(2)}/${invoice.providerUpdatedAt?.getTime() ?? "unversioned"}` }, update: {}, create: { invoiceId: invoice.id, key: `payment/${invoice.id}/reversed/${reversed.toFixed(2)}/${invoice.providerUpdatedAt?.getTime() ?? "unversioned"}`, kind: invoice.status === "charged_back" ? "chargeback" : "refund", amount: reversed.minus(recorded).toFixed(2), currency: invoice.currency, occurredAt: invoice.providerUpdatedAt ?? now, estimatedDate: !invoice.providerUpdatedAt } });
  if (reversed.lt(recorded) && invoice.paidAt) await tx.paymentEvent.upsert({ where: { key: `payment/${invoice.id}/recovery/${reversed.toFixed(2)}/${invoice.providerUpdatedAt?.getTime() ?? "unversioned"}` }, update: {}, create: { invoiceId: invoice.id, key: `payment/${invoice.id}/recovery/${reversed.toFixed(2)}/${invoice.providerUpdatedAt?.getTime() ?? "unversioned"}`, kind: "recovery", amount: recorded.minus(reversed).toFixed(2), currency: invoice.currency, occurredAt: invoice.providerUpdatedAt ?? now, estimatedDate: !invoice.providerUpdatedAt } });

}
