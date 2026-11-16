const PAYMENTS: Record<string, string> = { approved: "Aprobado", pending: "Pendiente", in_process: "En proceso", authorized: "Autorizado", rejected: "Rechazado", refunded: "Devuelto", charged_back: "Contracargo", cancelled: "Cancelado", canceled: "Cancelado", in_mediation: "En revisión" };
const SUBSCRIPTIONS: Record<string, string> = { ACTIVE: "Activa", TRIALING: "Período gratuito", PAST_DUE: "Pago pendiente", CANCELED: "Renovación cancelada" };
export const paymentLabel = (status: string) => PAYMENTS[status] ?? "En verificación";
export const subscriptionLabel = (status: string) => SUBSCRIPTIONS[status] ?? "En verificación";
