// Preferencias pequeñas del espacio: no contienen importes ni crean movimientos.
export type Favorite = { id: string; name: string; kind: "INCOME" | "EXPENSE"; accountId: string; categoryId: string | null };
export type CategoryRule = { id: string; contains: string; kind: "INCOME" | "EXPENSE"; categoryId: string };
export type Experience = { favorites: Favorite[]; rules: CategoryRule[] };
export const plainConcept = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
export function experienceFrom(modules: unknown): Experience {
  const root = modules && typeof modules === "object" ? modules as Record<string, unknown> : {};
  const p = root._experience && typeof root._experience === "object" ? root._experience as Record<string, unknown> : {};
  return {
    favorites: Array.isArray(p.favorites) ? p.favorites.filter((x): x is Favorite => !!x && typeof x === "object" && typeof x.id === "string" && typeof x.name === "string" && (x.kind === "INCOME" || x.kind === "EXPENSE") && typeof x.accountId === "string" && (x.categoryId === null || typeof x.categoryId === "string")).slice(0, 20) : [],
    rules: Array.isArray(p.rules) ? p.rules.filter((x): x is CategoryRule => !!x && typeof x === "object" && typeof x.id === "string" && typeof x.contains === "string" && (x.kind === "INCOME" || x.kind === "EXPENSE") && typeof x.categoryId === "string").slice(0, 30) : [],
  };
}
export function ruleSuggestion(rules: CategoryRule[], kind: string, description: string): string | null {
  const text = plainConcept(description);
  return rules.find(r => r.kind === kind && plainConcept(r.contains).length >= 3 && text.includes(plainConcept(r.contains)))?.categoryId ?? null;
}
