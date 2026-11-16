export const BOT_CHAT_IDLE_MS = 30 * 60 * 1000;

// Inactivity ends an automatic session, never a human support case or its history.
export function botChatStatus(resolved: boolean, updatedAt: Date, now = Date.now()) {
  if (resolved) return "RESOLVED";
  return now - updatedAt.getTime() >= BOT_CHAT_IDLE_MS ? "CLOSED" : "BOT";
}
