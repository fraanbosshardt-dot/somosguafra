import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: null as any, values: new Map<string, string>(), purchase: vi.fn(), config: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/server/billing", () => ({ billingConfig: state.config }));
vi.mock("@/server/landing-purchase", () => ({ landingPurchase: state.purchase, PLAN_PAGE: "/app/configuracion?tab=plan" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => state.values.has(key) ? { value: state.values.get(key) } : undefined, set: (key: string, value: string) => state.values.set(key, value), delete: (key: string) => state.values.delete(key) }) }));
vi.mock("next/navigation", () => ({ redirect: (target: string) => { throw Error(`REDIRECT:${target}`); } }));
import { landingCheckoutAction, continueLandingCheckoutAction } from "@/app/actions/purchase";
import { PURCHASE_COOKIE, readPurchaseIntent } from "@/server/purchase-intent";
beforeEach(() => {
  vi.clearAllMocks(); state.values.clear(); state.session = null;
  state.config.mockResolvedValue({ enabled: true, monthly: 7499, yearly: 74990 });
  state.purchase.mockResolvedValue("https://www.mercadopago.com.ar/fake-checkout");
  vi.stubEnv("AUTH_SECRET", "synthetic-purchase-cookie-secret-minimum-32");
});
afterEach(() => vi.unstubAllEnvs());
const fields = () => { const fd = new FormData(); fd.set("cycle", "yearly"); fd.set("expectedAmount", "74990"); return fd; };
const session = () => ({ userId: "fixture", twoFactorVerified: true, user: { emailVerified: new Date(), totpEnabledAt: null } });
it("anonymous selection persists the annual plan and continues automatically after authentication", async () => {
  await expect(landingCheckoutAction(fields())).rejects.toThrow("REDIRECT:/registro?pro=1");
  expect(readPurchaseIntent(state.values.get(PURCHASE_COOKIE))).toMatchObject({ cycle: "yearly", amount: 74990 });
  expect(state.values.get("somosguafra_after")).toBe("/suscribirme?ciclo=anual");
  expect(state.purchase).not.toHaveBeenCalled();
  state.session = session();
  await expect(continueLandingCheckoutAction()).rejects.toThrow("REDIRECT:https://www.mercadopago");
  expect(state.purchase).toHaveBeenCalledTimes(1);
  expect(state.values.has(PURCHASE_COOKIE)).toBe(false);
});
it("a complete session goes directly to the checkout without the app summary", async () => {
  state.session = session();
  await expect(landingCheckoutAction(fields())).rejects.toThrow("REDIRECT:https://www.mercadopago");
  expect(state.purchase).toHaveBeenCalledTimes(1);
});
it.each(["email", "second-factor"])("mandatory %s verification preserves the chosen cycle and does not create a checkout", async mode => {
  state.session = session();
  if (mode === "email") state.session.user.emailVerified = null;
  else { state.session.user.totpEnabledAt = new Date(); state.session.twoFactorVerified = false; }
  await expect(landingCheckoutAction(fields())).rejects.toThrow(mode === "email" ? "REDIRECT:/confirmar-correo" : "REDIRECT:/verificar");
  expect(readPurchaseIntent(state.values.get(PURCHASE_COOKIE))?.cycle).toBe("yearly");
  expect(state.purchase).not.toHaveBeenCalled();
});
it("an expired or forged continuation cannot start a checkout", async () => {
  state.session = session(); state.values.set(PURCHASE_COOKIE, "forged");
  await expect(continueLandingCheckoutAction()).rejects.toThrow("REDIRECT:/#planes");
  expect(state.purchase).not.toHaveBeenCalled();
});
it("a modified price requires a new review without silently accepting the new amount", async () => {
  state.session = session(); const fd = fields(); fd.set("expectedAmount", "1");
  await expect(landingCheckoutAction(fd)).rejects.toThrow("REDIRECT:/suscribirme?ciclo=anual");
  expect(state.purchase).not.toHaveBeenCalled(); expect(state.values.has(PURCHASE_COOKIE)).toBe(false);
});
