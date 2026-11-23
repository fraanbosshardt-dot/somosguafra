import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import {
  chatCases,
  chatHash,
  sendChatMessage,
  handoffChat,
  readChat,
  resolveBotChat,
  loadChatByCode,
  type ChatActor,
} from "@/server/guafra-chat";
import { matchChatHelp, containsChatSecret } from "@/lib/chat-help";
import { replyToContact } from "@/server/support-replies";
import { caseToken } from "@/server/support-thread";
import { unifiedInbox } from "@/server/support-inbox";
import { exportAccountData, deleteAccount } from "@/server/admin-accounts";
import { BOT_CHAT_IDLE_MS, botChatStatus } from "@/lib/chat-session";
let t: Awaited<ReturnType<typeof startTestDb>>;
const guest = (n: string): ChatActor => ({
  user: null,
  visitorHash: chatHash(n),
  ip: null,
});
const message = (a: ChatActor, text = "Cómo empezar", extra = {}) =>
  sendChatMessage(t.db, a, { text, nonce: crypto.randomUUID(), ...extra });
it("las guías de pantalla no reemplazan la bienvenida ni la derivación de pagos", () => {
  expect(matchChatHelp("Cómo empezar").topic?.id).toBe("start");
  expect(matchChatHelp("Cómo volver a ver la guía paso a paso").topic?.id).toBe("first-use-guides");
  expect(matchChatHelp("Pagué y no tengo acceso, necesito una guía paso a paso").escalate).toBe(true);
});
beforeAll(async () => {
  t = await startTestDb();
  vi.stubEnv("AUTH_SECRET", "chat-test-secret-at-least-32-characters");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await t?.stop();
});
it("consultar no crea sesiones ni casos; preguntas conocidas usan respuestas preparadas", async () => {
  const a = guest("read");
  expect(await chatCases(t.db, a)).toEqual([]);
  expect(await t.db.chatSession.count()).toBe(0);
  const c = await message(a);
  expect(c.messages.map((m) => m.role)).toEqual(["customer", "bot"]);
  expect(c.messages[1].topic).toBe("start");
  expect(c.human).toBe(false);
  expect(await t.db.contactMessage.count()).toBe(0);
});
it("el código no es credencial: visitante y otra cuenta no acceden al historial", async () => {
  const a = guest("private"),
    c = await message(a, "Tarjetas y cuotas");
  await expect(readChat(t.db, guest("other"), c)).rejects.toThrow(
    "No pudimos abrir",
  );
  expect(await loadChatByCode(t.db, guest("other"), c.code)).toBeNull();
  const u = await t.db.user.create({
      data: {
        email: "chat-owner@audit.invalid",
        name: "Fixture",
        passwordHash: "x",
      },
    }),
    actor: ChatActor = { user: u, visitorHash: null, ip: null };
  const own = await message(actor);
  await expect(readChat(t.db, a, own)).rejects.toThrow();
  await expect(readChat(t.db, actor, c)).rejects.toThrow();
  expect((await chatCases(t.db, actor)).map((x) => x.code)).toEqual([own.code]);
});

