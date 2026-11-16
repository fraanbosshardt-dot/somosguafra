import { expect, it } from "vitest";
import { mergeChatHistory } from "@/lib/chat-history";
import type { ChatView } from "@/server/guafra-chat";
const view = (ids: number[], hasOlder = false, id = "one"): ChatView => ({
  id,
  kind: "chat",
  code: "SG-ONE",
  area: "soporte",
  status: "BOT",
  human: false,
  resolved: false,
  needsHuman: false,
  hasOlder,
  messages: ids.map((n) => ({
    id: String(n),
    at: new Date(1700000000000 + n).toISOString(),
    role: "customer",
    body: `Mensaje ${n}`,
    topic: null,
  })),
});
it("sondeo conserva páginas anteriores sin duplicar mensajes", () => {
  expect(
    mergeChatHistory(view([1, 2, 3]), view([3, 4], true))?.messages.map(
      (m) => m.id,
    ),
  ).toEqual(["1", "2", "3", "4"]);
  expect(mergeChatHistory(view([1, 2, 3]), view([3, 4], true))?.hasOlder).toBe(
    false,
  );
});
it("cargar anteriores conserva los recientes y el cursor de la página más antigua", () => {
  const c = mergeChatHistory(view([3, 4], true), view([1, 2]), true)!;
  expect(c.messages.map((m) => m.id)).toEqual(["1", "2", "3", "4"]);
  expect(c.hasOlder).toBe(false);
});
it("no mezcla cuentas/casos y elimina mensajes cuando el acceso se revoca", () => {
  expect(
    mergeChatHistory(view([1, 2]), view([5], false, "other"))?.messages.map(
      (m) => m.id,
    ),
  ).toEqual(["5"]);
  expect(mergeChatHistory(view([1]), null)).toBeNull();
});
