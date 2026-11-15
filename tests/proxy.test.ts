import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
it("la respuesta privada usa nonces distintos y no permite scripts inline arbitrarios", () => {
  const a = proxy(new NextRequest("https://somosguafra.com/app")), b = proxy(new NextRequest("https://somosguafra.com/app"));
  const csp = a.headers.get("content-security-policy")!;
  expect(csp).toContain("'nonce-");
  expect(csp.split(";").find((x) => x.trim().startsWith("script-src"))).not.toContain("unsafe-inline");
  expect(csp).not.toBe(b.headers.get("content-security-policy"));
  expect(a.headers.get("cache-control")).toBe("private, no-store");
});
