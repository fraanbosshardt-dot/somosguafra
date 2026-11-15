import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { Icon } from "@/components/icons";
import { MODULES, PLAN_FEATURES } from "@/lib/modules";
import { formatMoney } from "@/lib/money";
import { PlanSubscriptionCard } from "@/components/plan-subscription-card";
import { publicPlan } from "@/server/public-plan";
import { billingConfig } from "@/server/billing";
import { fmtDate } from "@/lib/dates";
import { COUNTRIES, CURRENCIES } from "@/lib/countries";
import { PageHead, SettingsTabs } from "@/components/page";
import { InstallApp } from "@/components/pwa";
import { BigTextToggle } from "@/components/big-text";
import { ThemeChoice } from "@/components/theme";
import { ActionForm, OtpInput, Submit } from "@/components/forms";
import { deleteMyAccountAction, confirm2faAction, disable2faAction, revokeOtherSessionsAction, saveModulesAction, start2faAction, twoFactorQr, updateProfileAction } from "@/app/actions/app";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ShareLink } from "@/components/referral";
import { SharingTab } from "./sharing-tab";
import { PushToggle } from "@/components/push-toggle";
import { pushConfig } from "@/server/push";

export const metadata: Metadata = { title: "Configuración" };

const TABS = [["general", "General"], ["funciones", "Funciones"], ["compartir", "Compartir"], ["seguridad", "Seguridad"], ["plan", "Plan"], ["datos", "Tus datos"]] as const;

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; pago?: string; pagoerror?: string; prueba?: string; ciclo?: string; cancelado?: string; cupon?: string; soloduenio?: string; yatenes?: string; verificar?: string; solicituddescartada?: string }> }) {
  const { user, workspace, modules, plan, session, membership } = await requireWorkspace();
  const sp = await searchParams;
  const asked = sp.tab;
  const t = TABS.some(([k]) => k === asked) ? asked! : "general";
  const tabs = <SettingsTabs current={t} rules={modules.reglas} />;
  const now = new Intl.DateTimeFormat("es-AR", { timeZone: workspace.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date());

  const push = pushConfig();
  let body: React.ReactNode = null;
  if (t === "compartir") body = <SharingTab workspaceId={workspace.id} role={membership.role} plan={plan} userId={user.id} />;
  if (t === "general") {
    body = (
      <div className="card">
        <ActionForm action={updateProfileAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="frow"><label className="field">Nombre<input name="name" defaultValue={user.name} /></label><label className="field">Correo<input defaultValue={user.email} disabled /></label></div>
          <div className="frow">
            <label className="field">País<select name="country" defaultValue={workspace.country}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
            <label className="field">Moneda principal<select name="currency" defaultValue={workspace.baseCurrency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select></label>
          </div>
          <div className="field">Otras monedas que usás
            <div className="chips">{CURRENCIES.filter((c) => c.code !== workspace.baseCurrency).map((c) => (
              <label key={c.code} className="chipck"><input type="checkbox" name="extraCurrencies" value={c.code} defaultChecked={workspace.extraCurrencies.includes(c.code)} /><span>{c.code}</span></label>
            ))}</div>
          </div>
          <p className="sub">La zona horaria se ajusta sola según el país. Hora actual: {now}.</p>
          <div><Submit>Guardar</Submit></div>
        </ActionForm>
      </div>
    );
  }
  if (t === "funciones") {
    body = (
      <div className="card">
        <p className="sub" style={{ marginBottom: 8 }}>Activá solo lo que usás. Lo que apagues desaparece del menú; tus datos no se borran.</p>
        <ActionForm action={saveModulesAction} className="settings-functions">
          <div className="list">{MODULES.map((m) => (
            <div className="li" key={m.key}>
              <div className="grow"><div className="t" style={{ whiteSpace: "normal" }}>{m.name} {m.pro && <span className="pill">Pro</span>}</div><div className="s">{m.description}</div></div>
              <label className="sw-t"><input type="checkbox" name="modules" value={m.key} defaultChecked={modules[m.key]} aria-label={m.name} /><span /></label>
            </div>))}</div>
          <div style={{ marginTop: 12 }}><Submit>Guardar funciones</Submit></div>
        </ActionForm>
      </div>
    );
  }
  if (t === "seguridad") {
    const qr = user.totpEnabledAt ? null : await twoFactorQr();
    const sessions = await getDb().session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    const others = sessions.filter((x) => x.id !== session.id).length;
    body = (
      <>
        <div className="card sec-sum">
          <div className="chead"><div><h3>Estado de tu cuenta</h3><p className="sub">Lo importante para que nadie más pueda entrar.</p></div></div>
          <div className="sec-items">
            <div className={`sec-item ${user.totpEnabledAt ? "ok" : "warn"}`}><span className="sec-dot" aria-hidden="true">{user.totpEnabledAt ? "✓" : "!"}</span><span><b>Verificación en dos pasos</b><span className="sub">{user.totpEnabledAt ? "Activada" : "Desactivada: activala abajo"}</span></span></div>
            <div className={`sec-item ${user.emailVerified ? "ok" : "warn"}`}><span className="sec-dot" aria-hidden="true">{user.emailVerified ? "✓" : "!"}</span><span><b>Correo confirmado</b><span className="sub">{user.emailVerified ? user.email : "Falta confirmarlo (mirá el aviso arriba)"}</span></span></div>
            <div className={`sec-item ${others ? "warn" : "ok"}`}><span className="sec-dot" aria-hidden="true">{others ? others : "✓"}</span><span><b>Sesiones abiertas</b><span className="sub">{others ? `${others} además de esta` : "Solo esta"}</span></span>
              {others > 0 && <form action={revokeOtherSessionsAction} style={{ marginLeft: "auto" }}><ConfirmSubmit className="btn sm" question={`¿Cerrar las otras ${others} sesiones? En esos dispositivos vas a tener que volver a ingresar.`} yes="Sí, cerrarlas">Cerrar las demás</ConfirmSubmit></form>}</div>
            <div className="sec-item ok"><span className="sec-dot" aria-hidden="true">↓</span><span><b>Tus datos</b><span className="sub">Llevátelos cuando quieras</span></span><a className="btn sm" href="/app/configuracion/mis-datos" style={{ marginLeft: "auto" }}>Descargar todo</a></div>
          </div>
        </div>
        <div className={`card tf-card ${user.totpEnabledAt ? "on" : ""}`}>
          {user.totpEnabledAt ? (
            <div className="tf-hero">
              <div className="tf-art" aria-hidden="true">
                <div className="tf-phone">
                  <span className="tf-app">Somos Guafra</span>
                  <b className="tf-code">532 143</b>
                  <span className="tf-ring"><i /></span>
                </div>
                <span className="tf-badge ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
              </div>
              <div className="tf-body">
                <span className="pill g">Activa desde el {fmtDate(user.totpEnabledAt)}</span>
                <h3>Tu cuenta está protegida</h3>
                <p>Cuando entres desde un dispositivo nuevo, además de la contraseña te pedimos el código de la app. Aunque alguien sepa tu contraseña, no puede entrar.</p>
                <details className="tf-off">
                  <summary>Desactivar la verificación</summary>
                  <ActionForm action={disable2faAction} className="tf-off-body">
                    <p><b>Tu cuenta va a quedar menos protegida.</b> Sin la verificación, alcanza con tu contraseña para entrar. Te avisamos por correo cuando se desactiva.</p>
                    <OtpInput label="Para confirmar, escribí el código de la app" />
                    <div><Submit className="btn danger">Desactivar la verificación</Submit></div>
                  </ActionForm>
                </details>
              </div>
            </div>
          ) : qr ? (
            <ActionForm action={confirm2faAction} className="tf-setup">
              <div className="tf-head"><h3>Activá la verificación en dos pasos</h3><p className="sub">Son tres pasos y tarda un minuto.</p></div>
              <ol className="tf-steps3">
                <li><span className="tf-n">1</span><b>Instalá una app de códigos</b><small>Google Authenticator, Microsoft Authenticator o la que ya uses.</small></li>
                <li><span className="tf-n">2</span><b>Escaneá este código</b><small>En la app tocá “+” y elegí escanear.</small>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="tf-qrimg" src={qr.qr} alt="Código QR para la app de códigos" width={156} height={156} />
                  <details className="tf-keyd"><summary>¿No podés escanear? Cargá la clave</summary><code className="sel">{qr.secret.replace(/(.{4})/g, "$1 ").trim()}</code></details>
                </li>
                <li><span className="tf-n">3</span><b>Escribí el código</b><small>El que se ve ahora en la app (cambia cada 30 segundos).</small><OtpInput label="Código de 6 números" /><Submit>Activar</Submit></li>
              </ol>
            </ActionForm>
          ) : (
            <div className="tf-hero">
              <div className="tf-art" aria-hidden="true">
                <div className="tf-phone">
                  <span className="tf-app">Somos Guafra</span>
                  <b className="tf-code">532 143</b>
                  <span className="tf-ring"><i /></span>
                </div>
                <span className="tf-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg></span>
              </div>
              <div className="tf-body">
                <span className="pill a">Recomendada</span>
                <h3>Protegé tu cuenta con un código del celular</h3>
                <p>Además de la contraseña, al entrar desde un dispositivo nuevo te pedimos un código que solo ves vos en tu celular.</p>
                <ul className="tf-list"><li><Icon name="check" />Funciona sin internet en el celular.</li><li><Icon name="check" />Lo configurás en un minuto.</li><li><Icon name="check" />Te avisamos por correo si alguien la desactiva.</li></ul>
                <form action={start2faAction}><button className="btn pri" type="submit">Activar la verificación</button></form>
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="chead"><h3>Sesiones abiertas</h3>{sessions.length > 1 && <form action={revokeOtherSessionsAction}><button className="btn sm" type="submit">Cerrar las demás</button></form>}</div>
          <div className="list">{sessions.map((s) => (
            <div className="li" key={s.id}><div className="grow"><div className="t">{s.userAgent?.match(/(Windows|Mac OS X|Android|iPhone|Linux)/)?.[1] ?? "Dispositivo"}{s.id === session.id ? " · esta sesión" : ""}</div><div className="s">Desde el {fmtDate(s.createdAt)} · vence el {fmtDate(s.expiresAt)}</div></div></div>
          ))}</div>
          <p className="foot-note" style={{ marginTop: 10 }}>Somos Guafra nunca te pide ni guarda las contraseñas de tu banco.</p>
        </div>
        <div className="card">
          <div className="chead"><div><h3>Tus datos</h3><p className="sub">Son tuyos: podés llevártelos o borrarlos cuando quieras.</p></div></div>
          <div className="acts"><a className="btn" href="/app/configuracion/mis-datos">Descargar todos mis datos</a></div>
          <details id="eliminar-cuenta" className="adm-danger" style={{ marginTop: 12 }}>
            <summary>Borrar mi cuenta</summary>
            <p className="sub" style={{ margin: 0 }}>Se borran para siempre tus cuentas, movimientos, tarjetas, deudas y todo lo que cargaste. No se puede deshacer. Si pagás Pro, cancelalo antes.</p>
            <ActionForm action={deleteMyAccountAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {user.passwordHash ? <label className="field">Tu contraseña<input name="password" type="password" autoComplete="current-password" /></label> : null}
              <label className="field">Para confirmar, escribí tu correo<input name="confirm" autoComplete="off" placeholder={user.email} /></label>
              <div><Submit className="btn danger" pending="Borrando…">Borrar mi cuenta para siempre</Submit></div>
            </ActionForm>
          </details>
        </div>
      </>
    );
  }
  if (t === "plan") {
    const sub = workspace.subscription;
    const bill = await billingConfig(getDb());
    const invoices = await getDb().invoice.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 24 });
    const agreement = await getDb().billingAgreement.findFirst({ where: { workspaceId: workspace.id, status: { not: "cancelled" } }, orderBy: { createdAt: "desc" } });
    const lastPayment = await getDb().invoice.findFirst({ where: { workspaceId: workspace.id }, orderBy: [{ periodStart: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], select: { status: true } });
    const view = publicPlan(sub, membership.role === "OWNER", new Date(), { agreement, lastPaymentStatus: lastPayment?.status });
    const { ensureReferralCode, referralStats, REFERRAL_DAYS } = await import("@/server/referrals");
    const { SITE } = await import("@/lib/seo");
    const [refCode, refStats] = await Promise.all([ensureReferralCode(getDb(), user.id), referralStats(getDb(), user.id)]);
    body = (
      <>
        {sp.pagoerror && <p className="notice r" role="alert">{sp.pagoerror.slice(0, 300)}</p>}
        {sp.prueba === "usada" && <p className="notice">La prueba ya se usó o tenés una suscripción en curso. Revisá el estado de tu plan.</p>}
        {sp.pago && <div className="notice">Recibimos tu regreso de Mercado Pago. El estado de abajo refleja la confirmación recibida; volver no confirma un pago por sí solo.</div>}
        {sp.yatenes && <div className="notice">Revisá tu suscripción actual antes de iniciar otro pago.</div>}
        {sp.cancelado && view.billing === "canceled" && <div className="notice">La cancelación fue confirmada. Conservás el acceso que ya tengas cubierto; tus datos quedan guardados.</div>}
        {sp.solicituddescartada && view.billing !== "pending" && <div className="notice">La solicitud pendiente ya no está activa. Descartarla no elimina tu trial ni da de baja otra suscripción.</div>}
        <PlanSubscriptionCard view={view} bill={bill} timeZone={workspace.timezone} annual={sp.ciclo === "anual"} />
        <div className="card">
          <div className="chead"><div><h3>Invitá y ganá Pro</h3><p className="sub">Cuando alguien se registra con tu link y termina la bienvenida, ustedes dos reciben {REFERRAL_DAYS} días de Pro.</p></div>{refStats.rewarded > 0 && <span className="pill g">{refStats.rewarded} {refStats.rewarded === 1 ? "invitación" : "invitaciones"}</span>}</div>
          <ShareLink url={`${SITE.url}/?ref=${refCode}`} text="Yo uso Somos Guafra para ordenar mi plata. Probalo gratis:" />
          {refStats.invited > refStats.rewarded && <p className="sub" style={{ margin: "10px 0 0" }}>{refStats.invited - refStats.rewarded} {refStats.invited - refStats.rewarded === 1 ? "persona se registró y todavía no terminó" : "personas se registraron y todavía no terminaron"} la bienvenida.</p>}
          {refStats.left === 0 && <p className="sub" style={{ margin: "10px 0 0" }}>Llegaste al máximo de premios por invitar. ¡Gracias por recomendarnos!</p>}
        </div>
        <div className="card"><div className="chead"><h3>Qué suma Pro</h3></div><div className="list">{PLAN_FEATURES.filter((f) => f.plan === "pro").map((f) => <div className="li" key={f.name}><span className="pill b">Pro</span><div className="grow">{f.name}</div>{f.beta && <span className="pill beta">Beta</span>}</div>)}</div></div>
        {invoices.length > 0 && (
          <div className="card"><div className="chead"><h3>Historial de pagos</h3></div><div className="tw"><table>
            <thead><tr><th>Fecha</th><th>Detalle</th><th>Estado</th><th className="n">Importe</th></tr></thead>
            <tbody>{invoices.map((i) => <tr key={i.id}><td>{new Intl.DateTimeFormat("es-AR", { timeZone: workspace.timezone, dateStyle: "medium" }).format(i.paidAt ?? i.createdAt)}</td><td>somosguafra Pro</td><td><span className={`pill ${i.status === "approved" ? "g" : i.status === "rejected" ? "r" : ""}`}>{i.status === "approved" ? Number(i.refundedAmount) > 0 ? "Pagado · devolución parcial" : "Pagado" : i.status === "rejected" ? "Rechazado" : i.status === "refunded" ? "Reembolsado" : i.status === "charged_back" ? "Contracargo" : i.status === "cancelled" ? "Cancelado" : "En verificación"}</span></td><td className="n">{formatMoney(i.amount, i.currency)}{Number(i.refundedAmount) > 0 && <div className="sub">Devuelto: {formatMoney(i.refundedAmount, i.currency)}</div>}</td></tr>)}</tbody>
          </table></div></div>
        )}
      </>
    );
  }
  if (t === "datos") {
    body = (
      <div className="card"><div className="list">
        <div className="li"><div className="grow"><div className="t">Descargar mis movimientos</div><div className="s">Un archivo CSV que abre en Excel o Google Sheets.</div></div><a className="btn sm" href="/app/exportar/movimientos" download>Descargar</a></div>
        <div className="li"><div className="grow"><div className="t">Descargar todos mis datos</div><div className="s">Respaldo completo de tu espacio en un archivo.</div></div><a className="btn sm" href="/app/exportar/respaldo" download>Descargar</a></div>
        <div className="li"><div className="grow"><div className="t">Importar movimientos</div><div className="s">Desde la planilla o el extracto de tu banco.</div></div><a className="btn sm" href="/app/importar">Importar</a></div>
        <div className="li"><div className="grow"><div className="t neg">Eliminar cuenta y datos</div><div className="s">Revisá qué se elimina y confirmá la baja desde Seguridad.</div></div><a className="btn sm" href="/app/configuracion?tab=seguridad#eliminar-cuenta">Revisar baja</a></div>
      </div></div>
    );
  }
  return (<div className="narrow wide"><PageHead crumb="Ajustes" title="Configuración" />{tabs}{sp.verificar && <p className="notice a">{sp.verificar === "avisos" ? "Para recibir avisos por correo" : "Para pagar Pro"}, primero <Link className="lnk" href="/confirmar-correo">confirmá tu correo</Link>. En esa pantalla podés ingresar el código o pedir uno nuevo.</p>}{sp.soloduenio && <p className="notice a">Eso lo puede hacer solo el dueño del espacio.</p>}{t === "general" && <><ThemeChoice /><BigTextToggle />{push.enabled && <PushToggle publicKey={push.publicKey} />}<InstallApp /></>}{body}</div>);
}
