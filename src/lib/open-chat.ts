// Conserva un toque si la cabecera ya está lista y el widget todavía está cargando.
let pending: { code?: string } | null = null;
export function hasChatOpen() { return pending !== null; }
export function requestChatOpen(code?: string) {
  pending = { code };
  window.dispatchEvent(new CustomEvent("guafra:open", { detail: code }));
}
export function takeChatOpen() {
  const request = pending;
  pending = null;
  return request;
}
