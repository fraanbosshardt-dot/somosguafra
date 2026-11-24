import { unsubscribeIdentity } from "@/lib/communication-preferences";
import { unsubscribeOptionalEmail } from "@/server/communication-preferences";
import { getDb } from "@/lib/db";
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = unsubscribeIdentity(token);
  if (!userId) return new Response("Enlace inválido",{status:400});
  await unsubscribeOptionalEmail(getDb(),userId);
  return new Response("Listo. Dejaste de recibir correos opcionales. Los avisos de servicio se conservan.",{headers:{"cache-control":"no-store","referrer-policy":"no-referrer","content-type":"text/plain; charset=utf-8"}});
}
