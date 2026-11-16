import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { caseLinks, customerReply, resolveCaseToken } from "./support-thread";
import {
  CHAT_TOPICS,
  containsChatSecret,
  matchChatHelp,
} from "@/lib/chat-help";
import { reserveSecurityAttempt } from "./security-limits";
import { BRAND } from "@/lib/brand";
import { effectivePlan } from "./plans";

type Store = Prisma.TransactionClient;
export type ChatActor = {
  user: null | { id: string; name: string; email: string };
  visitorHash: string | null;
  ip: string | null;
};
export type ChatSelection = { kind: "chat" | "ticket" | "contact"; id: string };
export type ChatMessageView = {
  id: string;
  role: string;
  body: string;
  topic: string | null;
  at: string;
};
export type ChatView = ChatSelection & {
  code: string;
  status: string;
  human: boolean;
  resolved: boolean;
  area: string;
  needsHuman: boolean;
  messages: ChatMessageView[];
  hasOlder: boolean;
};
export const chatHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const supportCode = () =>
  `SG-${randomBytes(6).toString("hex").toUpperCase()}`;
const validId = (v: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const identity = (a: ChatActor) =>
  a.user ? `user:${a.user.id}` : `visitor:${a.visitorHash ?? "missing"}`;
const owned = (a: ChatActor) =>
  a.user
    ? { userId: a.user.id }
    : { userId: null, visitorHash: a.visitorHash ?? "missing" };
export class ChatAccessError extends UserError {}
const fail = () => {
  throw new ChatAccessError(
    "No pudimos abrir esta conversación. Ingresá con tu cuenta o usá el enlace privado del correo.",
  );
};
async function authorize(
  db: Store,
  a: ChatActor,
  s: ChatSelection,
  token?: string,
): Promise<ChatSelection> {
  if (!validId(s.id)) return fail();
  if (token) {
    const c = await resolveCaseToken(db as Db, token);
    if (!c) return fail();
    const owner =
      c.kind === "ticket"
        ? "userId" in c.item
          ? c.item.userId
          : null
        : "userId" in c.item
          ? c.item.userId
          : null;
    if (owner && owner !== a.user?.id) return fail();
    if (c.kind === "contact") {
      const chat = await db.chatSession.findUnique({
        where: { contactId: c.id },
        select: { id: true },
      });
      const resolved: ChatSelection = chat
        ? { kind: "chat", id: chat.id }
        : { kind: "contact", id: c.id };
      if (
        (s.kind === resolved.kind && s.id === resolved.id) ||
        (s.kind === "contact" && s.id === c.id)
      )
        return resolved;
    } else if (s.kind === "ticket" && s.id === c.id) return s;
    return fail();
  }
  if (s.kind === "chat")
    return (await db.chatSession.findFirst({
      where: { id: s.id, ...owned(a) },
      select: { id: true },
    }))
      ? s
      : fail();
  if (!a.user) return fail();
  if (s.kind === "ticket")
    return (await db.supportTicket.findFirst({
      where: { id: s.id, userId: a.user.id },
      select: { id: true },
    }))
      ? s
      : fail();
  const contact = await db.contactMessage.findFirst({
    where: { id: s.id, userId: a.user.id },
    include: { chatSession: { select: { id: true } } },
  });
  if (!contact) return fail();
  return contact.chatSession ? { kind: "chat", id: contact.chatSession.id } : s;
}
async function view(
  db: Store,
  s: ChatSelection,
  before?: string,
): Promise<ChatView> {
  let code: string,
    status: string,
    human: boolean,
    resolved: boolean,
    area = "soporte",
    initial: string | null = null,
    initialAt = new Date(),
    legacyReply: string | null = null;
  let where: Prisma.SupportMessageWhereInput;
  if (s.kind === "chat") {
    const c = await db.chatSession.findUniqueOrThrow({
      where: { id: s.id },
      include: { contact: true },
    });
    code = c.code;
    status = c.contact?.status ?? (c.botResolved ? "RESOLVED" : "BOT");
    human = !!c.contactId;
    resolved = c.contact
      ? ["RESOLVED", "CLOSED"].includes(c.contact.status)
      : c.botResolved;
    area = c.contact?.area ?? "soporte";
    where = {
      OR: [
        { chatId: c.id },
        ...(c.contactId ? [{ contactId: c.contactId }] : []),
      ],
    };
  } else {
    const c =
      s.kind === "ticket"
        ? await db.supportTicket.findUniqueOrThrow({ where: { id: s.id } })
        : await db.contactMessage.findUniqueOrThrow({ where: { id: s.id } });
    code = c.code;
    status = c.status;
    human = true;
    resolved = ["RESOLVED", "CLOSED"].includes(c.status);
    initial = c.body;
    initialAt = c.createdAt;
    legacyReply = c.reply;
    area = "area" in c ? c.area : "soporte";
    where = s.kind === "ticket" ? { ticketId: c.id } : { contactId: c.id };
  }
  const publicWhere = { ...where, internal: false };
  if (
    before &&
    !(await db.supportMessage.findFirst({
      where: { ...publicWhere, id: before },
      select: { id: true },
    }))
  )
    throw new UserError("No se encontró esa parte de la conversación.");
  const list = await db.supportMessage.findMany({
    where: publicWhere,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 101,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
  });
  const hasOlder = list.length > 100;
  if (hasOlder) list.pop();
  list.reverse();
  const messages: ChatMessageView[] = list.map((m) => ({
    id: m.id,
    role: m.role,
    body: m.body,
    topic: m.botTopic,
    at: m.createdAt.toISOString(),
  }));
  if (initial && !hasOlder)
    messages.unshift({
      id: `initial-${s.id}`,
      role: "customer",
      body: initial,
      topic: null,
      at: initialAt.toISOString(),
    });
  if (
    legacyReply &&
    !(await db.supportMessage.count({
      where: { ...publicWhere, role: "staff" },
    }))
  )
    messages.push({
      id: `legacy-${s.id}`,
      role: "staff",
      body: legacyReply,
      topic: null,
      at: initialAt.toISOString(),
    });
  const lastBot = [...messages].reverse().find((m) => m.role === "bot");
  if (!human)
    area = matchChatHelp(
      [...messages].reverse().find((m) => m.role === "customer")?.body ?? "",
    ).area;
  return {
    ...s,
    code,
    status,
    human,
    resolved,
    area,
    messages,
    hasOlder,
    needsHuman: !human && lastBot?.topic === "handoff",
  };
}
export async function readChat(
  db: Db,
  a: ChatActor,
  s: ChatSelection,
  token?: string,
  before?: string,
) {
  return db.$transaction(
    async (tx) => view(tx, await authorize(tx, a, s, token), before),
    { isolationLevel: "RepeatableRead" },
  );
}
export async function chatCases(db: Db, a: ChatActor) {
  const [chats, tickets, contacts] = await Promise.all([
    db.chatSession.findMany({
      where: owned(a),
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        code: true,
        botResolved: true,
        updatedAt: true,
        contact: { select: { status: true, subject: true } },
      },
    }),
    a.user
      ? db.supportTicket.findMany({
          where: { userId: a.user.id },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            code: true,
            status: true,
            subject: true,
            updatedAt: true,
          },
        })
      : [],
    a.user
      ? db.contactMessage.findMany({
          where: { userId: a.user.id, chatSession: null },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            code: true,
            status: true,
            subject: true,
            updatedAt: true,
          },
        })
      : [],
  ]);
  return [
    ...chats.map((c) => ({
      kind: "chat" as const,
      id: c.id,
      code: c.code,
      status: c.contact?.status ?? (c.botResolved ? "RESOLVED" : "BOT"),
      subject: c.contact?.subject ?? "Conversación con Guafra",
      at: c.updatedAt.toISOString(),
    })),
    ...tickets.map((c) => ({
      ...c,
      kind: "ticket" as const,
      at: c.updatedAt.toISOString(),
      updatedAt: undefined,
    })),
    ...contacts.map((c) => ({
      ...c,
      kind: "contact" as const,
      at: c.updatedAt.toISOString(),
      updatedAt: undefined,
    })),
  ]
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 30);
}
export async function loadChatByCode(db: Db, a: ChatActor, code: string) {
  if (!/^[a-zA-Z0-9-]{3,100}$/.test(code)) return null;
  const chat = await db.chatSession.findFirst({
    where: { code, ...owned(a) },
    select: { id: true },
  });
  if (chat) return readChat(db, a, { kind: "chat", id: chat.id });
  if (!a.user) return null;
  const ticket = await db.supportTicket.findFirst({
    where: { code, userId: a.user.id },
    select: { id: true },
  });
  if (ticket) return readChat(db, a, { kind: "ticket", id: ticket.id });
  const contact = await db.contactMessage.findFirst({
    where: { code, userId: a.user.id },
    select: { id: true },
  });
  return contact ? readChat(db, a, { kind: "contact", id: contact.id }) : null;
}
async function quota(db: Db, a: ChatActor, scope: string, limit: number) {
  if (!a.user && !a.visitorHash)
    throw new UserError("Volvé a abrir el chat para continuar.");
  if (
    !(await reserveSecurityAttempt(db, scope, [
      { key: identity(a), limit, windowMs: 3600_000 },
      ...(a.ip
        ? [{ key: `ip:${a.ip}`, limit: limit * 3, windowMs: 3600_000 }]
        : []),
    ]))
  )
    throw new UserError(
      "Recibimos varios mensajes seguidos. Esperá unos minutos para continuar.",
    );
}
export async function sendChatMessage(
  db: Db,
  a: ChatActor,
  input: {
    selection?: ChatSelection;
    token?: string;
    text: string;
    nonce: string;
    newCase?: boolean;
    topic?: string;
    source?: string;
  },
) {
  const text = input.text.trim().normalize("NFC");
  if (
    text.length < 2 ||
    text.length > 3000 ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(input.nonce)
  )
    throw new UserError("Escribí un mensaje de entre 2 y 3000 caracteres.");
  if (containsChatSecret(text))
    throw new UserError(
      "Por seguridad, quitá contraseñas, claves o códigos privados antes de enviar el mensaje.",
    );
  if (input.selection) {
    const selection = await db.$transaction((tx) =>
      authorize(tx, a, input.selection!, input.token),
    );
    const chat =
      selection.kind === "chat"
        ? await db.chatSession.findUniqueOrThrow({
            where: { id: selection.id },
          })
        : null;
    if (selection.kind !== "chat" || chat?.contactId) {
      await quota(db, a, "chat-message", 100);
      await customerReply(
        db,
        selection.kind === "ticket" ? "ticket" : "contact",
        selection.kind === "chat" ? chat!.contactId! : selection.id,
        text,
        input.nonce,
      );
      return readChat(db, a, selection, input.token);
    }
  }
  const key = `guafra/${chatHash(identity(a))}/${input.nonce}`;
  const prior = await db.supportMessage.findUnique({
    where: { dedupeKey: key },
    select: { chatId: true },
  });
  if (prior?.chatId)
    return readChat(db, a, { kind: "chat", id: prior.chatId }, input.token);
  await quota(db, a, "chat-message", 100);
  if (
    input.newCase ||
    (!input.selection && !(await db.chatSession.count({ where: owned(a) })))
  )
    await quota(db, a, "chat-start", 6);
  const chatId = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`chat:${identity(a)}`}))`;
    const repeated = await tx.supportMessage.findUnique({
      where: { dedupeKey: key },
      select: { chatId: true },
    });
    if (repeated?.chatId) return repeated.chatId;
    let id = input.selection?.id;
    if (id) {
      await tx.$queryRaw`SELECT id FROM "ChatSession" WHERE id=${id} FOR UPDATE`;
      await authorize(tx, a, { kind: "chat", id }, input.token);
    } else if (!input.newCase)
      id = (
        await tx.chatSession.findFirst({
          where: owned(a),
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        })
      )?.id;
    const c = id
      ? await tx.chatSession.findUniqueOrThrow({ where: { id } })
      : await tx.chatSession.create({
          data: {
            code: supportCode(),
            userId: a.user?.id,
            visitorHash: a.user ? null : a.visitorHash,
            source: input.source === "app" ? "app" : "site",
          },
        });
    if (c.contactId)
      throw new UserError(
        "Actualizá el chat para continuar el caso que ya está con el equipo.",
      );
    if (
      (await tx.supportMessage.count({
        where: {
          chatId: c.id,
          createdAt: { gt: new Date(Date.now() - 864e5) },
        },
      })) >= 200
    )
      throw new UserError(
        "Esta conversación recibió muchos mensajes hoy. Podés continuar más tarde.",
      );
    await tx.supportMessage.create({
      data: { chatId: c.id, role: "customer", body: text, dedupeKey: key },
    });
    const match = matchChatHelp(text);
    const topic = match.urgent
      ? null
      : (CHAT_TOPICS.find((t) => t.id === input.topic) ?? match.topic);
    const setting = topic
      ? await tx.appSetting.findUnique({
          where: { key: `chat-help:${topic.id}` },
        })
      : null;
    const override = setting?.value as
      | { answer?: unknown; enabled?: boolean }
      | undefined;
    const answer = override?.enabled === false ? null : topic;
    const body = match.urgent
      ? "Esto necesita revisión del equipo. No puedo confirmar cobros, devoluciones ni cambios de cuenta por chat automático. Contanos qué pasó y elegí “Hablar con el equipo” para registrar el caso."
      : answer
        ? typeof override?.answer === "string" && override.answer.trim()
          ? override.answer.trim().slice(0, 2000)
          : answer.answer
        : "No tengo una respuesta confirmada para esa consulta. Podés escribir todo el detalle y pedir atención del equipo; conservaremos esta conversación para que no tengas que repetirla.";
    await tx.supportMessage.create({
      data: {
        chatId: c.id,
        role: "bot",
        body,
        botTopic:
          match.urgent || !answer || match.escalate ? "handoff" : answer.id,
        dedupeKey: `${key}/bot`,
      },
    });
    await tx.chatSession.update({
      where: { id: c.id },
      data: { botResolved: false },
    });
    return c.id;
  });
  return readChat(db, a, { kind: "chat", id: chatId }, input.token);
}
export async function handoffChat(
  db: Db,
  a: ChatActor,
  s: ChatSelection,
  input: { name: string; email: string; area: string },
  token?: string,
) {
  if (s.kind !== "chat") return readChat(db, a, s, token);
  const existing = await db.$transaction(async (tx) => {
    await authorize(tx, a, s, token);
    return tx.chatSession.findUniqueOrThrow({
      where: { id: s.id },
      select: { contactId: true },
    });
  });
  if (existing.contactId) return readChat(db, a, s, token);
  const name = (a.user?.name ?? input.name).trim(),
    email = (a.user?.email ?? input.email).trim().toLowerCase();
  if (
    name.length < 2 ||
    name.length > 120 ||
    email.length > 200 ||
    !/^\S+@\S+\.\S+$/.test(email)
  )
    throw new UserError(
      "Dejanos tu nombre y un correo válido para avisarte cuando respondamos.",
    );
  await quota(db, a, "chat-handoff", 5);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ChatSession" WHERE id=${s.id} FOR UPDATE`;
    await authorize(tx, a, s, token);
    const c = await tx.chatSession.findUniqueOrThrow({ where: { id: s.id } });
    if (c.contactId) return;
    const first = await tx.supportMessage.findFirst({
      where: { chatId: c.id, role: "customer" },
      orderBy: { createdAt: "asc" },
    });
    if (!first)
      throw new UserError("Escribí primero el motivo de la consulta.");
    const customerMessages = await tx.supportMessage.findMany({
      where: { chatId: c.id, role: "customer" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    const urgentMatch = customerMessages
      .map((m) => matchChatHelp(m.body))
      .find((m) => m.urgent);
    const inferred =
      urgentMatch ?? matchChatHelp(customerMessages[0]?.body ?? first.body);
    const requested = [
      "soporte",
      "pagos",
      "privacidad",
      "reclamos",
      "arrepentimiento",
    ].includes(input.area)
      ? input.area
      : "soporte";
    const area = requested === "soporte" ? inferred.area : requested;
    const owner = a.user
      ? await tx.membership.findFirst({
          where: { userId: a.user.id, role: "OWNER" },
          include: { workspace: { include: { subscription: true } } },
        })
      : null;
    const urgent =
      area !== "soporte" ||
      !!urgentMatch ||
      effectivePlan(owner?.workspace.subscription) === "PRO";
    const m = await tx.contactMessage.create({
      data: {
        code: c.code,
        name,
        email,
        area,
        subject: (customerMessages[0]?.body ?? first.body)
          .replace(/\s+/g, " ")
          .slice(0, 140),
        body: first.body,
        userId: a.user?.id,
        priority: urgent ? "HIGH" : "NORMAL",
      },
    });
    await tx.supportMessage.updateMany({
      where: { chatId: c.id },
      data: { contactId: m.id },
    });
    await tx.chatSession.update({
      where: { id: c.id },
      data: {
        contactId: m.id,
        userId: a.user?.id ?? c.userId,
        visitorHash: a.user ? null : c.visitorHash,
        botResolved: false,
      },
    });
    await tx.supportMessage.create({
      data: {
        chatId: c.id,
        contactId: m.id,
        role: "bot",
        body: `Tu caso ${c.code} quedó registrado. El equipo verá toda esta conversación. ${BRAND.supportHours}. Te avisaremos por correo cuando respondamos para que vuelvas a este mismo chat.`,
        dedupeKey: `chat-handoff/${c.id}`,
      },
    });
    if (["arrepentimiento", "privacidad", "reclamos"].includes(area)) {
      const links = caseLinks(
        "contact",
        m.id,
        m.email,
        (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
        7,
      );
      await tx.emailOutbox.create({
        data: {
          dedupeKey: `chat-formal/${c.id}`,
          purpose: "support",
          to: email,
          subject: `Recibimos tu solicitud · ${c.code}`,
          text: `Recibimos tu solicitud. Código de caso: ${c.code}. Esta es una constancia de recepción; no confirma una baja ni una devolución. Podés continuar en ${links.url}\n\n${BRAND.supportHours}.`,
        },
      });
    }
  });
  return readChat(db, a, s, token);
}
export async function resolveBotChat(db: Db, a: ChatActor, s: ChatSelection) {
  await db.$transaction(async (tx) => {
    await authorize(tx, a, s);
    if (s.kind !== "chat")
      throw new UserError("El equipo gestiona el estado de este caso.");
    if (
      !(await tx.chatSession
        .updateMany({
          where: { id: s.id, contactId: null },
          data: { botResolved: true },
        })
        .then((r) => r.count))
    )
      throw new UserError("El equipo gestiona el estado de este caso.");
  });
  return readChat(db, a, s);
}
