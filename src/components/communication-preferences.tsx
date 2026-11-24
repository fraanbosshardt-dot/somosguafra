import { getDb } from "@/lib/db";
import { ActionForm, Submit } from "./forms";
import { saveCommunicationPreferencesAction } from "@/app/actions/communications";
export async function CommunicationPreferences({userId}: {userId:string}) {
  const p = await getDb().communicationPreference.findUnique({where:{userId}});
  return <section className="card"><div className="chead"><div><h3>Correos opcionales</h3><p className="sub">Elegís qué recibir. Podés cambiarlo o darte de baja en cualquier momento.</p></div></div>
    <ActionForm action={saveCommunicationPreferencesAction} className="communication-form">
      <label className="simtg"><input type="checkbox" name="tips" defaultChecked={p?.tips ?? false} /><span>Consejos para usar somosguafra y ayuda para completar mi configuración</span></label>
      <label className="simtg"><input type="checkbox" name="news" defaultChecked={p?.news ?? false} /><span>Novedades del producto</span></label>
      <label className="simtg"><input type="checkbox" name="offers" defaultChecked={p?.offers ?? false} /><span>Ofertas y ayuda para retomar una contratación</span></label>
      <p className="sub">Al guardar autorizás únicamente las opciones marcadas. No incluimos saldos ni movimientos en estos correos. Verificación, seguridad, pagos y respuestas de soporte son avisos de servicio independientes.</p>
      <div><Submit>Guardar preferencias de correo</Submit></div>
    </ActionForm>
  </section>;
}
