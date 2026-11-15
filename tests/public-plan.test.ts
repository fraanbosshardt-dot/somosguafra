import { expect, it } from "vitest";
import { publicPlan } from "@/server/public-plan";
import { effectivePlan } from "@/server/plans";

const now = new Date("2026-11-15T12:00:00Z");
const monthly = { plan: "PRO", status: "ACTIVE", provider: "mercadopago", providerRef: "monthly-agreement", billingCycle: "monthly", trialEndsAt: null, currentPeriodEnd: new Date("2026-12-01T12:00:00Z") };

it("offers the annual upgrade to the owner of an active monthly subscription", () => {
  expect(publicPlan(monthly, true, now)).toMatchObject({ plan: "PRO", paid: true, billingCycle: "monthly", canUpgradeAnnual: true });
});

it("does not offer another annual subscription to an annual payer", () => {
  expect(publicPlan({ ...monthly, billingCycle: "yearly" }, true, now)).toMatchObject({ billingCycle: "yearly", canUpgradeAnnual: false });
});

it("members cannot upgrade a subscription owned by someone else", () => {
  expect(publicPlan(monthly, false, now).canUpgradeAnnual).toBe(false);
});

it("manual Pro is not presented as a paid monthly subscription", () => {
  expect(publicPlan({ ...monthly, provider: "manual", providerRef: null }, true, now)).toMatchObject({ plan: "PRO", paid: false, billingCycle: null, canUpgradeAnnual: false });
});

it("trial accounts retain their trial offer instead of a monthly upgrade", () => {
  expect(publicPlan({ ...monthly, provider: "manual", providerRef: null, status: "TRIALING", trialEndsAt: monthly.currentPeriodEnd }, true, now)).toMatchObject({ plan: "PRO", trial: "2026-12-01", paid: false, canUpgradeAnnual: false });
});

it.each(["CANCELED", "PAST_DUE"])("%s coverage is preserved without offering an active monthly upgrade", (status) => {
  expect(publicPlan({ ...monthly, status }, true, now)).toMatchObject({ plan: "PRO", paid: true, canUpgradeAnnual: false });
});

it.each([null, now, new Date("2026-11-14T12:00:00Z")])("missing or expired coverage cannot offer a monthly upgrade", (currentPeriodEnd) => {
  expect(publicPlan({ ...monthly, currentPeriodEnd }, true, now)).toMatchObject({ plan: "FREE", canUpgradeAnnual: false });
});

it("free accounts do not have a paid billing cycle", () => {
  expect(publicPlan(null, true, now)).toMatchObject({ plan: "FREE", paid: false, billingCycle: null, canUpgradeAnnual: false });
});

const freeEnd = new Date("2026-11-27T12:00:00Z");
const trial = { ...monthly, provider: "manual", providerRef: null, status: "TRIALING", trialEndsAt: freeEnd, currentPeriodEnd: null };

it.each(["TRIALING", "ACTIVE"])("a current free period remains a trial with status %s and permits either cycle", (status) => {
  expect(publicPlan({ ...trial, status }, true, now)).toMatchObject({ access: "trial", billing: "none", canSubscribe: true, freeUntil: freeEnd.toISOString(), purchaseStartsAt: freeEnd.toISOString() });
});

it.each(["monthly", "yearly"])("authorization of %s keeps the remaining trial and blocks a second subscription", (cycle) => {
  const view = publicPlan({ ...monthly, billingCycle: cycle, trialEndsAt: freeEnd, currentPeriodEnd: freeEnd, nextPaymentAt: freeEnd }, true, now);
  expect(view).toMatchObject({ access: "trial", billing: "scheduled", billingCycle: cycle, canSubscribe: false, nextChargeAt: freeEnd.toISOString(), purchaseStartsAt: freeEnd.toISOString() });
  expect(view.canUpgradeAnnual).toBe(cycle === "monthly");
});

it("cancelling during the trial preserves the free days and allows a new scheduled choice", () => {
  expect(publicPlan({ ...trial, provider: "mercadopago", status: "CANCELED", providerRef: "cancelled", currentPeriodEnd: freeEnd }, true, now)).toMatchObject({ access: "trial", billing: "canceled", canSubscribe: true, purchaseStartsAt: freeEnd.toISOString() });
});

it.each(["creating", "uncertain", "pending"])("a %s checkout blocks another contract and annual change", (status) => {
  const agreement = { status, cycle: "yearly", providerRef: status === "pending" ? "pending-ref" : null, checkoutUrl: "saved-checkout", amount: 74990 };
  const view = publicPlan(trial, true, now, { agreement });
  expect(view).toMatchObject({ access: "trial", billing: "pending", pendingCycle: "yearly", pendingAmount: "74990", canSubscribe: false, canUpgradeAnnual: false });
  expect(view.canResumeCheckout).toBe(status === "pending");
  expect(view.canCancel).toBe(false);
  expect(view.canDiscardCheckout).toBe(status === "pending");
});

it("a pending annual change does not present its amount as the active monthly price", () => {
  const view = publicPlan(monthly, true, now, { agreement: { status: "pending", cycle: "yearly", providerRef: "next-annual", amount: 74990 } });
  expect(view).toMatchObject({ billingCycle: "monthly", pendingCycle: "yearly", pendingAmount: "74990", recurringAmount: null });
});

it("a rejected renewal preserves covered access and asks to review payment instead of buying again", () => {
  expect(publicPlan(monthly, true, now, { lastPaymentStatus: "rejected" })).toMatchObject({ access: "paid", billing: "past_due", canSubscribe: false, canUpgradeAnnual: false, paymentIssue: true });
});

it("resubscription after cancellation starts after the period already paid", () => {
  expect(publicPlan({ ...monthly, status: "CANCELED" }, true, now)).toMatchObject({ access: "paid", billing: "canceled", canSubscribe: true, purchaseStartsAt: monthly.currentPeriodEnd.toISOString() });
});

it.each(["TRIALING", "ACTIVE", "CANCELED"])("an expired free period does not become perpetual Pro with status %s", (status) => {
  const ended = { ...trial, status, trialEndsAt: new Date(now.getTime() - 1) };
  expect(effectivePlan(ended, now)).toBe("FREE");
  expect(publicPlan(ended, true, now)).toMatchObject({ access: "free", freeUntil: null, canSubscribe: true, canStartTrial: false });
});

it("the access boundary is exact and retains no extra trial day", () => {
  expect(publicPlan(trial, true, freeEnd)).toMatchObject({ plan: "FREE", access: "free", freeUntil: null, canSubscribe: true });
});

it("a perpetual manual grant neither expires nor offers another charge", () => {
  expect(publicPlan({ ...trial, status: "ACTIVE", trialEndsAt: null }, true, now)).toMatchObject({ access: "granted", billing: "none", canSubscribe: false, canUpgradeAnnual: false });
});

it("a payment covering beyond the old trial survives its expiration", () => {
  const subscribed = { ...monthly, trialEndsAt: freeEnd };
  expect(publicPlan(subscribed, true, now).access).toBe("trial");
  expect(publicPlan(subscribed, true, freeEnd)).toMatchObject({ access: "paid", canSubscribe: false });
});

it.each(["creating", "pending", "authorized"])("a guest cannot buy, resume, upgrade or cancel: %s", (status) => {
  const view = publicPlan(monthly, false, now, { agreement: { status, cycle: "monthly", providerRef: "agreement", checkoutUrl: "saved-checkout" } });
  expect(view.canSubscribe || view.canUpgradeAnnual || view.canResumeCheckout || view.canCancel).toBe(false);
});
