import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/session";
import { MODULES, USES } from "@/lib/modules";
import { COUNTRIES } from "@/lib/countries";
import { Onboarding } from "@/app/bienvenida/onboarding";

export const metadata: Metadata = { title: "Bienvenida" };

// La misma bienvenida que la web (ya pensada para el celular), con los colores de la app. Al terminar vuelve a /movil.
export default async function BienvenidaMovil() {
  const { user, workspace } = await requireWorkspace({ allowNotOnboarded: true });
  if (workspace.onboardedAt) redirect("/movil");
  const h = await headers();
  const geo = h.get("x-vercel-ip-country") ?? h.get("accept-language")?.match(/-([A-Z]{2})/)?.[1] ?? "AR";
  const detected = COUNTRIES.some((c) => c.code === geo);
  return (
    <div className="mv-theme">
      <Onboarding firstName={user.name.split(" ")[0]} uses={USES} modules={MODULES} guessCountry={detected ? geo : "AR"} detected={detected} />
    </div>
  );
}
