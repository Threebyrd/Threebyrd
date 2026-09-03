import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" }, ...init }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the updated ThreeByrd ordering experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ThreeByrd Meal Prep \| Chicken \+ Beef, Delivered<\/title>/i);
  assert.match(html, /Choose<br\s*\/>\s*<em>your protein/);
  assert.match(html, /delivered straight to your door/i);
  assert.match(html, /Orders open until/);
  assert.match(html, /Orders are currently closed/);
  assert.match(html, /Ordering will be opening soon/);
  assert.match(html, /Friday, September 11/);
  assert.match(html, /Choose Meal Order/);
  assert.match(html, /3-box minimum/);
  assert.match(html, /Mix and match however you want/);
  assert.match(html, /Be first to know when ordering opens/);
  assert.equal((html.match(/class="joinForm/g) ?? []).length, 2);
  assert.match(html, /id="upper-join-email"[^>]*name="email"/);
  assert.match(html, /id="upper-join-phone"[^>]*name="phone"/);
  assert.match(html, /id="bottom-join-email"[^>]*name="email"/);
  assert.match(html, /id="bottom-join-phone"[^>]*name="phone"/);
  assert.equal((html.match(/class="cardNutrition"/g) ?? []).length, 3);
  assert.match(html, /Big Chicken Macro snapshot/);
  assert.match(html, /Big Beef Macro snapshot/);
  assert.match(html, /Little Chicken Macro snapshot/);
  assert.doesNotMatch(html, /Little Beef Macro snapshot|Little Beef nutrition information|Little Beef macros/i);
  assert.match(html, /Follow ThreeByrd on Instagram/);
  assert.match(html, /https:\/\/www\.instagram\.com\/threebyrd\//);
  assert.match(html, /Follow ThreeByrd on LinkedIn/);
  assert.match(html, /https:\/\/www\.linkedin\.com\/company\/threebyrd\//);
  assert.match(html, /For inquiries, contact <a href="mailto:thor@threebyrd\.com">thor@threebyrd\.com<\/a>/);
  assert.match(html, /How ordering works/);
  assert.match(html, /Pick your protein/);
  assert.match(html, /Pick your quantity/);
  assert.match(html, /Delivered to your door/);
  assert.match(html, /threebyrd-logo\.png/);
  assert.match(html, /favicon-16x16\.png/);
  assert.match(html, /favicon-32x32\.png/);
  assert.match(html, /favicon\.ico/);
  assert.match(html, /apple-touch-icon\.png/);
  assert.match(html, /site\.webmanifest/);
  assert.match(html, /processImageThree/);
  assert.match(html, /Big Beef meal prep boxes with rice and broccoli/);
  assert.match(html, /founderImageThor/);
  assert.doesNotMatch(html, /hero-chicken-thigh\.png/);
  assert.equal((html.match(/class="tickerSequence"/g) ?? []).length, 2);
  assert.equal((html.match(/class="nutritionRail"/g) ?? []).length, 0);
  assert.match(html, /class="countUpValue"/);

  for (const product of ["Little Chicken", "Big Chicken", "Little Beef", "Big Beef"]) {
    assert.match(html, new RegExp(product));
  }
  const productCardOrder = [...html.matchAll(/<article class="productCard[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>/g)].map((match) => match[1]);
  assert.deepEqual(productCardOrder, ["Big Chicken", "Big Beef", "Little Chicken", "Little Beef"]);
  assert.match(html, /Coming soon/);
  assert.match(html, /\$8/);
  assert.match(html, /\$10/);
  assert.match(html, /\$12/);
  assert.doesNotMatch(html, /Choose a weekly plan|Pick your weekly rhythm|Weekly Plans|3–20 meals|Small size|Big size|What Is In The Box|What.s in the Box/i);
  assert.doesNotMatch(html, /Order now|Shop now/i);
  assert.doesNotMatch(html, /threebyrd-wordmark-wide\.png/);
  assert.doesNotMatch(html, /id="menu"|id="menu-title"|href="#menu"|class="menuCard|macroStrip/i);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((html.match(/class="productCard productCard/g) ?? []).length, 4);
  assert.equal((html.match(/class="founderCard/g) ?? []).length, 3);
});

test("keeps checkout closed at the server boundary", async () => {
  const response = await render("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: [{ productId: "big-chicken", quantity: 3 }] }),
  });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Orders are currently closed/);
});

test("renders the order route and safe canceled-checkout state", async () => {
  const response = await render("/order?checkout=canceled");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Checkout was canceled/);
  assert.match(html, /Build your order/);
  assert.match(html, /Little Beef/);
});

test("renders a confirmation route without requiring Stripe secrets", async () => {
  const response = await render("/success");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Order received/);
  assert.match(html, /Saturday delivery/);
  assert.doesNotMatch(html, /sk_(?:test|live)_/i);
});
