"use server";
import { redirect } from "next/navigation";
import { requireWorkspace, canUse } from "@/lib/auth/session";
import { todayIn } from "@/lib/dates";
import { simulationParams, sealSimulation } from "@/server/private-simulation";
import { getDb } from "@/lib/db";
import { UserError } from "@/server/ledger";
import type { FormState } from "@/components/forms";
import { reportError } from "@/lib/diagnostics";

export async function privateSimulationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace, plan } = await requireWorkspace();
  let url: string;
  try {
    const params = simulationParams(fd, todayIn(workspace.timezone));
    if (params.tab === "escenarios") {
      if (!await canUse(plan, "simulador")) throw new UserError("Los escenarios son parte de Pro.");
      if (params.sin && !await getDb().recurringRule.findFirst({ where: { id: params.sin, workspaceId: workspace.id, direction: "RECEIVABLE" }, select: { id: true } })) throw new UserError("Elegí un ingreso de este espacio.");
    }
    const q = new URLSearchParams({ ...(params.tab === "escenarios" ? { tab: "escenarios" } : {}), sim: sealSimulation(params, user.id, workspace.id) });
    url = `/app/simulador?${q}#resultado`;
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    reportError("[private simulation]", e);
    return { error: "No pudimos calcularlo. Volvé a intentar." };
  }
  redirect(url);
}
