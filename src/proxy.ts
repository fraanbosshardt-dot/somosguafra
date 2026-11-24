import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { PREFERENCE_SCRIPT } from "@/lib/preference-script";
const preferenceHash = createHash("sha256").update(PREFERENCE_SCRIPT).digest("base64");

// Las páginas privadas son dinámicas: cada respuesta recibe un nonce distinto.
// Las páginas públicas conservan su caché y su política estática.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'sha256-${preferenceHash}' 'strict-dynamic'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'",
    "frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'",
    "form-action 'self' https://*.mercadopago.com https://*.mercadopago.com.ar",
    "worker-src 'self'", "manifest-src 'self'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("x-audit-path", request.nextUrl.pathname);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/movil/:path*", "/admin/:path*", "/consulta/:path*", "/soporte/:path*", "/ingresar", "/registro", "/recuperar/:path*", "/verificar", "/confirmar-correo", "/continuar-compra", "/bienvenida", "/invitacion/:path*"],
};
