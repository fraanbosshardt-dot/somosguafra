import { createHmac, timingSafeEqual } from "node:crypto";
export const COMMUNICATION_CONSENT_VERSION = "2026-11-24";
export type CommunicationChoices = { tips: boolean; news: boolean; offers: boolean };
export const NO_OPTIONAL_EMAIL: CommunicationChoices = { tips:false,news:false,offers:false };
export function unsubscribeToken(userId: string, secret = process.env.AUTH_SECRET) {
  if (!secret || secret.length < 32) throw new Error("Falta configuración segura de comunicaciones.");
  return `${userId}.${createHmac("sha256",secret).update(`optional-email-unsubscribe/v1/${userId}`).digest("base64url")}`;
}
export function unsubscribeIdentity(token: string, secret = process.env.AUTH_SECRET): string | null {
  const id = token.split(".")[0];
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || token.length > 200) return null;
  try { const expected = Buffer.from(unsubscribeToken(id,secret)); const actual = Buffer.from(token); return actual.length === expected.length && timingSafeEqual(actual,expected) ? id : null; } catch { return null; }
}
