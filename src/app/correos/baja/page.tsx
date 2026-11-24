import { unsubscribeIdentity } from "@/lib/communication-preferences";
export const dynamic = "force-dynamic";
export const metadata = { title:"Preferencias de correo", robots:{index:false,follow:false}, referrer:"no-referrer" as const };
export default async function Unsubscribe({searchParams}:{searchParams:Promise<{token?:string}>}) {
  const token = (await searchParams).token ?? "";
  const valid = unsubscribeIdentity(token);
  return <main className="narrow" style={{padding:"48px 20px"}}><h1>Correos opcionales</h1>{valid ? <><p>Podés dejar de recibir consejos, novedades y ofertas. Los avisos de seguridad, pagos y soporte se conservan.</p><form action={`/api/comunicaciones/baja?token=${encodeURIComponent(token)}`} method="post"><button className="btn pri" type="submit">Dar de baja los correos opcionales</button></form></> : <p>El enlace no es válido. Podés cambiar tus preferencias desde Configuración.</p>}</main>;
}
