import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { insights } from "@/server/insights";
import { todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";

export const metadata: Metadata = { title: "Alertas y consejos" };
const LABEL = { urgent: ["Urgente", "r"], warn: ["Atención", "a"], info: ["Consejo", "b"], good: ["Bien", "g"] } as const;

export default async function Alerts() {
  const { workspace } = await requireWorkspace();
  const list = await insights(getDb(), workspace.id, workspace.baseCurrency, todayIn(workspace.timezone));
  return (
    <>
      <PageHead crumb="Análisis" title="Alertas y consejos" desc="Salen de tus propios datos y se actualizan cada vez que cargás algo." />
      {[
        { title: "Requiere acción", items: list.filter((i) => i.level === "urgent") },
        { title: "Para revisar", items: list.filter((i) => i.level === "warn") },
        { title: "Información y consejos", items: list.filter((i) => i.level === "info" || i.level === "good") },
      ].filter((group) => group.items.length).map((group) => <section className="card" key={group.title}><div className="chead"><h2 style={{ fontSize: 18 }}>{group.title}</h2><span className="pill">{group.items.length}</span></div><div className="list">{group.items.map((i, k) => <div className="li" key={k} style={{ flexWrap: "wrap", gap: 12 }}><span className={`pill ${LABEL[i.level][1]}`}>{LABEL[i.level][0]}</span><div className="grow"><div className="t" style={{ whiteSpace: "normal" }}>{i.title}</div>{i.detail && <div className="s">{i.detail}</div>}</div><Link className="btn sm" href={i.href}>Revisar</Link></div>)}</div></section>)}
      {!list.length && <div className="card empty">No hay alertas con los datos cargados. Revisá que estén todos tus compromisos.</div>}
    </>
  );
}
