import Link from "next/link";
import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { isoDate, todayIn } from "@/lib/dates";
import { CargarForm } from "./form";

export const metadata: Metadata = { title: "Cargar un movimiento" };

export default async function Cargar({ searchParams }: { searchParams: Promise<{ tipo?: string; estado?: string }> }) {
  const { workspace } = await requireWorkspace();
  const { tipo, estado } = await searchParams;
  const db = getDb();
  const [accounts, categories, recent] = await Promise.all([
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { not: "CREDIT_CARD" } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, currency: true } }),
    db.category.findMany({ where: { workspaceId: workspace.id, archived: false, parentId: null }, orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    db.transaction.findMany({ where: { workspaceId: workspace.id, type: { in: ["INCOME", "EXPENSE"] }, reversalOfId: null, categoryId: { not: null } }, orderBy: { createdAt: "desc" }, take: 200, select: { categoryId: true, accountId: true } }),
  ]);
  if (!accounts.length) {
    return (
      <main className="mv-main">
        <section className="mv-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <h1 className="mv-h2">Primero carga una cuenta</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontWeight: 600 }}>Para anotar un gasto necesitamos saber de dónde sale el dinero.</p>
          <Link className="mv-btn pri" href="/movil/explorar/cuentas?nueva=1" style={{ flex: "none" }}>+ Agregar una cuenta</Link>
        </section>
      </main>
    );
  }
  // Las categorías que más usas van primero.
  const uses = new Map<string, number>();
  for (const t of recent) uses.set(t.categoryId!, (uses.get(t.categoryId!) ?? 0) + 1);
  const sorted = [...categories].sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0));
  const kind = tipo === "ingreso" ? "INCOME" : tipo === "transferencia" ? "TRANSFER" : "EXPENSE";
  return (
    <CargarForm
      initialKind={kind}
      accounts={accounts}
      categories={sorted.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      lastAccount={recent[0]?.accountId ?? accounts[0].id}
      today={isoDate(todayIn(workspace.timezone))}
      idem={randomUUID()}
      pendingMode={estado === "pendiente"}
    />
  );
}
