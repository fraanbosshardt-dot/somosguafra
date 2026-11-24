import { expect, it } from "vitest";
import { checkoutFollowup } from "@/lib/checkout-followup";
const now = new Date("2026-11-24T12:00:00Z");
it("clasifica antigüedad sin confundir intento con cancelación", () => {
  expect(checkoutFollowup({status:"pending",createdAt:new Date(now.getTime()-864e5+1)},now).key).toBe("pending");
  expect(checkoutFollowup({status:"pending",createdAt:new Date(now.getTime()-864e5)},now).key).toBe("incomplete");
});
it("autorización e incertidumbre nunca vencen por antigüedad", () => {
  const old = new Date("2020-01-01");
  expect(checkoutFollowup({status:"authorized",createdAt:old},now).key).toBe("converted");
  expect(checkoutFollowup({status:"uncertain",createdAt:old},now).key).toBe("review");
  expect(checkoutFollowup({status:"pending",createdAt:old,cancelRequestedAt:now},now).key).toBe("review");
});
