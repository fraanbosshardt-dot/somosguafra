// Plan actual de quien está con la sesión iniciada (para la sección de precios del sitio, que se sirve desde caché).
// Sin sesión responde { logged: false }. No devuelve datos personales.
import { getSession } from "@/lib/auth/session";
import { publicPlan } from "@/server/public-plan";
import { pickMembership } from "@/server/sharing";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession().catch(() => null);
  if (!s) return Response.json({ logged: false }, { headers: { "cache-control": "no-store" } });
  const m = pickMembership(s.user.memberships, s.user.activeWorkspaceId);
  const sub = m?.workspace.subscription ?? null;
  return Response.json({ logged: true, ...publicPlan(sub, m?.role === "OWNER") }, { headers: { "cache-control": "no-store" } });
}
