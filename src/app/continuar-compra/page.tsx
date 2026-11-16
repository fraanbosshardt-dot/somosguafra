import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/brand";
import { PURCHASE_COOKIE, readPurchaseIntent } from "@/server/purchase-intent";
import { ContinuePurchase } from "./continue";
export const dynamic = "force-dynamic";
export const metadata = { title: "Continuar contratación", robots: { index: false, follow: false } };
export default async function Continue() {
  if (!readPurchaseIntent((await cookies()).get(PURCHASE_COOKIE)?.value)) redirect("/#planes");
  return <AuthShell><h1>Continuamos con tu plan</h1><ContinuePurchase /></AuthShell>;
}
