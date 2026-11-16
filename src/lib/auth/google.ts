// Ingreso con Google (OpenID Connect, flujo con código + PKCE). Sin librerías: solo fetch al servidor de Google.
// Se activa cargando GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.
import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey } from "node:crypto";

export const GOOGLE_COOKIE = "somosguafra_g";
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const googleRedirectUri = (base: string) => `${base}/api/auth/google/callback`;

const b64 = (n: number) => randomBytes(n).toString("base64url");

export type GoogleStart = { state: string; verifier: string; nonce: string; desde: "ingresar" | "registro" | "admin" };

export function startGoogle(base: string, desde: GoogleStart["desde"]) {
  const st: GoogleStart = { state: b64(24), verifier: b64(48), nonce: b64(24), desde };
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(base),
    response_type: "code",
    scope: "openid email profile",
    state: st.state,
    nonce: st.nonce,
    code_challenge: createHash("sha256").update(st.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, cookie: JSON.stringify(st) };
}

export function readStart(raw: string | undefined): GoogleStart | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.state === "string" && typeof v?.verifier === "string" && typeof v?.nonce === "string" ? { ...v, desde: v.desde === "registro" || v.desde === "admin" ? v.desde : "ingresar" } : null;
  } catch {
    return null;
  }
}

export type GoogleProfile = { sub: string; email: string; name: string };

type GoogleKey = JsonWebKey & { kid?: string; alg?: string; use?: string };
// La clave solo puede venir del JWKS oficial; nunca de jku/x5u enviados en el token.
export function checkIdToken(idToken: string, opts: { clientId: string; nonce: string; now?: number; keys?: GoogleKey[] }): GoogleProfile | null {
  if (idToken.length > 16_384) return null;
  const pieces = idToken.split(".");
  const [head, part, signature] = pieces;
  if (pieces.length !== 3 || !head || !part || !signature) return null;
  let p: Record<string, unknown>;
  try {
    const h = JSON.parse(Buffer.from(head, "base64url").toString("utf8"));
    if (h.alg !== "RS256" || typeof h.kid !== "string") return null;
    const key = opts.keys?.find(k => k.kid === h.kid && k.kty === "RSA" && (!k.alg || k.alg === "RS256") && (!k.use || k.use === "sig"));
    if (!key || !verify("RSA-SHA256", Buffer.from(`${head}.${part}`), createPublicKey({ key, format: "jwk" }), Buffer.from(signature, "base64url"))) return null;
    p = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (p.iss !== "https://accounts.google.com" && p.iss !== "accounts.google.com") return null;
  if (p.aud !== opts.clientId) return null;
  if (p.azp !== undefined && p.azp !== opts.clientId) return null;
  if (typeof p.exp !== "number" || p.exp < now - 60) return null;
  if (typeof p.iat !== "number" || p.iat > now + 60 || p.iat < now - 86400) return null;
  if (p.nonce !== opts.nonce) return null;
  if (p.email_verified !== true && p.email_verified !== "true") return null;
  if (typeof p.sub !== "string" || !p.sub || typeof p.email !== "string" || !p.email.includes("@")) return null;
  const email = p.email.trim().toLowerCase();
  const name = (typeof p.name === "string" && p.name.trim()) || email.split("@")[0];
  return { sub: p.sub, email, name: name.slice(0, 80) };
}

let keyCache: { keys: GoogleKey[]; fetchedAt: number; expiresAt: number } | undefined;
let fetchingKeys: Promise<GoogleKey[]> | undefined;
async function googleKeys(force = false): Promise<GoogleKey[]> {
  const now = Date.now();
  if (keyCache && keyCache.expiresAt > now && (!force || now - keyCache.fetchedAt < 60_000)) return keyCache.keys;
  if (fetchingKeys) return fetchingKeys;
  fetchingKeys = (async () => {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/certs", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error("No se pudo verificar la identidad con Google.");
    const raw = await r.text();
    if (raw.length > 65536) throw new Error("Respuesta de identidad inválida.");
    const value = JSON.parse(raw) as { keys?: GoogleKey[] };
    if (!Array.isArray(value.keys) || !value.keys.length || value.keys.length > 20) throw new Error("Respuesta de identidad inválida.");
    const maxAge = Number(r.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ?? 600);
    keyCache = { keys: value.keys, fetchedAt: now, expiresAt: now + Math.max(60, Math.min(3600, maxAge)) * 1000 };
    return value.keys;
  })();
  try { return await fetchingKeys; } finally { fetchingKeys = undefined; }
}

export async function verifyGoogleIdToken(idToken: string, opts: { clientId: string; nonce: string }) {
  try {
    const keys = await googleKeys();
    const first = checkIdToken(idToken, { ...opts, keys });
    if (first) return first;
    // Una clave recién rotada puede no estar en la caché; no repetir la consulta
    // por cada token inválido y no aceptar datos con firma sin comprobar.
    const refreshed = await googleKeys(true);
    return refreshed === keys ? null : checkIdToken(idToken, { ...opts, keys: refreshed });
  } catch { return null; }
}

export async function exchangeCode(code: string, verifier: string, base: string): Promise<string | null> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(base),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { id_token?: string };
  return j.id_token ?? null;
}
