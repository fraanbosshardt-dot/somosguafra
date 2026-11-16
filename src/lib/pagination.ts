export function pageNumber(value?: string) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 1_000_000) : 1;
}
