import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { publicPlan } from "@/server/public-plan";
import { PlanSubscriptionCard } from "@/components/plan-subscription-card";

// Render only. No action, provider, email or database can run in these fixtures.
vi.mock("@/app/actions/modules", () => ({ checkoutAction: vi.fn(), cancelPlanAction: vi.fn(), discardCheckoutAction: vi.fn(), startTrialAction: vi.fn() }));
vi.mock("@/components/billing-refresh", () => ({ BillingRefresh: () => null }));
const now = new Date("2026-11-15T12:00:00Z"), end = new Date("2026-11-27T12:00:00Z");
const trial = { plan: "PRO", provider: "manual", status: "ACTIVE", trialEndsAt: end, currentPeriodEnd: null };
const bill = { enabled: true, monthly: 7499, yearly: 74990, currency: "ARS" };
const render = (view: ReturnType<typeof publicPlan>) => renderToStaticMarkup(createElement(PlanSubscriptionCard, { view, bill, timeZone: "America/Argentina/Buenos_Aires" }));

it("an ACTIVE trial shows both billing choices and the deferred first charge", () => {
  const html = render(publicPlan(trial, true, now));
  expect(html).toContain('value="mensual"'); expect(html).toContain('value="anual"');
  expect(html).toContain("Elegir Pro");
  expect(html).toContain("El primer cobro se programa para el");
  expect(html).toContain("27 de noviembre de 2026");
});

it.each(["monthly", "yearly"])("an already scheduled %s contract keeps the trial and hides the second purchase form", (cycle) => {
  const sub = { ...trial, provider: "mercadopago", providerRef: "scheduled", billingCycle: cycle, currentPeriodEnd: end, nextPaymentAt: end };
  const view = publicPlan(sub, true, now, { agreement: { status: "authorized", cycle, providerRef: "scheduled", startsAt: end, amount: cycle === "yearly" ? 74990 : 7499 } });
  const html = render(view);
  expect(html).toContain("Estás probando Pro");
  expect(html).toContain(`Pro ${cycle === "yearly" ? "anual" : "mensual"} programado`);
  expect(html).not.toContain('type="radio"');
  expect(html).not.toContain("Elegir Pro");
  expect(html.includes("Pasar a anual")).toBe(cycle === "monthly");
});

it("a pending unpaid request permits both cycle choices with explicit confirmation on the purchase screen", () => {
  const html = render(publicPlan(trial, true, now, { agreement: { status: "pending", cycle: "yearly", providerRef: "pending", checkoutUrl: "saved", amount: 74990 } }));
  expect(html).toContain('action="/app/contratar"');
  expect(html).toContain('value="mensual"');
  expect(html).toContain('value="anual"');
  expect(html).toContain("confirmar el reemplazo");
  expect(html).not.toContain("Cancelar suscripción");
});

it("an uncertain request cannot be paid again or cancelled as if confirmed", () => {
  const html = render(publicPlan(trial, true, now, { agreement: { status: "uncertain", cycle: "monthly", providerRef: null } }));
  expect(html).toContain("Estamos verificando la solicitud");
  expect(html).not.toContain("Elegir Pro");
  expect(html).not.toContain("Cancelar suscripción");
});

it("shared members cannot purchase, upgrade or cancel", () => {
  const html = render(publicPlan(trial, false, now));
  expect(html).toContain("las administra el dueño del espacio");
  expect(html).not.toContain("<form");
});
