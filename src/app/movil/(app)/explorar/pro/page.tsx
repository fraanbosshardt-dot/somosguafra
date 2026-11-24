import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { planFeatures, planSettings } from "@/server/plans";
import { MvBackHead } from "../../head";
import { MvIcon } from "../../ui";

export const metadata: Metadata = { title: "Pro" };

// Qué suma Pro. En la app de Android, Google Play exige cobrar con Google Play: el botón de compra llega con esa integración.
export default async function ProMovil() {
  const { plan } = await requireWorkspace();
  const features = planFeatures((await planSettings(getDb())).freeAlso);
  const pro = features.filter((f) => f.plan === "pro");
  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Tu plan" title="Somos Guafra Pro" />
      <section className="mv-card mv-procard" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <b style={{ fontSize: 22 }}>{plan === "PRO" ? "Ya tienes Pro" : "Más herramientas para planificar"}</b>
        <span style={{ fontSize: 14, color: "#CFE3D6", fontWeight: 600 }}>Simulador de escenarios, informes, flujo a 5 años, espacio compartido y más.</span>
      </section>
      <section className="mv-sec" style={{ gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Qué suma Pro</h2>
        <div className="mv-card-list mv-cas">
          {pro.map((f) => (
            <div key={f.name} className="mv-row">
              <span className="mv-date" style={{ background: "var(--mint)", color: "var(--brand)" }}><MvIcon name="check" stroke={2.6} /></span>
              <span className="grow t">{f.name}{f.beta ? " (beta)" : ""}</span>
            </div>
          ))}
        </div>
      </section>
      {plan !== "PRO" && (
        <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <b style={{ fontSize: 15 }}>Muy pronto desde Google Play</b>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>Vas a poder pasar a Pro con tu cuenta de Google Play, por mes o por año, y cancelarlo cuando quieras desde Google Play.</span>
        </section>
      )}
    </main>
  );
}
