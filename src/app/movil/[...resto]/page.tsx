import { redirect } from "next/navigation";

// Puente temporal mientras se construyen las pantallas de la app: lo que todavía no existe en /movil
// abre su equivalente de la web. Cada pantalla nueva de /movil tiene su propia ruta y deja de pasar por acá.
const BRIDGE: [RegExp, (m: RegExpMatchArray, q: URLSearchParams) => string][] = [
  [/^buscar$/, () => "/app/buscar"],
uentas\/nueva/d
uentas\/nueva/d
uentas\/nueva/d
];

export default async function Bridge({ params, searchParams }: { params: Promise<{ resto: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const path = (await params).resto.join("/");
  const sp = await searchParams;
  const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])));
  for (const [re, to] of BRIDGE) {
    const m = path.match(re);
    if (m) redirect(to(m, q));
  }
  redirect("/movil");
}