it("la inactividad finaliza solo consultas automáticas, conserva mensajes y permite retomarlas", async () => {
  const now = Date.now(), updated = new Date(now - BOT_CHAT_IDLE_MS);
  expect(botChatStatus(false, updated, now - 1)).toBe("BOT");
  expect(botChatStatus(false, updated, now)).toBe("CLOSED");
  expect(botChatStatus(true, updated, now)).toBe("RESOLVED");
  const a = guest("idle"), c = await message(a);
  await t.db.chatSession.update({ where: { id: c.id }, data: { updatedAt: updated } });
  const expired = await readChat(t.db, a, c);
  expect(expired).toMatchObject({ status: "CLOSED", inactive: true, resolved: true });
  expect(expired.messages).toEqual(c.messages);
  expect((await chatCases(t.db, a))[0].status).toBe("CLOSED");
  const inbox = await unifiedInbox(t.db, { channel: "bot", status: "all", page: 1, query: c.code });
  expect(inbox.rows[0].status).toBe("CLOSED");
  const reopened = await message(a, "Cómo cargo una cuenta", { selection: c });
  expect(reopened).toMatchObject({ id: c.id, status: "BOT", inactive: false });
  expect(reopened.messages).toHaveLength(c.messages.length + 2);
  await handoffChat(t.db, a, c, { name: "Fixture", email: "idle@audit.invalid", area: "soporte" });
  await t.db.chatSession.update({ where: { id: c.id }, data: { updatedAt: updated } });
  expect(await readChat(t.db, a, c)).toMatchObject({ status: "OPEN", human: true, inactive: false, resolved: false });
  expect((await chatCases(t.db, a))[0].status).toBe("OPEN");
});
it("reintentos concurrentes no duplican mensajes ni derivaciones y conservan todo el historial", async () => {
  const a = guest("dedupe"),
    nonce = crypto.randomUUID();
  const [c, retry] = await Promise.all([
    sendChatMessage(t.db, a, { text: "Pagué y no tengo acceso", nonce }),
    sendChatMessage(t.db, a, { text: "Pagué y no tengo acceso", nonce }),
  ]);
  expect(c.id).toBe(retry.id);
  expect(c.needsHuman).toBe(true);
  expect(c.messages).toHaveLength(2);
  const input = {
    name: "Persona de prueba",
    email: "chat-dedupe@audit.invalid",
    area: "pagos",
  };
  const [h1, h2] = await Promise.all([
    handoffChat(t.db, a, c, input),
    handoffChat(t.db, a, c, input),
  ]);
  expect(h1.code).toBe(h2.code);
  expect(h1.human).toBe(true);
  expect(await t.db.contactMessage.count({ where: { code: c.code } })).toBe(1);
  expect(h1.messages).toHaveLength(3);
  const contact = await t.db.contactMessage.findUniqueOrThrow({
    where: { code: c.code },
  });
  expect(contact.priority).toBe("HIGH");
  expect(await t.db.emailOutbox.count({ where: { to: input.email } })).toBe(0);
  await expect(resolveBotChat(t.db, a, c)).rejects.toThrow("equipo");
});
it("respuesta humana notifica sin copiar el contenido y permite reabrir el mismo caso", async () => {
  const a = guest("reply"),
    c = await message(a, "Necesito hablar con una persona");
  await handoffChat(t.db, a, c, {
    name: "Fixture",
    email: "chat-reply@audit.invalid",
    area: "soporte",
  });
  const contact = await t.db.contactMessage.findUniqueOrThrow({
    where: { code: c.code },
  });
  await t.db.supportMessage.create({
    data: {
      contactId: contact.id,
      role: "staff",
      internal: true,
      body: "Nota confidencial",
      dedupeKey: crypto.randomUUID(),
    },
  });
  await Promise.all([
    replyToContact(
      t.db,
      contact.id,
      "Respuesta privada de prueba",
      "https://example.invalid",
      "staff@audit.invalid",
    ),
    replyToContact(
      t.db,
      contact.id,
      "Respuesta privada de prueba",
      "https://example.invalid",
      "staff@audit.invalid",
    ),
  ]);
  const mail = await t.db.emailOutbox.findFirstOrThrow({
    where: { to: contact.email },
  });
  expect(mail.text).not.toContain("Respuesta privada");
  expect(mail.text).toContain("/consulta/");
  expect(await t.db.emailOutbox.count({ where: { to: contact.email } })).toBe(
    1,
  );
  const before = await readChat(t.db, a, c);
  expect(before.status).toBe("ANSWERED");
  expect(before.messages.some((m) => m.body === "Nota confidencial")).toBe(
    false,
  );
  await t.db.contactMessage.update({
    where: { id: contact.id },
    data: { status: "CLOSED" },
  });
  const reopened = await message(a, "Gracias, tengo otro detalle", {
    selection: c,
  });
  expect(reopened.status).toBe("OPEN");
  expect(reopened.code).toBe(c.code);
  expect(reopened.messages.at(-1)?.role).toBe("customer");
});
it("enlace firmado permite visitante sin cookie, pero no reemplaza la sesión de una cuenta", async () => {
  const a = guest("token"),
    c = await message(a);
  await handoffChat(t.db, a, c, {
    name: "Fixture",
    email: "chat-token@audit.invalid",
    area: "soporte",
  });
  const contact = await t.db.contactMessage.findUniqueOrThrow({
    where: { code: c.code },
  });
  const token = caseToken("contact", contact.id, contact.email)!;
  expect(
    (
      await readChat(
        t.db,
        guest("fresh-browser"),
        { kind: "contact", id: contact.id },
        token,
      )
    ).code,
  ).toBe(c.code);
  const u = await t.db.user.create({
    data: { email: "bound@audit.invalid", name: "Fixture", passwordHash: "x" },
  });
  await t.db.contactMessage.update({
    where: { id: contact.id },
    data: { userId: u.id },
  });
  await t.db.chatSession.update({
    where: { id: c.id },
    data: { userId: u.id, visitorHash: null },
  });
  await expect(
    readChat(t.db, guest("fresh-browser"), c, token),
  ).rejects.toThrow();
});
it("no permite usar cursor de otro caso ni filtra notas internas en la paginación", async () => {
  const a = guest("cursor"),
    c = await message(a),
    other = await message(guest("cursor-other"));
  await expect(
    readChat(t.db, a, c, undefined, other.messages[0].id),
  ).rejects.toThrow("parte de la conversación");
  const data = Array.from({ length: 105 }, (_, n) => ({
    chatId: c.id,
    role: "customer",
    body: `Mensaje ${n}`,
    dedupeKey: `page-${n}`,
    createdAt: new Date(1700000000000 + n),
  }));
  await t.db.supportMessage.createMany({ data });
  const latest = await readChat(t.db, a, c);
  expect(latest.messages).toHaveLength(100);
  expect(latest.hasOlder).toBe(true);
  const older = await readChat(t.db, a, c, undefined, latest.messages[0].id);
  expect(older.messages).toHaveLength(7);
  expect(older.hasOlder).toBe(false);
  expect(
    older.messages.some((m) => latest.messages.some((x) => x.id === m.id)),
  ).toBe(false);
});
it("no persiste claves y nunca convierte una pregunta sobre dinero en una operación", async () => {
  expect(containsChatSecret("mi contraseña es una-clave-ficticia")).toBe(true);
  await expect(
    message(guest("secret"), "mi contraseña es una-clave-ficticia"),
  ).rejects.toThrow("seguridad");
  expect(await chatCases(t.db, guest("secret"))).toEqual([]);
  for (const text of [
    "Me cobraron dos veces",
    "Quiero un reembolso",
    "Pagué y no tengo Pro",
    "Eliminar mi cuenta",
  ])
    expect(matchChatHelp(text).urgent).toBe(true);
  expect(matchChatHelp("problema desconocido")).toMatchObject({
    topic: null,
    escalate: true,
  });
  expect(await t.db.billingAgreement.count()).toBe(0);
  expect(await t.db.invoice.count()).toBe(0);
});
it("una urgencia posterior a la primera pregunta conserva prioridad y asunto al derivar", async () => {
  const a = guest("late-priority");
  let c = await message(a, "Cómo empezar");
  c = await message(a, "Me cobraron dos veces", { selection: c });
  await handoffChat(t.db, a, c, {
    name: "Fixture",
    email: "late@audit.invalid",
    area: "soporte",
  });
  const contact = await t.db.contactMessage.findUniqueOrThrow({
    where: { code: c.code },
  });
  expect(contact.priority).toBe("HIGH");
  expect(contact.area).toBe("pagos");
  expect(contact.subject).toBe("Me cobraron dos veces");
});
it("editar una guía no puede convertir un reclamo de dinero en una respuesta automática", async () => {
  await t.db.appSetting.create({
    data: {
      key: "chat-help:start",
      value: { answer: "Guía controlada por el equipo.", enabled: true },
    },
  });
  const a = guest("override"),
    c = await message(a, "Cómo empezar");
  expect(c.messages.at(-1)?.body).toBe("Guía controlada por el equipo.");
  const urgent = await message(a, "Pagué y no tengo acceso", {
    selection: c,
    topic: "start",
  });
  expect(urgent.needsHuman).toBe(true);
  expect(urgent.messages.at(-1)?.body).not.toContain("Guía controlada");
  await t.db.appSetting.update({
    where: { key: "chat-help:start" },
    data: { value: { enabled: false } },
  });
  const disabled = await message(guest("disabled"), "Cómo empezar");
  expect(disabled.needsHuman).toBe(true);
  await t.db.appSetting.delete({ where: { key: "chat-help:start" } });
});
it("limita altas de conversaciones sin impedir reintentar una ya guardada", async () => {
  const a = guest("limit");
  for (let i = 0; i < 6; i++)
    await message(a, "Consulta de prueba", { newCase: true });
  await expect(message(a, "Otra consulta", { newCase: true })).rejects.toThrow(
    "varios mensajes",
  );
});
it("la migración mantiene las escrituras de la versión anterior durante un despliegue", async () => {
  const u = await t.db.user.create({
    data: {
      name: "Fixture",
      email: "old-version@audit.invalid",
      passwordHash: "x",
    },
  });
  await t.db
    .$executeRaw`INSERT INTO "SupportTicket" (id,"userId",subject,body,"updatedAt") VALUES ('old-app-ticket',${u.id},'Fixture','Mensaje anterior',now())`;
  expect(
    (
      await t.db.supportTicket.findUniqueOrThrow({
        where: { id: "old-app-ticket" },
      })
    ).code,
  ).toMatch(/^SG-T-/);
});
it("bandeja unifica sin duplicar y busca código, canal y responsable antes de paginar", async () => {
  const a = guest("inbox"),
    c = await message(a, "Quiero reclamar");
  await handoffChat(t.db, a, c, {
    name: "Fixture bandeja",
    email: "inbox@audit.invalid",
    area: "reclamos",
  });
  const contact = await t.db.contactMessage.findUniqueOrThrow({
    where: { code: c.code },
  });
  await t.db.contactMessage.update({
    where: { id: contact.id },
    data: { assignedTo: "staff@audit.invalid" },
  });
  const inbox = await unifiedInbox(t.db, {
    page: 1,
    status: "all",
    query: c.code,
    assigned: "staff@audit.invalid",
  });
  expect(inbox.total).toBe(1);
  expect(inbox.rows[0].kind).toBe("contact");
  expect(
    (await unifiedInbox(t.db, { page: 1, channel: "bot", query: c.code }))
      .total,
  ).toBe(0);
});
it("exportación no revela hash de acceso ni notas; borrado limpia chats vinculados", async () => {
  const u = await t.db.user.create({
      data: {
        email: "chat-delete@audit.invalid",
        name: "A",
        passwordHash: "x",
      },
    }),
    a: ChatActor = { user: u, visitorHash: null, ip: null },
    c = await message(a);
  await handoffChat(t.db, a, c, {
    name: "Ignorado",
    email: "ignored@audit.invalid",
    area: "soporte",
  });
  const contact = await t.db.contactMessage.findUniqueOrThrow({
    where: { code: c.code },
  });
  expect(contact.email).toBe(u.email);
  await t.db.supportMessage.create({
    data: {
      contactId: contact.id,
      role: "staff",
      internal: true,
      body: "No exportar nota",
      dedupeKey: crypto.randomUUID(),
    },
  });
  await t.db.contactMessage.update({
    where: { id: contact.id },
    data: { assignedTo: "staff-private@audit.invalid" },
  });
  await replyToContact(
    t.db,
    contact.id,
    "Respuesta pública exportable",
    "https://example.invalid",
    "staff-private@audit.invalid",
  );
  const exportedData = await exportAccountData(t.db, u.id);
  expect(
    exportedData.chats[0].messages.some(
      (m) => m.body === "Respuesta pública exportable",
    ),
  ).toBe(true);
  const exported = JSON.stringify(exportedData);
  expect(exported).not.toContain("staff-private@audit.invalid");
  expect(exported).toContain(c.code);
  expect(exported).not.toContain("visitorHash");
  expect(exported).not.toContain("No exportar nota");
  await deleteAccount(t.db, u.id);
  expect(await t.db.chatSession.findUnique({ where: { id: c.id } })).toBeNull();
  expect(
    await t.db.contactMessage.findUnique({ where: { id: contact.id } }),
  ).toBeNull();
});

