import type { ChatView } from "@/server/guafra-chat";
// Polling keeps previously loaded older pages; a case switch never merges histories.
export function mergeChatHistory(
  previous: ChatView | null,
  next: ChatView | null,
  older = false,
): ChatView | null {
  if (
    !next ||
    !previous ||
    next.kind !== previous.kind ||
    next.id !== previous.id
  )
    return next;
  const first = next.messages[0];
  const retained = !!first && previous.messages.some((m) => m.at < first.at);
  const messages = [
    ...new Map(
      [...previous.messages, ...next.messages].map((m) => [m.id, m]),
    ).values(),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return {
    ...next,
    messages,
    hasOlder: older
      ? next.hasOlder
      : retained
        ? previous.hasOlder
        : next.hasOlder,
  };
}
