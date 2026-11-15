import { expect, it } from "vitest";
import { publicPlan } from "@/server/public-plan";

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
  expect(publicPlan({ ...monthly, status }, true, now)).toMatchObject({ plan: "PRO", paid: false, canUpgradeAnnual: false });
});

it.each([null, now, new Date("2026-11-14T12:00:00Z")])("missing or expired coverage cannot offer a monthly upgrade", (currentPeriodEnd) => {
  expect(publicPlan({ ...monthly, currentPeriodEnd }, true, now)).toMatchObject({ plan: "FREE", canUpgradeAnnual: false });
});

it("free accounts do not have a paid billing cycle", () => {
  expect(publicPlan(null, true, now)).toMatchObject({ plan: "FREE", paid: false, billingCycle: null, canUpgradeAnnual: false });
});
