import { getDb } from "@/lib/db";
import { publicPlan } from "@/server/public-plan";
export async function BusinessSegments() {
  const db = getDb(); const now = new Date();
  const spaces = await db.workspace.findMany({ where: { excludeFromMetrics: false }, include: { subscription: true, members: { where: { role: "OWNER" }, select: { user: { select: { emailVerified: true, lastSeenAt: true, createdAt: true } } } }, billingAgreements: { where: { status: { not: "cancelled" } }, orderBy: { createdAt: "desc" }, take: 1 } } });
  const counts = { verify: 0, onboarding: 0, trial: 0, pending: 0, inactive: 0, canceled: 0 };
  for (const w of spaces) {
    const u = w.members[0]?.user; if (!u) continue;
    const v = publicPlan(w.subscription, true, now, { agreement: w.billingAgreements[0] });
    if (!u.emailVerified) counts.verify++;
    if (!w.onboardedAt) counts.onboarding++;
    if (v.access === "trial") counts.trial++;
    if (v.billing === "pending") counts.pending++;
    if ((u.lastSeenAt ?? u.createdAt).getTime() < now.getTime() - 30 * 864e5) counts.inactive++;
    if (v.billing === "canceled") counts.canceled++;
  }
  return <div className="card"><div className="chead"><h3>Seguimiento del recorrido</h3><span className="sub">Espacios titulares · excluye cuentas internas</span></div><div className="tw" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table><thead><tr><th>Situación</th><th>Casos</th><th>Seguimiento permitido</th></tr></thead><tbody>{[["Correo sin confirmar", counts.verify, "Verificación solicitada por la persona"], ["Bienvenida pendiente", counts.onboarding, "Ayuda dentro de la app"], ["Período gratuito vigente", counts.trial, "Aviso factual de vencimiento, sin promoción"], ["Compra pendiente", counts.pending, "Consulta y gestión del intento; sin campañas de recuperación"], ["Sin actividad en 30 días", counts.inactive, "Análisis interno; sin correo automático"], ["Renovación desactivada", counts.canceled, "Confirmación del cambio real; no implica pérdida inmediata"]].map(([label, n, detail]) => <tr key={label}><td>{label}</td><td>{n}</td><td>{detail}</td></tr>)}</tbody></table></div></div>;
}
export async function TransactionalMailStatus() {
  const db = getDb(); const [pending, failed, sent, suppressed] = await Promise.all([db.emailOutbox.count({ where: { sentAt: null } }), db.emailOutbox.count({ where: { sentAt: null, lastError: { not: null } } }), db.emailOutbox.count({ where: { sentAt: { not: null }, lastError: null } }), db.emailOutbox.count({ where: { lastError: "suppressed-state-changed" } })]);
  return <div className="card"><h3>Correos de servicio</h3><p className="sub">{sent} aceptados por el proveedor · {pending} pendientes · {failed} con reintento · {suppressed} omitidos por cambio de estado. Aceptado por el proveedor no garantiza entrega en la bandeja del destinatario.</p><p className="sub">Bienvenida, verificación, recuperación, seguridad, pagos y respuestas de soporte. Los avisos del fin del período gratuito se deduplican y se revisan otra vez antes del envío. No hay campañas comerciales ni correos de recuperación de compras abandonadas.</p></div>;
}