it("el resumen del panel incluye consultas del chat y estados de atención", async () => {
  const { overview } = await import("@/server/admin-metrics");
  const result = await overview(t.db, { monthly: 0, yearly: 0 });
  const status = { in: ["OPEN", "IN_PROGRESS", "WAITING_INTERNAL"] };
  const expected =
    (await t.db.supportTicket.count({ where: { status } })) +
    (await t.db.contactMessage.count({ where: { status } }));
  expect(result.openTickets).toBe(expected);
  expect(expected).toBeGreaterThan(0);
});

it("un mensaje nuevo impide cerrar un caso desde una pantalla desactualizada", async () => {
  const { updateSupportCase } = await import("@/server/support-case-state");
  const a = guest("stale-close"),
    c = await message(a, "Ayuda del equipo");
  await handoffChat(t.db, a, c, {
    name: "Fixture",
    email: "stale-close@audit.invalid",
    area: "soporte",
  });
  let contact = await t.db.contactMessage.findUniqueOrThrow({
    where: { code: c.code },
  });
  const old = contact.updatedAt.toISOString();
  await t.db.contactMessage.update({
    where: { id: contact.id },
    data: { updatedAt: new Date(contact.updatedAt.getTime() + 1000) },
  });
  await expect(
    updateSupportCase(t.db, {
      kind: "contact",
      id: contact.id,
      status: "CLOSED",
      priority: "NORMAL",
      revision: old,
    }),
  ).rejects.toThrow("caso cambió");
  contact = await t.db.contactMessage.findUniqueOrThrow({
    where: { id: contact.id },
  });
  expect(contact.status).toBe("OPEN");
  await updateSupportCase(t.db, {
    kind: "contact",
    id: contact.id,
    status: "RESOLVED",
    priority: "NORMAL",
    revision: contact.updatedAt.toISOString(),
  });
  expect((await readChat(t.db, a, c)).resolved).toBe(true);
});
