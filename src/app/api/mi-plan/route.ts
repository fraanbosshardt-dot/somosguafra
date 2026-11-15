// Plan actual de quien está con la sesión iniciada (para la sección de precios del sitio, que se sirve desde caché).
// Sin sesión responde { logged: false }. No devuelve datos personales.
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { publicPlan } from "@/server/public-plan";
import { pickMembership } from "@/server/sharing";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession().catch(() => null);
  if (!s || (s.user.totpEnabledAt && !s.twoFactorVerified)) return Response.json({ logged: false }, { headers: { "cache-control": "no-store" } });
  const m = pickMembership(s.user.memberships, s.user.activeWorkspaceId);
  const sub = m?.workspace.subscription ?? null;
  const [agreement, payment] = m ? await Promise.all([
    getDb().billingAgreement.findFirst({ where: { workspaceId: m.workspaceId, status: { not: "cancelled" } }, orderBy: { createdAt: "desc" } }),
    getDb().invoice.findFirst({ where: { workspaceId: m.workspaceId }, orderBy: [{ periodStart: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], select: { status: true } }),
  ]) : [null, null];
  return Response.json({ logged: true, ...publicPlan(sub, m?.role === "OWNER", new Date(), { agreement, lastPaymentStatus: payment?.status }), timeZone: m?.workspace.timezone ?? "America/Argentina/Buenos_Aires" }, { headers: { "cache-control": "no-store" } });
}
