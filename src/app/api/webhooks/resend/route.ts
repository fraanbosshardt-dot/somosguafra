import { Webhook } from "svix";
import { getDb } from "@/lib/db";
import { customerReply, resolveCaseToken } from "@/server/support-thread";
export async function POST(req: Request) {
  if (process.env.SUPPORT_INBOUND_ENABLED !== "true" || !process.env.RESEND_WEBHOOK_SECRET || !process.env.SUPPORT_RECEIVING_DOMAIN || !process.env.RESEND_RECEIVING_API_KEY) return new Response("Recepción no habilitada", { status: 503 });
  if (Number(req.headers.get("content-length") ?? 0) > 65536) return new Response("Demasiado grande", { status: 413 });
  const raw = await req.text(); if (raw.length > 65536) return new Response("Demasiado grande", { status: 413 });
  type Incoming = { type: string; data: { email_id?: string; from?: string; to?: string[] } };
  let event: Incoming;
  try { new Webhook(process.env.RESEND_WEBHOOK_SECRET).verify(raw, { "svix-id": req.headers.get("svix-id") ?? "", "svix-timestamp": req.headers.get("svix-timestamp") ?? "", "svix-signature": req.headers.get("svix-signature") ?? "" }); event = JSON.parse(raw) as Incoming; if (!event || typeof event.type !== "string" || !event.data) throw new Error("invalid-event"); }
  catch { return new Response("Firma inválida", { status: 401 }); }
  if (event.type !== "email.received") return Response.json({ ignored: true });
  const id = event.data?.email_id;
  if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !Array.isArray(event.data.to)) return new Response("Evento inválido", { status: 400 });
  const domain = process.env.SUPPORT_RECEIVING_DOMAIN.toLowerCase();
  const recipient = event.data.to.find(to => to.toLowerCase().endsWith(`@${domain}`));
  if (!recipient) return Response.json({ ignored: true });
  const token = recipient.slice(0, recipient.lastIndexOf("@")); const db = getDb(); const c = await resolveCaseToken(db, token);
  const sender = (event.data.from?.match(/<([^>]+)>/)?.[1] ?? event.data.from ?? "").trim().toLowerCase();
  if (!c || sender !== c.email.toLowerCase()) return Response.json({ ignored: true });
  if (await db.supportMessage.findUnique({ where: { dedupeKey: `resend/${id}` } })) return Response.json({ ok: true });
  const result = await fetch(`https://api.resend.com/emails/receiving/${id}`, { headers: { authorization: `Bearer ${process.env.RESEND_RECEIVING_API_KEY}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!result.ok) return new Response("Reintentar recepción", { status: 502 });
  const email = await result.json() as { text?: string; headers?: Record<string, string> };
  const h = Object.fromEntries(Object.entries(email.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  if ((h["auto-submitted"] && h["auto-submitted"].toLowerCase() !== "no") || /bulk|list|junk/i.test(h.precedence ?? "")) return Response.json({ ignored: true });
  const body = email.text?.trim().slice(0, 5000);
  if (!body || body.length < 2) return Response.json({ ignored: true });
  await customerReply(db, c.kind, c.id, body, id, `resend/${id}`);
  return Response.json({ ok: true });
}
