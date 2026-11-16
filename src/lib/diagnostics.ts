// Error messages/stacks can contain provider credentials, request bodies or financial data.
// Keep a bounded technical classification; inspect sensitive details only through authorized tools.
export function reportError(scope: string, error: unknown) {
  const value = error && typeof error === "object" ? error as { name?: unknown; code?: unknown } : {};
  const allowedTypes = ["Error", "TypeError", "RangeError", "UserError", "PrismaClientKnownRequestError", "PrismaClientInitializationError", "ZodError", "AbortError", "TimeoutError"];
  const type = typeof value.name === "string" && allowedTypes.includes(value.name) ? value.name : "Error";
  const code = typeof value.code === "string" && /^(P\d{4}|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND)$/.test(value.code) ? value.code : undefined;
  console.error("[guafra-error]", { scope: /^[\w .:[\]-]{1,100}$/.test(scope) ? scope : "operation", type, ...(code ? { code } : {}) });
}
