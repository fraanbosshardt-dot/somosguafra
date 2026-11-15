import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ session: null as any, agreement: vi.fn(), payment: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => fixture.session }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ billingAgreement: { findFirst: fixture.agreement }, invoice: { findFirst: fixture.payment } }) }));
import { GET } from "@/app/api/mi-plan/route";

const end = () => new Date(Date.now() + 7 * 864e5);
beforeEach(() => {
  vi.clearAllMocks(); fixture.agreement.mockResolvedValue(null); fixture.payment.mockResolvedValue(null);
  fixture.session = { twoFactorVerified: true, user: { totpEnabledAt: null, activeWorkspaceId: "selected", memberships: [
    { role: "OWNER", workspaceId: "selected", workspace: { timezone: "America/Argentina/Buenos_Aires", subscription: { plan: "PRO", status: "ACTIVE", provider: "manual", trialEndsAt: end(), currentPeriodEnd: null } } },
  ] } };
});

it.each(["none", "second-factor"])("no subscription metadata is exposed without a complete session: %s", async (mode) => {
  if (mode === "none") fixture.session = null;
  else { fixture.session.user.totpEnabledAt = new Date(); fixture.session.twoFactorVerified = false; }
  const response = await GET();
  expect(await response.json()).toEqual({ logged: false });
  expect(fixture.agreement).not.toHaveBeenCalled();
});

it("the landing receives the same trial classification and purchase options as the app", async () => {
  const response = await GET(); const result = await response.json();
  expect(result).toMatchObject({ logged: true, access: "trial", billing: "none", canSubscribe: true, owner: true });
  expect(result.freeUntil).toBe(result.purchaseStartsAt);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(fixture.agreement.mock.calls[0][0].where.workspaceId).toBe("selected");
  expect(fixture.payment.mock.calls[0][0].where.workspaceId).toBe("selected");
});

it("a subscribed trial remains free access with a scheduled contract instead of another purchase", async () => {
  const subscription = fixture.session.user.memberships[0].workspace.subscription;
  Object.assign(subscription, { provider: "mercadopago", providerRef: "contract", billingCycle: "monthly", currentPeriodEnd: subscription.trialEndsAt, nextPaymentAt: subscription.trialEndsAt });
  fixture.agreement.mockResolvedValue({ status: "authorized", cycle: "monthly", providerRef: "contract", startsAt: subscription.trialEndsAt, amount: 7499, currency: "ARS" });
  expect(await (await GET()).json()).toMatchObject({ access: "trial", billing: "scheduled", canSubscribe: false, canUpgradeAnnual: true, recurringAmount: "7499" });
});

it("an unresolved checkout disables both new purchases and upgrades", async () => {
  fixture.agreement.mockResolvedValue({ status: "uncertain", cycle: "yearly", providerRef: null, amount: 74990 });
  expect(await (await GET()).json()).toMatchObject({ access: "trial", billing: "pending", canSubscribe: false, canUpgradeAnnual: false, canResumeCheckout: false });
});

it("shared users receive no billing management permissions", async () => {
  fixture.session.user.memberships[0].role = "VIEWER";
  expect(await (await GET()).json()).toMatchObject({ owner: false, canSubscribe: false, canUpgradeAnnual: false, canResumeCheckout: false, canCancel: false });
});
