import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedCheckoutOrigin, withCheckoutCors } from "../app/api/cors.ts";

function request(origin) {
  return new Request("http://api.threebyrd.test/api/checkout", {
    headers: { origin },
  });
}

test("allows the production origin and adds the expected CORS headers", () => {
  const originRequest = request("https://threebyrd.com");
  assert.equal(isAllowedCheckoutOrigin(originRequest), true);
  const responseInit = withCheckoutCors(originRequest, { status: 204 });
  const headers = new Headers(responseInit.headers);
  assert.equal(headers.get("access-control-allow-origin"), "https://threebyrd.com");
  assert.equal(headers.get("access-control-allow-methods"), "POST, OPTIONS");
});

test("rejects unknown browser origins", async () => {
  const originRequest = request("https://not-threebyrd.example");
  assert.equal(isAllowedCheckoutOrigin(originRequest), false);
  const responseInit = withCheckoutCors(originRequest, { status: 403 });
  assert.equal(new Headers(responseInit.headers).get("access-control-allow-origin"), null);
});

test("handles a controlled CORS preflight", () => {
  const originRequest = request("http://localhost:3000");
  const responseInit = withCheckoutCors(originRequest, { status: 204 });
  const headers = new Headers(responseInit.headers);
  assert.equal(headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.equal(headers.get("access-control-allow-methods"), "POST, OPTIONS");
});
