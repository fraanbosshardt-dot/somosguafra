import { searchText } from "./search-text";

type ReviewItem = { id: string; description: string; direction: string; currency: string; dueDate: Date; amount: { toString(): string } };

// Es una señal para revisar, nunca una autorización para borrar o fusionar.
export function upcomingMatches<T extends ReviewItem>(rows: T[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const name = searchText(row.description).trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = JSON.stringify([name, row.direction, row.currency, row.dueDate.toISOString().slice(0, 10), row.amount.toString()]);
    groups.set(key, [...(groups.get(key) ?? []), row.id]);
  }
  return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
}

export function reviewUpcoming<T extends ReviewItem>(rows: T[], options: { q?: string; alphabetical?: boolean; matchesOnly?: boolean; direction?: string }) {
  const matches = upcomingMatches(rows);
  const query = searchText(options.q ?? "").trim();
  const shown = rows.filter((row) => (!options.direction || row.direction === options.direction) && (!query || searchText(row.description).includes(query)) && (!options.matchesOnly || matches.has(row.id)));
  const names = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  shown.sort((a, b) => (options.alphabetical ? names.compare(a.description, b.description) : 0) || a.dueDate.getTime() - b.dueDate.getTime() || names.compare(a.description, b.description) || a.id.localeCompare(b.id));
  return { shown, matches };
}
