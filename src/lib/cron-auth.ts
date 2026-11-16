import { timingSafeEqual } from "node:crypto";
export function cronAuthorized(req: Request) {
  return bearerMatches(req, process.env.CRON_SECRET);
}

function bearerMatches(req: Request, secret: string | undefined) {
  if (!secret) return false;
  const actual = Buffer.from(req.headers.get("authorization") ?? ""), expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// The monitoring key only authorizes reads; cron handlers still require CRON_SECRET.
export function operationsAuthorized(req: Request) {
  const secret = process.env.OPERATIONS_MONITOR_SECRET;
  return (!!secret && secret.length >= 32 && bearerMatches(req, secret)) || cronAuthorized(req);
}
