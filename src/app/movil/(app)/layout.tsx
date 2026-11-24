import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { keepHouse } from "@/server/housekeeping";
import { systemSettings } from "@/server/settings";
import { roleFor } from "@/server/admin-team";
import { MvNav } from "./ui";
import "./movil.css";

// La app de Android abre esta sección en pantalla completa. Es privada: nunca se indexa.
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { default: "Somos Guafra", template: "%s · Somos Guafra" } };
export const viewport: Viewport = { themeColor: "#F6F7F5", viewportFit: "cover" };
export const dynamic = "force-dynamic";

const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });

export default async function MovilLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, modules } = await requireWorkspace();
  const db = getDb();
  const [sys, role] = await Promise.all([systemSettings(db), roleFor(db, user.email)]);
  if (sys.maintenance && !role) {
    return (
      <div className={`mv ${manrope.variable}`}>
        <main className="mv-main" style={{ minHeight: "100dvh", justifyContent: "center", textAlign: "center" }}>
          <h1 className="mv-h2" style={{ fontSize: 24 }}>Volvemos enseguida</h1>
          <p style={{ color: "var(--muted)", fontWeight: 600 }}>{sys.maintenanceMsg}</p>
        </main>
      </div>
    );
  }
  const today = todayIn(workspace.timezone);
  await keepHouse(db, workspace, !!modules.cereal, today);
  const overdue = await db.obligation.count({ where: { workspaceId: workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: today } } });
  return (
    <div className={`mv ${manrope.variable}`} data-hide="0">
      {children}
      <MvNav overdue={overdue} />
    </div>
  );
}
