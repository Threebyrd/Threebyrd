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
  assert.doesNotMatch(html, /Orders open until/);
  assert.match(html, /class="summaryCountdown"/);
  assert.match(html, /class="capacityIndicator"/);
  assert.match(html, /Checking weekly capacity/);
  assert.match(html, /Orders close in|Next order window/);
  assert.match(html, /Friday, September \d{1,2}(?:<!-- -->)? · 3:00 PM ET/);
  assert.doesNotMatch(html, /Orders are currently closed/);
  assert.match(html, /Order window closed|Continue to secure checkout/);
  assert.match(html, /Friday, September \d{1,2}/);
  assert.match(html, /Choose Meal Order/);
  assert.match(html, /3-box minimum/);
  assert.match(html, /Mix and match however you want/);
  assert.match(html, /Be first to know what.s next/);
  assert.equal((html.match(/class="joinForm/g) ?? []).length, 2);
  assert.match(html, /id="upper-join-email"[^>]*name="email"/);
  assert.match(html, /id="upper-join-phone"[^>]*name="phone"/);
  assert.match(html, /id="bottom-join-email"[^>]*name="email"/);
  assert.match(html, /id="bottom-join-phone"[^>]*name="phone"/);
  assert.equal((html.match(/class="cardNutrition"/g) ?? []).length, 4);
  assert.match(html, /Big Chicken Macro snapshot/);
  assert.match(html, /Big Beef Macro snapshot/);
  assert.match(html, /Little Chicken Macro snapshot/);
  assert.match(html, /Little Beef Macro snapshot/);
  assert.match(html, /970/);
  assert.match(html, /70g/);
  assert.match(html, /114g/);
  assert.match(html, /26g/);
  assert.match(html, /660/);
  assert.match(html, /47g/);
  assert.match(html, /78g/);
  assert.match(html, /17g/);
  assert.match(html, /1115/);
  assert.match(html, /70g/);
  assert.match(html, /114g/);
  assert.match(html, /41g/);
  assert.match(html, /785/);
  assert.match(html, /46g/);
  assert.match(html, /83g/);
  assert.match(html, /Order more\. Pay less per meal/);
  assert.match(html, /Mix and match any meals/);
  assert.match(html, /See all tier prices/);
  assert.match(html, /3 Big Chicken \+ 2 Big Beef = 5 meals total/);
  assert.match(html, /Meal subtotal/);
  assert.match(html, /Delivery.*\$0/s);
  assert.match(html, /Free Saturday delivery to your door/);
  const productGridIndex = html.indexOf('class="productGrid"');
  const pricingExplainerIndex = html.indexOf('class="pricingExplainer"');
  const orderSummaryIndex = html.indexOf('class="orderSummary"');
  assert.ok(productGridIndex >= 0 && productGridIndex < pricingExplainerIndex, "products should appear before pricing explainer");
  assert.ok(pricingExplainerIndex < orderSummaryIndex, "pricing explainer should appear before order summary");
  assert.match(html, /Pricing starts at/);
  assert.match(html, /3–4 meals/);
  assert.match(html, /5–9(?:<!-- -->)? meals/);
  assert.match(html, /10\+(?:<!-- -->)? meals/);
  assert.doesNotMatch(html, /10–19 meals|20\+ meals.*best value/);
  assert.equal((html.match(/class="pricingExplainer"/g) ?? []).length, 1);
  assert.equal((html.match(/class="pricingSteps"/g) ?? []).length, 1);
  assert.equal((html.match(/class="pricingTable"/g) ?? []).length, 1);
  assert.equal((html.match(/class="productPriceRange"/g) ?? []).length, 4);
  assert.equal((html.match(/aria-label="Add one /g) ?? []).length, 4);
  assert.equal((html.match(/aria-label="Remove one /g) ?? []).length, 4);
  assert.match(html, /Follow ThreeByrd on Instagram/);
  assert.match(html, /https:\/\/www\.instagram\.com\/threebyrd\//);
  assert.match(html, /Follow ThreeByrd on LinkedIn/);
  assert.match(html, /https:\/\/www\.linkedin\.com\/company\/threebyrd\//);
  assert.match(html, /For inquiries, contact <a href="mailto:thor@threebyrd\.com">thor@threebyrd\.com<\/a>/);
  assert.doesNotMatch(html, /Our story|From SBX Chicken|Started with meal prep\.|Built around four choices\.|Delivered for busy days\./i);
  assert.match(html, /Giving back/);
  assert.match(html, /Meet the team/);
  assert.doesNotMatch(html, /How ordering works|Pick your protein|Pick your quantity/);
  assert.doesNotMatch(html, /processSection|processCard|processImage/);
  assert.doesNotMatch(html, /#how-it-works/);
  assert.match(html, /Ordering 20\+ meals\?/);
  assert.match(html, /20%2B%20Meal%20Custom%20Pricing/);
  assert.match(html, /threebyrd-logo\.png/);
  assert.match(html, /favicon-16x16\.png/);
  assert.match(html, /favicon-32x32\.png/);
  assert.match(html, /favicon\.ico/);
  assert.match(html, /apple-touch-icon\.png/);
  assert.match(html, /site\.webmanifest/);
  assert.match(html, /threebyrd-team\.webp/);
  assert.match(html, /ThreeByrd co-founders Thor Waguespack, Truman Popp, and Luc Surprenant/);
  assert.equal((html.match(/class="teamMember/g) ?? []).length, 3);
  assert.equal((html.match(/class="teamMark/g) ?? []).length, 1);
  assert.match(html, /mailto:thor@threebyrd\.com/);
  assert.match(html, /mailto:truman@threebyrd\.com/);
  assert.match(html, /mailto:luc@threebyrd\.com/);
  assert.match(html, /https:\/\/www\.linkedin\.com\/in\/thorbw\//);
  assert.match(html, /https:\/\/www\.linkedin\.com\/in\/trumanpopp\//);
  assert.match(html, /https:\/\/www\.linkedin\.com\/in\/lucsurprenant\//);
  assert.equal((html.match(/class="founderContactLink founderLinkedIn"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /countdownSection|countdownPanel|countdownLayout/);
  assert.doesNotMatch(html, /hero-chicken-thigh\.png/);
  assert.equal((html.match(/class="tickerSequence"/g) ?? []).length, 2);
  assert.equal((html.match(/class="nutritionRail"/g) ?? []).length, 0);
  assert.match(html, /class="countUpValue"/);

  for (const product of ["Little Chicken", "Big Chicken", "Little Beef", "Big Beef"]) {
    assert.match(html, new RegExp(product));
  }
  const productCardOrder = [...html.matchAll(/<article class="productCard[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>/g)].map((match) => match[1]);
  assert.deepEqual(productCardOrder, ["Big Chicken", "Big Beef", "Little Chicken", "Little Beef"]);
  assert.doesNotMatch(html, /Coming soon|Not available for purchase yet/i);
  assert.match(html, /\$8/);
  assert.match(html, /\$10/);
  assert.match(html, /\$11/);
  assert.doesNotMatch(html, /Choose a weekly plan|Pick your weekly rhythm|Weekly Plans|3–20 meals|Small size|Big size|What Is In The Box|What.s in the Box/i);
  assert.doesNotMatch(html, /Order now|Shop now/i);
  assert.doesNotMatch(html, /threebyrd-wordmark-wide\.png/);
  assert.doesNotMatch(html, /id="menu"|id="menu-title"|href="#menu"|class="menuCard|macroStrip/i);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((html.match(/class="productCard productCard/g) ?? []).length, 4);
  assert.equal((html.match(/class="founderCard/g) ?? []).length, 0);
});

test("passes the open-order gate at the server boundary", async () => {
  const response = await render("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://threebyrd.com" },
    body: JSON.stringify({ items: [{ productId: "big-chicken", quantity: 3 }] }),
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://threebyrd.com");
  assert.match(await response.text(), /Secure checkout is being configured/);
});

test("rejects checkout requests from unknown browser origins", async () => {
  const response = await render("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://not-threebyrd.example" },
    body: JSON.stringify({ items: [{ productId: "big-chicken", quantity: 3 }] }),
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("renders the static order route with cancellation compatibility", async () => {
  const response = await render("/order");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build your order/);
  assert.match(html, /Little Beef/);
  assert.match(html, /class="orderPage"/);
});

test("renders a confirmation route without requiring Stripe secrets", async () => {
  const response = await render("/success");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Order received/);
  assert.match(html, /Saturday delivery/);
  assert.doesNotMatch(html, /sk_(?:test|live)_/i);
});
