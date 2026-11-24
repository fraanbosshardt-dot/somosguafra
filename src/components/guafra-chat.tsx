"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CHAT_TOPICS, CASE_STATUS } from "@/lib/chat-help";
import type { ChatSelection, ChatView } from "@/server/guafra-chat";
import styles from "./guafra-chat.module.css";
import { LogoMark } from "./logo-mark";
import { takeChatOpen } from "@/lib/open-chat";
import { mergeChatHistory } from "@/lib/chat-history";

const QUICK_LABELS: Partial<Record<(typeof CHAT_TOPICS)[number]["id"], string>> = {
  start: "Primeros pasos",
  plans: "Planes y precios",
  trial: "Prueba gratuita",
  pending: "Pago de Pro pendiente",
  cancel: "Cancelar renovación",
  moves: "Movimientos",
};
type Case = ChatSelection & { code: string; subject: string; status: string; at: string; channel?: string };
type Payload = {
  current: ChatView | null;
  cases: Case[];
  identity?: { name: string; email: string } | null;
  error?: string;
};
export function GuafraChat({
  source = "site",
  inline = false,
  token,
}: {
  source?: "site" | "app";
  inline?: boolean;
  token?: string;
}) {
  const [open, setOpen] = useState(inline),
    [current, setCurrent] = useState<ChatView | null>(null),
    [cases, setCases] = useState<Case[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(inline),
    [error, setError] = useState(""),
    [handoff, setHandoff] = useState(false),
    [history, setHistory] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [area, setArea] = useState("soporte"),
    [identity, setIdentity] = useState<Payload["identity"]>(null);
  const [historyRows, setHistoryRows] = useState<Case[] | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1), [historyPages, setHistoryPages] = useState(1);
  const [historyBusy, setHistoryBusy] = useState(false);
  const historyGeneration = useRef(0);
  async function loadHistory(page = 1, q = historyQuery) {
    const generation = ++historyGeneration.current;
    setHistoryBusy(true); setError("");
    try {
      const r = await fetch(`/api/soporte/chat?${new URLSearchParams({ history: "1", page: String(page), q })}`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "No pudimos cargar el historial.");
      if (generation === historyGeneration.current) { setHistoryRows(data.cases); setHistoryPage(data.page); setHistoryPages(data.pages); }
    } catch { if (generation === historyGeneration.current) setError("No pudimos cargar el historial. Volvé a intentar."); }
    finally { if (generation === historyGeneration.current) setHistoryBusy(false); }
  }
  const panel = useRef<HTMLElement>(null),
    launch = useRef<HTMLButtonElement>(null),
    draft = useRef<{ text: string; nonce: string } | null>(null),
    newCase = useRef(!token),
    screenVersion = useRef(0),
    queuedLoad = useRef<{ code?: string } | null>(null),
    generation = useRef(0),
    inFlight = useRef(false),
    selected = useRef<ChatView | null>(null),
    previousIdentity = useRef<Payload["identity"]>(null),
    requestedCode = useRef<string | undefined>(undefined),
    feed = useRef<HTMLDivElement>(null),
    handoffTitle = useRef<HTMLHeadingElement>(null),
    nearBottom = useRef(true),
    feedScrollTop = useRef(0),
    id = useId();
  useEffect(() => { if (handoff) handoffTitle.current?.focus({ preventScroll: true }); }, [handoff]);
  const accept = useCallback((data: Payload) => {
    selected.current = data.current;
    setCurrent(data.current);
    setCases(data.cases);
    if (data.identity !== undefined) {
      if (
        previousIdentity.current &&
        previousIdentity.current.email !== data.identity?.email
      ) {
        historyGeneration.current++; setHistoryRows(null); setHistoryQuery("");
        setName("");
        setEmail("");
        setText("");
        setHandoff(false);
        draft.current = null;
      }
      previousIdentity.current = data.identity;
      setIdentity(data.identity);
      if (data.identity) {
        setName(data.identity.name);
        setEmail(data.identity.email);
      }
    }
  }, []);
  const request = useCallback(
    async (data: Record<string, unknown>) => {
      const r = await fetch("/api/soporte/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, token, source }),
        cache: "no-store",
      });
      const payload: Payload = await r.json();
      if (!r.ok) {
        if (r.status === 403) {
          selected.current = null;
          setCurrent(null);
          setCases([]);
          previousIdentity.current = null;
          setIdentity(null);
          setName("");
          setEmail("");
          setText("");
          setHandoff(false);
          draft.current = null;
        }
        throw new Error(payload.error ?? "No pudimos completar la solicitud.");
      }
      return payload;
    },
    [source, token],
  );
  const load = useCallback(
    async (code?: string, silent = false) => {
      if (inFlight.current) {
        queuedLoad.current = { code };
        return;
      }
      const seq = ++generation.current;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        let data: Payload;
        if (token) data = await request({ action: "load" });
        else if (selected.current && !code)
          data = await request({ action: "load", selection: selected.current });
        else {
          const r = await fetch(
            `/api/soporte/chat${code ? `?case=${encodeURIComponent(code)}` : ""}`,
            { cache: "no-store" },
          );
          data = await r.json();
          if (!r.ok) throw new Error(data.error);
          if (code && !data.current)
            throw new Error(
              "No encontramos ese caso en tu cuenta. Usá el enlace privado del correo si escribiste como visitante.",
            );
        }
        if (seq === generation.current) {
          data.current = mergeChatHistory(selected.current, data.current);
          accept(data);
        }
      } catch (e) {
        if (seq === generation.current && !silent)
          setError(
            e instanceof Error ? e.message : "No pudimos abrir el chat.",
          );
      } finally {
        if (seq === generation.current) setLoading(false);
      }
    },
    [accept, request, token],
  );
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("chat");
    if (code) {
      requestedCode.current = code;
      setLoading(true);
      setOpen(true);
    }
  }, []);
  useEffect(() => {
    const handler = (e: Event) => {
      if (token) return;
      const code = (e as CustomEvent<string>).detail;
      takeChatOpen();
      fresh();
      requestedCode.current = code;
      newCase.current = !code;
      if (open) void load(code);
      else {
        setLoading(true);
        setOpen(true);
      }
    };
    window.addEventListener("guafra:open", handler);
    const pending = takeChatOpen();
    if (pending) handler(new CustomEvent("guafra:open", { detail: pending.code }));
    return () => window.removeEventListener("guafra:open", handler);
  }, [load, open, token]);
  useEffect(() => {
    if (!open) return;
    void load(requestedCode.current);
    requestedCode.current = undefined;
    const timer = setInterval(() => {
      if (!document.hidden && !inFlight.current && !newCase.current)
        void load(undefined, true);
    }, 15000);
    return () => {
      clearInterval(timer);
      generation.current++;
    };
  }, [open, load]);
  useEffect(() => {
    if (!open || inline) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      if (previous && previous !== document.body && previous.isConnected)
        previous.focus();
      else launch.current?.focus();
    };
  }, [open, inline]);
  useEffect(() => {
    if (nearBottom.current && feed.current)
      feed.current.scrollTop = current?.messages.length
        ? feed.current.scrollHeight
        : 0;
    else if (feed.current) feed.current.scrollTop = feedScrollTop.current;
  }, [current?.messages.at(-1)?.id, open, handoff, history]);
  async function act(data: Record<string, unknown>, after?: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    const screen = screenVersion.current;
    generation.current++;
    setBusy(true);
    setError("");
    try {
      const response = await request({
        selection: current ? { kind: current.kind, id: current.id } : undefined,
        ...data,
      });
      if (data.before && current && response.current) {
        response.current = mergeChatHistory(current, response.current, true);
      }
      if (screen === screenVersion.current) {
        accept(response);
        after?.();
      }
    } catch (e) {
      if (screen === screenVersion.current) setError(
        e instanceof Error ? e.message : "No pudimos guardar el mensaje.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      setLoading(false);
      const queued = queuedLoad.current;
      queuedLoad.current = null;
      if (queued) void load(queued.code);
    }
  }
  function send(value = text, topic?: string) {
    if (!value.trim() || busy || loading) return;
    nearBottom.current = true;
    const pending =
      draft.current?.text === value
        ? draft.current
        : { text: value, nonce: crypto.randomUUID() };
    draft.current = pending;
    void act(
      {
        action: "message",
        text: value,
        nonce: pending.nonce,
        topic,
        newCase: newCase.current,
      },
      () => {
        setText("");
        draft.current = null;
        newCase.current = false;
        setHandoff(false);
      },
    );
  }
  function fresh() {
    screenVersion.current++;
    queuedLoad.current = null;
    generation.current++;
    selected.current = null;
    setCurrent(null);
    newCase.current = true;
    setHistory(false);
    setHandoff(false);
    setError("");
    setText("");
    draft.current = null;
    nearBottom.current = true;
  }
  function close() {
    historyGeneration.current++; setHistoryBusy(false);
    fresh();
    setOpen(false);
    setLoading(false);
  }
  function keyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape" && !inline) {
      close();
      return;
    }
    if (e.key === "Tab" && !inline) {
      const list = panel.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled])",
      );
      if (!list?.length) return;
      const first = list[0],
        last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  return (
    <div
      className={`${styles.root} ${source === "app" ? styles.app : ""} ${inline ? styles.inline : ""}`}
    >
      {!inline && open && (
        <div
          className={styles.backdrop}
          aria-hidden="true"
          onClick={close}
        />
      )}
      {!inline && !open && (
        <button
          ref={launch}
          className={styles.launch}
          type="button"
          aria-label={open ? "Cerrar chat Guafra" : "Abrir chat Guafra"}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            fresh();
            setLoading(true);
            setOpen(true);
          }}
        >
          <svg
            width="23"
            height="23"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 1.8-6.2A8.5 8.5 0 1 1 21 11.5Z" />
            <path d="M7 10h9M7 14h5" />
          </svg>
          <span>Guafra</span>
        </button>
      )}
      {open && (
        <section
          ref={panel}
          id={id}
          className={styles.panel}
          role={inline ? "region" : "dialog"}
          aria-modal={inline ? undefined : true}
          aria-label="Chat Guafra"
          tabIndex={-1}
          onKeyDown={keyDown}
        >
          <header className={styles.header}>
            <span className={styles.avatar} aria-hidden="true">
              <LogoMark className={styles.mark} />
            </span>
            <div>
              <strong>Guafra</strong>
              <small>
                {handoff ? "Contactar al equipo" : current?.human
                  ? "Atención del equipo"
                  : "Asistente automático"}
              </small>
            </div>
            {!inline && (
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar chat"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" aria-hidden="true" focusable="false">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </header>
          {history && !loading && (
            <div className={styles.history}>
              <p>Tus conversaciones quedan guardadas acá, también las resueltas.</p>
              <form onSubmit={(e) => { e.preventDefault(); void loadHistory(1); }}><label>Buscar conversaciones<input value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} maxLength={120} placeholder="Código o asunto" /></label><button disabled={historyBusy} type="submit">{historyBusy ? "Buscando…" : "Buscar"}</button></form>
              {(historyRows ?? cases).length ? (
                (historyRows ?? cases).map((c) => (
                  <button
                    key={`${c.kind}-${c.id}`}
                    aria-current={current?.id === c.id && current.kind === c.kind ? "true" : undefined}
                    disabled={busy || loading}
                    type="button"
                    onClick={() => {
                      newCase.current = false;
                      nearBottom.current = true;
                      void act({ action: "load", selection: c }, () =>
                        setHistory(false),
                      );
                    }}
                  >
                    <div className={styles.historyMeta}>
                      <b>{c.code}</b>
                      <em>{c.kind === "chat" && c.status === "CLOSED" ? "Finalizada" : CASE_STATUS[c.status] ?? (c.status === "BOT" ? "Automática" : c.status)}</em>
                    </div>
                    <small>{c.channel ?? (c.kind === "chat" ? c.status === "BOT" ? "Con Guafra" : "Con el equipo" : c.kind === "contact" ? "Formulario" : "Ayuda")}</small>
                    <span>{c.subject}</span>
                    <time dateTime={c.at}>
                      {new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(c.at))}
                    </time>
                  </button>
                ))
              ) : (
                <p>No hay conversaciones para esta búsqueda.</p>
              )}
              <div className={styles.historyPaging}><button type="button" disabled={historyBusy || historyPage <= 1} onClick={() => void loadHistory(historyPage - 1)}>Anterior</button><span>{historyPage} / {historyPages}</span><button type="button" disabled={historyBusy || historyPage >= historyPages} onClick={() => void loadHistory(historyPage + 1)}>Siguiente</button></div>
            </div>
          )}
          {current && !loading && !history && !handoff && (
            <p className={styles.case}>
              {current.code} ·{" "}
              {current.inactive ? "Finalizada por inactividad" : CASE_STATUS[current.status] ??
                (current.status === "BOT" ? "Con Guafra" : current.status)}
            </p>
          )}
          {!handoff && !history && (
            <div
              ref={feed}
              className={styles.feed}
              onScroll={() => {
                if (feed.current) {
                  feedScrollTop.current = feed.current.scrollTop;
                  nearBottom.current =
                    feed.current.scrollHeight -
                      feed.current.scrollTop -
                      feed.current.clientHeight <
                    80;
                }
              }}
              role="log"
              aria-label="Mensajes"
              aria-live="polite"
              aria-relevant="additions text"
              aria-busy={busy}
            >
              {!current && !loading && (
                <div className={styles.welcome}>
                  <span className={styles.eyebrow}>ESTAMOS PARA AYUDARTE</span>
                  <h2>Hola, soy Guafra.</h2>
                  <p>
                    Te ayudo a usar somosguafra. Si necesitás al equipo, le paso
                    toda esta conversación.
                  </p>
                  <div className={styles.topics}>
                    {CHAT_TOPICS.filter((t) =>
                      (source === "app" ? ["start", "moves", "budget-projection", "flow-explanation", "pending", "verify"] : ["start", "plans", "trial", "pending", "cancel", "moves"]).includes(t.id),
                    ).map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        disabled={busy || loading}
                        onClick={() => send(t.title, t.id)}
                      >
                        {QUICK_LABELS[t.id] ?? t.title}
                        <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {current && !loading && (
                <>
                  {current.hasOlder && (
                    <button
                      className={styles.older}
                      type="button"
                      disabled={busy || loading}
                      onClick={() => {
                        if (!current.messages[0]) return;
                        void act(
                          { action: "load", before: current.messages[0].id },
                          () => {},
                        );
                      }}
                    >
                      Ver mensajes anteriores
                    </button>
                  )}
                  {current.messages.map((m) => (
                    <article
                      className={`${styles.message} ${m.role === "customer" ? styles.customer : styles.answer}`}
                      key={m.id}
                    >
                      <small>
                        {m.role === "customer"
                          ? "Vos"
                          : m.role === "bot"
                            ? "Guafra · automático"
                            : "Equipo somosguafra"}
                      </small>
                      <p>{m.body}</p>
                      {m.role === "bot" &&
                        CHAT_TOPICS.find((t) => t.id === m.topic)?.link && (
                          <a
                            href={CHAT_TOPICS.find((t) => t.id === m.topic)!.link}
                          >
                            {CHAT_TOPICS.find((t) => t.id === m.topic)!.linkLabel}{" "}
                            ↗
                          </a>
                        )}
                      <time dateTime={m.at}>
                        {new Intl.DateTimeFormat("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        }).format(new Date(m.at))}
                      </time>
                    </article>
                  ))}
                  {current.human && (
                    <p className={styles.hint}>
                      {["CLOSED", "RESOLVED"].includes(current.status)
                        ? "Caso resuelto. Si volvés a escribir, se reabre esta misma conversación."
                        : "El equipo recibe tus mensajes acá. Te avisamos por correo cuando responda."}
                    </p>
                  )}
                  {!current.human && !handoff && (
                    <div className={styles.options}>
                      <button
                        type="button"
                        disabled={busy || loading}
                        onClick={() => {
                          setArea(current.area);
                          setHandoff(true);
                        }}
                      >
                        Hablar con el equipo
                      </button>
                      {!current.resolved && (
                        <button
                          type="button"
                          disabled={busy || loading}
                          onClick={() => void act({ action: "resolve" })}
                        >
                          Ya resolví mi consulta
                        </button>
                      )}
                      {current.resolved && (
                        <span>{current.inactive ? "Esta consulta automática terminó por inactividad. Podés retomarla escribiendo o empezar otra desde Inicio." : "Tu consulta quedó resuelta y guardada en Mis conversaciones."}</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {handoff && current && !current.human && !loading && !history && (
            <form
              className={styles.handoff}
              aria-labelledby={`${id}-handoff-title`}
              onSubmit={(e) => {
                e.preventDefault();
                void act({ action: "handoff", name, email, area }, () =>
                  setHandoff(false),
                );
              }}
            >
              <h2 id={`${id}-handoff-title`} ref={handoffTitle} tabIndex={-1}>Hablá con el equipo</h2>
              <p>
                Conservamos todo el historial. Te avisaremos por correo cuando respondamos, de lunes a viernes, de 9 a 17 h (Argentina).
              </p>
              <label>
                Nombre
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  readOnly={!!identity}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                Correo para avisarte
                <input
                  type="email"
                  required
                  maxLength={200}
                  value={email}
                  readOnly={!!identity}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label>
                Motivo
                <select value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="soporte">Ayuda con la app</option>
                  <option value="pagos">Pagos o suscripción</option>
                  <option value="privacidad">Privacidad o seguridad</option>
                  <option value="reclamos">Reclamo</option>
                  <option value="arrepentimiento">Arrepentimiento</option>
                </select>
              </label>
              <div className={styles.options}>
                <button type="submit" disabled={busy || loading}>
                  Registrar caso
                </button>
                <button type="button" onClick={() => setHandoff(false)}>
                  Volver
                </button>
              </div>
            </form>
          )}
          {error && (
            <div role="alert" className={styles.error}>
              {error}{" "}
              <button
                type="button"
                onClick={() => void load()}
                disabled={busy || loading}
              >
                Volver a intentar
              </button>{" "}
              · <a href="/contacto">Contacto</a>
            </div>
          )}
          {loading && <p className={styles.hint}>Abriendo conversación…</p>}
          {!handoff && !history && (
            <form
              className={styles.compose}
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label className={styles.sr} htmlFor={`${id}-text`}>
                Tu mensaje
              </label>
              <textarea
                id={`${id}-text`}
                rows={1}
                maxLength={3000}
                placeholder={
                  current?.human
                    ? "Escribile al equipo…"
                    : "¿En qué te puedo ayudar?"
                }
                value={text}
                disabled={busy || loading}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                type="submit"
                disabled={busy || loading || text.trim().length < 2}
                aria-label="Enviar mensaje"
              >
                {busy ? "…" : "↑"}
              </button>
            </form>
          )}
          {!token && (
            <nav className={styles.toolbar} aria-label="Navegación del chat">
              <button type="button" aria-current={!current && !history ? "page" : undefined}
                disabled={busy || loading} onClick={() => { fresh(); void load(); }}>
                Inicio
              </button>
              <button type="button" aria-current={history ? "page" : undefined}
                disabled={busy || loading} onClick={() => { setHistory(true); setHandoff(false); setHistoryQuery(""); void loadHistory(1, ""); }}>
                Mis conversaciones
              </button>
            </nav>
          )}
          <footer className={styles.foot}>
            No compartas contraseñas, códigos ni datos de tarjeta.{" "}
            <a href="/privacidad">Privacidad</a>
          </footer>
        </section>
      )}
    </div>
  );
}
