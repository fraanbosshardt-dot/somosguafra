import { afterEach, expect, it, vi } from "vitest";
import { reportError } from "@/lib/diagnostics";
afterEach(() => vi.restoreAllMocks());
it("does not log messages, stacks, tokens or personal data while preserving a known technical code", () => {
  const output = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = Object.assign(new Error("Authorization Bearer private-fixture-token email@audit.invalid"), { code: "P2002", privateToken: "fixture-secret" });
  reportError("billing.checkout", error);
  expect(output).toHaveBeenCalledWith("[guafra-error]", { scope: "billing.checkout", type: "Error", code: "P2002" });
  expect(JSON.stringify(output.mock.calls)).not.toMatch(/private-fixture|email@audit|fixture-secret/);
});
