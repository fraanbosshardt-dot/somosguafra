// Selection is navigation intent only. The server still decides whether to reuse
// an agreement or ask for confirmation before replacing an unfinished checkout.
export function planSelectionHref(canChoosePlan: boolean | undefined, cycle: "monthly" | "yearly") {
  return canChoosePlan ? `/app/configuracion?tab=plan&ciclo=${cycle === "yearly" ? "anual" : "mensual"}` : "/app/configuracion?tab=plan";
}
