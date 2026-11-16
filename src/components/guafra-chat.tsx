"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CHAT_TOPICS, CASE_STATUS } from "@/lib/chat-help";
import type { ChatSelection, ChatView } from "@/server/guafra-chat";
import styles from "./guafra-chat.module.css";
import { LogoMark } from "./logo-mark";
import { mergeChatHistory } from "@/lib/chat-history";
type Case = ChatSelection & { code: string; subject: string; status: string };
type Payload = {
  current: ChatView | null;
  cases: Case[];
  identity?: { name: string; email: string } | null;
  error?: string;
};
export function ChatOpen({
  children = "Hablar con Guafra",
  code,
}: {
  children?: React.ReactNode;
  code?: string;
}) {
  return (
    <button
      className="btn pri"
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("guafra:open", { detail: code }))
      }
    >
      {children}
    </button>
  );
}
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
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [handoff, setHandoff] = useState(false),
    [history, setHistory] = useState(false),
    [caseCode, setCaseCode] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [area, setArea] = useState("soporte"),
    [identity, setIdentity] = useState<Payload["identity"]>(null);
  const panel = useRef<HTMLElement>(null),
    launch = useRef<HTMLButtonElement>(null),
    draft = useRef<{ text: string; nonce: string } | null>(null),
    newCase = useRef(false),
    generation = useRef(0),
    inFlight = useRef(false),
    selected = useRef<ChatView | null>(null),
    previousIdentity = useRef<Payload["identity"]>(null),
    requestedCode = useRef<string | undefined>(undefined),
    feed = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true),
    id = useId();
  const accept = useCallback((data: Payload) => {
    selected.current = data.current;
    setCurrent(data.current);
    setCases(data.cases);
    if (data.identity !== undefined) {
      if (
        previousIdentity.current &&
        previousIdentity.current.email !== data.identity?.email
      ) {
        setName("");
        setEmail("");
        setText("");
        setCaseCode("");
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
          setCaseCode("");
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
      if (inFlight.current) return;
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
      setOpen(true);
    }
  }, []);
  useEffect(() => {
    const handler = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      requestedCode.current = code;
      newCase.current = false;
      if (open) void load(code);
      else {
        setLoading(true);
        setOpen(true);
      }
    };
    window.addEventListener("guafra:open", handler);
    return () => window.removeEventListener("guafra:open", handler);
  }, [load, open]);
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
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, inline]);
  useEffect(() => {
    if (nearBottom.current && feed.current)
      feed.current.scrollTop = current?.messages.length
        ? feed.current.scrollHeight
        : 0;
  }, [current?.messages.at(-1)?.id, open]);
  async function act(data: Record<string, unknown>, after?: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
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
      accept(response);
      after?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar el mensaje.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      setLoading(false);
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
  function keyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape" && !inline) {
      setOpen(false);
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
          onClick={() => setOpen(false)}
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
          onKeyDown={keyDown}
        >
          <header className={styles.header}>
            <span className={styles.avatar} aria-hidden="true">
              <LogoMark className={styles.mark} />
            </span>
            <div>
              <strong>Guafra</strong>
              <small>
                {current?.human
                  ? "Atención del equipo"
                  : "Asistente automático"}
              </small>
            </div>
            {!inline && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar chat"
              >
                ×
              </button>
            )}
          </header>
          {!token && (
            <nav className={styles.toolbar} aria-label="Conversaciones">
              <button
                type="button"
                onClick={() => setHistory(!history)}
                aria-expanded={history}
              >
                Mis conversaciones
              </button>
              <button
                type="button"
                onClick={fresh}
                disabled={busy || loading || !!token}
              >
                Nueva consulta
              </button>
            </nav>
          )}
          {history && !loading && (
            <div className={styles.history}>
              <p>Conversaciones recientes</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  newCase.current = false;
                  void load(caseCode.trim().toUpperCase());
                  setHistory(false);
                }}
              >
                <label>
                  Abrir por código
                  <input
                    value={caseCode}
                    maxLength={100}
                    onChange={(e) => setCaseCode(e.target.value)}
                    placeholder="SG-…"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || loading || !caseCode.trim()}
                >
                  Abrir caso
                </button>
              </form>
              {cases.length ? (
                cases.map((c) => (
                  <button
                    key={`${c.kind}-${c.id}`}
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
                    <b>{c.code}</b>
                    <span>{c.subject}</span>
                  </button>
                ))
              ) : (
                <p>Tus conversaciones aparecerán acá.</p>
              )}
            </div>
          )}
          {current && !loading && (
            <p className={styles.case}>
              {current.code} ·{" "}
              {CASE_STATUS[current.status] ??
                (current.status === "BOT" ? "Con Guafra" : current.status)}
            </p>
          )}
          <div
            ref={feed}
            className={styles.feed}
            onScroll={() => {
              if (feed.current)
                nearBottom.current =
                  feed.current.scrollHeight -
                    feed.current.scrollTop -
                    feed.current.clientHeight <
                  80;
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
                    [
                      "start",
                      "plans",
                      "trial",
                      "pending",
                      "cancel",
                      "moves",
                    ].includes(t.id),
                  ).map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      disabled={busy || loading}
                      onClick={() => send(t.title, t.id)}
                    >
                      {t.title}
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
                      <span>¡Qué bueno que lo resolviste!</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {handoff && current && !current.human && !loading && (
            <form
              className={styles.handoff}
              onSubmit={(e) => {
                e.preventDefault();
                void act({ action: "handoff", name, email, area }, () =>
                  setHandoff(false),
                );
              }}
            >
              <strong>Le pasamos tu consulta al equipo</strong>
              <p>
                Lunes a viernes, 9 a 17 h (Argentina). Conservamos todo el chat.
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
          {!handoff && (
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
                rows={2}
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
          <footer className={styles.foot}>
            No compartas contraseñas, códigos ni datos de tarjeta.{" "}
            <a href="/privacidad">Privacidad</a>
          </footer>
        </section>
      )}
    </div>
  );
}
