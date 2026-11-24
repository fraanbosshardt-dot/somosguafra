import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "../(app)/movil.css";

// Pantallas de la app que no piden sesión: ingresar, crear cuenta, verificación y bienvenida.
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { default: "Somos Guafra", template: "%s · Somos Guafra" } };
export const viewport: Viewport = { themeColor: "#F6F7F5", viewportFit: "cover" };
export const dynamic = "force-dynamic";

const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });

export default function AccesoLayout({ children }: { children: React.ReactNode }) {
  return <div className={`mv ${manrope.variable}`}>{children}</div>;
}
