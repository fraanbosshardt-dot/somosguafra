import { PageHead } from "./page";
import { Icon } from "./icons";
import { startTrialAction } from "@/app/actions/modules";
import { PRO_FEATURES } from "@/server/plans";
import { freeTrialAvailable } from "@/server/plans";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

// Para una función Pro en plan Gratis: una tarjeta chica que explica qué es y ofrece la prueba gratis.
export async function ProGate({ title, crumb, text }: { title: string; crumb: string; text: string; trialUsed?: boolean }) {
  const { workspace, membership } = await requireWorkspace();
  const canTrial = membership.role === "OWNER" && await freeTrialAvailable(getDb(), workspace.id);
  return (
    <>
      <PageHead crumb={crumb} title={title} guide={false} />
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="chead"><span className="pill b"><Icon name="lock" />Pro</span></div>
        <p style={{ fontSize: 15, margin: "0 0 14px", maxWidth: "56ch" }}>{text}</p>
        <div className="acts" style={{ alignItems: "center" }}>
          {canTrial && <form action={startTrialAction}><button className="btn pri" type="submit">Probar gratis 14 días</button></form>}
          <a className="btn" href="/app/configuracion?tab=plan">{canTrial ? "Ver planes" : "Ver mi plan"}</a>
        </div>
        <p className="sub" style={{ marginTop: 14 }}>Pro también suma: {PRO_FEATURES.filter((f) => !f.beta).slice(0, 4).map((f) => f.name.toLowerCase()).join(", ")}.</p>
      </div>
    </>
  );
}
