type Attempt = { status: string; createdAt: Date; cancelRequestedAt?: Date | null };
// Clasificación comercial calculada; no cambia el contrato ni llama al proveedor.
export function checkoutFollowup(attempt: Attempt, now = new Date()) {
  if (attempt.cancelRequestedAt) return { key: "review", label: "Cierre en verificación" };
  if (["creating", "uncertain"].includes(attempt.status)) return { key: "review", label: "Requiere verificación" };
  if (attempt.status === "pending") return now.getTime() - attempt.createdAt.getTime() >= 24 * 3600_000
    ? { key: "incomplete", label: "Contratación sin completar" }
    : { key: "pending", label: "Solicitud pendiente" };
  if (attempt.status === "authorized") return { key: "converted", label: "Autorizada" };
  if (attempt.status === "paused") return { key: "review", label: "Contrato pausado" };
  return { key: "closed", label: "Intento cerrado" };
}
