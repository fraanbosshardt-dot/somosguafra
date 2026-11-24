import Link from "next/link";

export function WealthTabs({ on }: { on: "pat" | "inv" }) {
  return (
    <nav className="mv-chips" aria-label="Patrimonio">
      <Link href="/movil/explorar/patrimonio" className={on === "pat" ? "on" : ""}>Patrimonio neto</Link>
      <Link href="/movil/explorar/inversiones" className={on === "inv" ? "on" : ""}>Inversiones</Link>
    </nav>
  );
}
