import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { fmtDate } from "@/lib/dates";
import { COUNTRIES, CURRENCIES } from "@/lib/countries";
import { publicPlan } from "@/server/public-plan";
import { ActionForm, OtpInput, Submit } from "@/components/forms";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { RecoveryCodes } from "@/components/recovery-codes";
import { PushToggle } from "@/components/push-toggle";
import { pushConfig } from "@/server/push";
import { SharingTab } from "@/app/app/configuracion/sharing-tab";
import { confirm2faAction, deleteMyAccountAction, disable2faAction, revokeOtherSessionsAction, saveModulesAction, start2faAction, twoFactorQr, updateProfileAction } from "@/app/actions/app";
import { MvBackHead } from "../../head";
import { MvIcon } from "../../ui";

export const metadata: Metadata = { title: "Configuración" };
const TABS = [["general", "General"], ["funciones", "Funciones"], ["seguridad", "Seguridad"], ["compartir", "Compartir"], ["plan", "Plan"], ["datos", "Tus datos"]] as const;

// Mismos ajustes que la web. El plan se muestra, pero en la app Pro se contrata solo con Google Play.
export default async function ConfiguracionMovil({ searchParams }: { searchParams: Promise<{ tab?: string; seguridaderror?: string; soloduenio?: string }> }) {
  const { user, workspace, modules, plan, session, membership } = await requireWorkspace();
  const sp = await searchParams;
  const t = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "general";
  const db = getDb();
  const push = pushConfig();
  const base = "/movil/explorar/configuracion";
  let body: React.ReactNode = null;

  if (t === "general") {
    body = (
      <>
        <ActionForm action={updateProfileAction} className="mv-card mv-web">
          <label className="field">Nombre<input name="name" defaultValue={user.name} /></label>
          <label className="field">Correo<input defaultValue={user.email} disabled /></label>
          <label className="field">País<select name="country" defaultValue={workspace.country}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
          <label className="field">Moneda principal<select name="currency" defaultValue={workspace.baseCurrency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select></label>
          <fieldset className="mv-fs">
            <legend className="mv-lbl" style={{ marginBottom: 6 }}>Otras monedas que usas</legend>
            <div className="mv-radios">{CURRENCIES.filter((c) => c.code !== workspace.baseCurrency).map((c) => (
              <label key={c.code}><input type="checkbox" name="extraCurrencies" value={c.code} defaultChecked={workspace.extraCurrencies.includes(c.code)} /><span>{c.code}</span></label>
            ))}</div>
          </fieldset>
          <p className="sub" style={{ margin: 0 }}>La zona horaria se ajusta sola según el país.</p>
          <div><Submit>Guardar</Submit></div>
        </ActionForm>
        {push.enabled && <div className="mv-card mv-web"><PushToggle publicKey={push.publicKey} /></div>}
      </>
    );
  }

  if (t === "funciones") {
    body = (
      <ActionForm action={saveModulesAction} className="mv-web">
        <p className="sub" style={{ margin: 0 }}>Activa solo lo que usas. Lo que apagues desaparece de Explorar; tus datos no se borran.</p>
        <div className="mv-card-list">{MODULES.map((m) => (
          <label key={m.key} className="mv-row" style={{ cursor: "pointer" }}>
            <span className="grow"><span className="t" style={{ display: "block" }}>{m.name}{m.pro ? " · Pro" : ""}</span><span className="s">{m.description}</span></span>
            <span className="mv-switch"><input type="checkbox" name="modules" value={m.key} defaultChecked={modules[m.key]} aria-label={m.name} /><i /></span>
          </label>
        ))}</div>
        <div><Submit>Guardar funciones</Submit></div>
      </ActionForm>
    );
  }

  if (t === "seguridad") {
    const recoveryRemaining = await db.recoveryCode.count({ where: { userId: user.id, usedAt: null } });
    const qr = user.totpEnabledAt ? null : await twoFactorQr();
    const sessions = await db.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    const others = sessions.filter((x) => x.id !== session.id).length;
    body = (
      <>
        {sp.seguridaderror && <p className="mv-error" role="alert">{sp.seguridaderror.slice(0, 300)}</p>}
        <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="mv-h2" style={{ fontSize: 16 }}>Verificación en dos pasos</h2>
          {user.totpEnabledAt ? (
            <>
              <p className="mv-ok" style={{ margin: 0 }}>Activada desde el {fmtDate(user.totpEnabledAt)}. Al entrar desde un dispositivo nuevo te pedimos el código de tu app.</p>
              <details className="mv-more">
                <summary style={{ fontSize: 14 }}>Desactivar la verificación</summary>
                <ActionForm action={disable2faAction} className="mv-web">
                  <p className="sub" style={{ margin: 0 }}>Tu cuenta va a quedar menos protegida. Te avisamos por correo.</p>
                  <OtpInput label="Para confirmar, escribe el código de la app" />
                  <div><Submit className="btn danger">Desactivar</Submit></div>
                </ActionForm>
              </details>
            </>
          ) : qr ? (
            <ActionForm action={confirm2faAction} className="mv-web">
              <p className="sub" style={{ margin: 0 }}>1. Instala una app de códigos (Google Authenticator, Microsoft Authenticator u otra). 2. Agrega esta cuenta con la clave de abajo o escaneando el código desde otro dispositivo. 3. Escribe el código que ves.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qr} alt="Código QR para la app de códigos" width={156} height={156} style={{ alignSelf: "center", borderRadius: 12 }} />
              <label className="field">Clave para cargar a mano<input readOnly value={qr.secret.replace(/(.{4})/g, "$1 ").trim()} /></label>
              <OtpInput label="Código de 6 números" />
              <div><Submit>Activar</Submit></div>
            </ActionForm>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>Además de la contraseña, al entrar desde un dispositivo nuevo te pedimos un código que solo ves tú.</p>
              <form action={start2faAction}><button className="mv-btn pri mv-big" type="submit">Activar la verificación</button></form>
            </>
          )}
        </section>
        {user.totpEnabledAt && <div className="mv-web"><RecoveryCodes remaining={recoveryRemaining} /></div>}
        <section className="mv-sec" style={{ gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Sesiones abiertas</h2>
          <div className="mv-card-list">{sessions.map((s) => (
            <div key={s.id} className="mv-row"><span className="grow"><span className="t" style={{ display: "block" }}>{s.userAgent?.match(/(Windows|Mac OS X|Android|iPhone|Linux)/)?.[1] ?? "Dispositivo"}{s.id === session.id ? " · esta sesión" : ""}</span><span className="s">Desde el {fmtDate(s.createdAt)} · vence el {fmtDate(s.expiresAt)}</span></span></div>
          ))}</div>
          {others > 0 && <form action={revokeOtherSessionsAction}><ConfirmSubmit className="mv-btn" question={`¿Cerrar las otras ${others} sesiones? En esos dispositivos vas a tener que volver a ingresar.`} yes="Sí, cerrarlas">Cerrar las demás sesiones</ConfirmSubmit></form>}
        </section>
        <details id="eliminar-cuenta" className="mv-card mv-more">
          <summary style={{ color: "#A3231B" }}>Borrar mi cuenta</summary>
          <ActionForm action={deleteMyAccountAction} className="mv-web">
            <p className="sub" style={{ margin: 0 }}>Se borran para siempre tus cuentas, movimientos, tarjetas, deudas y todo lo que cargaste. No se puede deshacer. Si pagas Pro, cancélalo antes.</p>
            {user.passwordHash ? <label className="field">Tu contraseña<input name="password" type="password" autoComplete="current-password" /></label> : null}
            <label className="field">Para confirmar, escribe tu correo<input name="confirm" autoComplete="off" placeholder={user.email} /></label>
            <div><Submit className="btn danger" pending="Borrando…">Borrar mi cuenta para siempre</Submit></div>
          </ActionForm>
        </details>
      </>
    );
  }

  if (t === "compartir") body = <div className="mv-web">{await SharingTab({ workspaceId: workspace.id, role: membership.role, plan, userId: user.id })}</div>;

  if (t === "plan") {
    const view = publicPlan(workspace.subscription, membership.role === "OWNER", new Date());
    body = (
      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Tu plan</div>
        <b style={{ fontSize: 24 }}>{plan === "PRO" ? "Pro" : "Gratis"}</b>
        {view.freeUntil && <span style={{ fontSize: 14, fontWeight: 600 }}>Tienes Pro hasta el {fmtDate(new Date(view.freeUntil))}.</span>}
        {plan !== "PRO" && <Link className="mv-btn pri" href="/movil/explorar/pro" style={{ flex: "none" }}>Ver qué suma Pro</Link>}
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Si ya pagas Pro desde la web, lo gestionas desde somosguafra.com.</p>
      </section>
    );
  }

  if (t === "datos") {
    body = (
      <div className="mv-card-list">
        <a className="mv-row" href="/app/exportar/movimientos" download><span className="mv-date"><MvIcon name="file" /></span><span className="grow"><span className="t" style={{ display: "block" }}>Descargar mis movimientos</span><span className="s">Un archivo CSV que abre en Excel o Google Sheets.</span></span></a>
        <a className="mv-row" href="/app/exportar/respaldo" download><span className="mv-date"><MvIcon name="file" /></span><span className="grow"><span className="t" style={{ display: "block" }}>Descargar todos mis datos</span><span className="s">Respaldo completo en un archivo.</span></span></a>
        <Link className="mv-row" href={`${base}?tab=seguridad#eliminar-cuenta`}><span className="mv-date" style={{ background: "#FDECEA", color: "#A3231B" }}><MvIcon name="logout" /></span><span className="grow"><span className="t" style={{ display: "block", color: "#A3231B" }}>Borrar mi cuenta y mis datos</span><span className="s">Revisa qué se borra y confirma.</span></span></Link>
      </div>
    );
  }

  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Tu cuenta" title="Configuración" />
      {sp.soloduenio && <p className="mv-error">Eso lo puede hacer solo el dueño del espacio.</p>}
      <nav className="mv-chips" aria-label="Secciones">
        {TABS.map(([k, l]) => <Link key={k} href={`${base}?tab=${k}`} className={t === k ? "on" : ""} aria-current={t === k ? "true" : undefined}>{l}</Link>)}
      </nav>
      {body}
    </main>
  );
}
