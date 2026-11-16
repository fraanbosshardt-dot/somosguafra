import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { UserError } from "@/server/ledger";
import { reportError } from "@/lib/diagnostics";
import {
  ChatAccessError,
  chatCases,
  chatHash,
  handoffChat,
  loadChatByCode,
  readChat,
  resolveBotChat,
  sendChatMessage,
  type ChatActor,
  type ChatSelection,
} from "@/server/guafra-chat";
import { resolveCaseToken } from "@/server/support-thread";
import { drainEmailOutbox } from "@/server/billing-mail";
export const dynamic = "force-dynamic";
const COOKIE = "somosguafra_chat";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
async function actor(req: NextRequest) {
  const session = await getSession();
  const full =
    session && (!session.user.totpEnabledAt || session.twoFactorVerified)
      ? session
      : null;
  const raw = req.cookies.get(COOKIE)?.value;
  const token =
    raw && /^[a-zA-Z0-9_-]{43}$/.test(raw)
      ? raw
      : randomBytes(32).toString("base64url");
  return {
    token,
    fresh: token !== raw,
    actor: {
      user: full
        ? { id: full.user.id, name: full.user.name, email: full.user.email }
        : null,
      visitorHash: chatHash(token),
      ip:
        req.headers
          .get("x-forwarded-for")
          ?.split(",")[0]
          ?.trim()
          .slice(0, 100) || null,
    } satisfies ChatActor,
  };
}
function cookie(response: NextResponse, a: Awaited<ReturnType<typeof actor>>) {
  if (a.fresh)
    response.cookies.set(COOKIE, a.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 86400,
    });
  return response;
}
function selection(input: Record<string, unknown>): ChatSelection | undefined {
  const v = input.selection;
  if (!v || typeof v !== "object") return;
  const s = v as Record<string, unknown>;
  if (
    !["chat", "ticket", "contact"].includes(String(s.kind)) ||
    typeof s.id !== "string" ||
    s.id.length > 100
  )
    throw new UserError("No se pudo abrir la conversación.");
  return { kind: s.kind as ChatSelection["kind"], id: s.id };
}
export async function GET(req: NextRequest) {
  try {
    const a = await actor(req),
      db = getDb(),
      cases = await chatCases(db, a.actor);
    const code = req.nextUrl.searchParams.get("case");
    const current = code
      ? await loadChatByCode(db, a.actor, code)
      : cases[0]
        ? await readChat(db, a.actor, cases[0])
        : null;
    return cookie(
      json({
        cases,
        current,
        identity: a.actor.user
          ? { name: a.actor.user.name, email: a.actor.user.email }
          : null,
      }),
      a,
    );
  } catch (e) {
    reportError("[chat load]", e);
    return json(
      {
        error:
          "No pudimos abrir el chat. Podés volver a intentar o usar Contacto.",
      },
      503,
    );
  }
}
async function body(req: NextRequest): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new UserError("Solicitud inválida.");
  const reader = req.body?.getReader();
  if (!reader) throw new UserError("Falta el mensaje.");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) throw new UserError("El mensaje es demasiado largo.");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new UserError("Solicitud inválida.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new UserError("Solicitud inválida.");
  return value;
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = new Set([new URL(req.url).origin]);
  if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
  if (!origin || !allowed.has(origin))
    return json({ error: "Solicitud no autorizada." }, 403);
  try {
    const data = await body(req),
      a = await actor(req),
      db = getDb();
    let s = selection(data);
    const token = typeof data.token === "string" ? data.token : undefined;
    if (token && token.length > 400)
      throw new UserError("El enlace no es válido.");
    if (data.action === "load" && token && !s) {
      const c = await resolveCaseToken(db, token);
      if (!c) throw new UserError("El enlace venció o no es válido.");
      s = { kind: c.kind, id: c.id };
    }
    let current;
    if (data.action === "load" && s)
      current = await readChat(
        db,
        a.actor,
        s,
        token,
        typeof data.before === "string" ? data.before : undefined,
      );
    else if (data.action === "message")
      current = await sendChatMessage(db, a.actor, {
        selection: s,
        token,
        text: String(data.text ?? ""),
        nonce: String(data.nonce ?? ""),
        newCase: data.newCase === true,
        topic: typeof data.topic === "string" ? data.topic : undefined,
        source: data.source === "app" ? "app" : "site",
      });
    else if (data.action === "handoff" && s) {
      current = await handoffChat(
        db,
        a.actor,
        s,
        {
          name: String(data.name ?? ""),
          email: String(data.email ?? ""),
          area: String(data.area ?? "soporte"),
        },
        token,
      );
      await drainEmailOutbox(db, 5, 3000).catch((e) =>
        reportError("[chat receipt queued]", e),
      );
    } else if (data.action === "resolve" && s)
      current = await resolveBotChat(db, a.actor, s);
    else throw new UserError("Solicitud inválida.");
    return cookie(
      json({
        current,
        cases: await chatCases(db, a.actor),
        identity: a.actor.user
          ? { name: a.actor.user.name, email: a.actor.user.email }
          : null,
      }),
      a,
    );
  } catch (e) {
    if (!(e instanceof UserError)) reportError("[chat action]", e);
    return json(
      {
        error:
          e instanceof UserError
            ? e.message
            : "No pudimos guardar el mensaje. Intentá de nuevo; conservá el texto hasta verlo en el chat.",
      },
      e instanceof ChatAccessError ? 403 : e instanceof UserError ? 400 : 503,
    );
  }
}
