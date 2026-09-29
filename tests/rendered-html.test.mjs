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
  assert.match(html, /property="og:image" content="https:\/\/threebyrd\.com\/og\/threebyrd-share\.png"/i);
  assert.match(html, /property="og:image:width" content="1200"/i);
  assert.match(html, /property="og:image:height" content="630"/i);
  assert.match(html, /property="og:type" content="website"/i);
  assert.match(html, /name="twitter:card" content="summary_large_image"/i);
  assert.match(html, /name="twitter:image" content="https:\/\/threebyrd\.com\/og\/threebyrd-share\.png"/i);
  assert.doesNotMatch(html, /(?:og|twitter)[^>]+https:\/\/threebyrd\.com\/og\.png/i);
  assert.match(html, /High-protein<br\s*\/>\s*<em>meal prep\./);
  assert.match(html, /free delivery in Ithaca/i);
  assert.doesNotMatch(html, /Orders open until/);
  assert.match(html, /class="summaryCountdown"/);
  assert.doesNotMatch(html, /class="capacityIndicator"/);
  assert.doesNotMatch(html, /Orders available this week/i);
  assert.match(html, /Next delivery cutoff/);
  assert.match(html, /Saturday, \w+ \d{1,2}(?:<!-- -->)? at 3:00 PM (?:EDT|EST)/);
  assert.doesNotMatch(html, /Orders are currently closed|Orders close|Order window closed|Closing soon|Ordering is currently closed|Sold out for this week|Check back for the next ordering window/);
  assert.match(html, /Continue to secure checkout|Check delivery address/);
  assert.match(html, /Sunday, \w+ \d{1,2}/);
  assert.match(html, /Build your order/);
  assert.match(html, /3 meal minimum/);
  assert.doesNotMatch(html, /Minimum 3 · Better pricing at 5 · Best pricing at 10/);
  assert.match(html, /funnelMilestoneGold/);
  assert.match(html, /Get the next drop/);
  assert.equal((html.match(/class="joinForm/g) ?? []).length, 1);
  assert.match(html, /id="bottom-join-email"[^>]*name="email"/);
  assert.match(html, /id="bottom-join-phone"[^>]*name="phone"/);
  const menuIndex = html.indexOf('id="order"');
  const joinIndex = html.indexOf('id="join"');
  const givingBackIndex = html.indexOf('id="giving-back"');
  assert.ok(menuIndex >= 0 && menuIndex < joinIndex, "Stay in the loop should follow Menu");
  assert.ok(joinIndex < givingBackIndex, "Stay in the loop should appear before Giving Back");
  assert.equal((html.match(/class="joinSection"/g) ?? []).length, 1);
  assert.equal((html.match(/<p class="sectionLabel sectionLabelLight">Stay in the loop<\/p>/g) ?? []).length, 1);
  assert.equal((html.match(/class="cardNutrition"/g) ?? []).length, 4);
  assert.equal((html.match(/class="macroGrid"/g) ?? []).length, 4);
  for (const macro of ["Calories", "Protein", "Carbs", "Fat"]) {
    assert.match(html, new RegExp(`>${macro}<`));
  }
  assert.match(html, /970/);
  assert.match(html, /70g/);
  assert.match(html, /660/);
  assert.match(html, /47g/);
  assert.match(html, /1115/);
  assert.match(html, /785/);
  assert.match(html, /46g/);
  assert.match(html, /More meals = lower prices/);
  assert.match(html, /aria-label="Big Chicken: \$8\.50 to \$10 per meal based on total order size"/);
  assert.match(html, /aria-label="Big Beef: \$9\.50 to \$11 per meal based on total order size"/);
  assert.match(html, /aria-label="Little Chicken: \$7 to \$8 per meal based on total order size"/);
  assert.match(html, /aria-label="Little Beef: \$8 to \$9 per meal based on total order size"/);
  assert.equal((html.match(/<small>based on total order size<\/small>/g) ?? []).length, 4);
  assert.match(html, /One cart\. One tier\. Mix and match freely\./);
  assert.match(html, /See exact prices/);
  assert.match(html, /3 meals/);
  assert.match(html, /5 meals/);
  assert.match(html, /10 meals/);
  assert.match(html, /20\+/);
  assert.match(html, /Meal subtotal/);
  assert.match(html, /Delivery.*\$0/s);
  assert.match(html, /Free delivery in Ithaca/);
  assert.match(html, /id="delivery-street"[^>]*autoComplete="address-line1"[^>]*name="streetAddress"/i);
  assert.match(html, /id="delivery-city"[^>]*autoComplete="address-level2"[^>]*name="city"/i);
  assert.match(html, /id="delivery-state"[^>]*name="state"[^>]*autoComplete="address-level1"/i);
  assert.match(html, /id="delivery-zip"[^>]*autoComplete="postal-code"[^>]*name="zipCode"/i);
  const productGridIndex = html.indexOf('class="productGrid"');
  const pricingExplainerIndex = html.indexOf('class="pricingExplainer"');
  const orderSummaryIndex = html.indexOf('class="orderSummary"');
  assert.ok(productGridIndex >= 0 && productGridIndex < pricingExplainerIndex, "products should appear before pricing explainer");
  assert.ok(pricingExplainerIndex < orderSummaryIndex, "pricing explainer should appear before order summary");
  assert.doesNotMatch(html, /Pricing starts at/);
  assert.match(html, /3–4/);
  assert.match(html, /5–9/);
  assert.match(html, /10\+/);
  assert.equal((html.match(/class="pricingExplainer"/g) ?? []).length, 1);
  assert.equal((html.match(/class="pricingSteps"/g) ?? []).length, 1);
  assert.equal((html.match(/class="pricingTable"/g) ?? []).length, 1);
  assert.equal((html.match(/class="productPriceRange"/g) ?? []).length, 4);
  assert.equal((html.match(/aria-label="Add one /g) ?? []).length, 4);
  assert.doesNotMatch(html, /checkout availability|Checking availability|Adjust cart to continue/i);
  const addButtons = [...html.matchAll(/<button\b[^>]*aria-label="Add one [^"]+"[^>]*>/g)];
  assert.equal(addButtons.length, 4);
  for (const [button] of addButtons) {
    assert.doesNotMatch(button, /\bdisabled(?:=|\s|>)/, "building a cart must not wait for the availability API");
  }
  assert.match(html, /<button[^>]*class="checkoutButton"[^>]*disabled/, "checkout still requires a valid cart and verified delivery address");
  assert.equal((html.match(/aria-label="Remove one /g) ?? []).length, 4);
  assert.match(html, /Follow ThreeByrd on Instagram/);
  assert.match(html, /https:\/\/www\.instagram\.com\/threebyrd\//);
  assert.match(html, /Follow ThreeByrd on LinkedIn/);
  assert.match(html, /https:\/\/www\.linkedin\.com\/company\/threebyrd\//);
  assert.match(html, /For inquiries, contact <a href="mailto:thor@threebyrd\.com">thor@threebyrd\.com<\/a>/);
  assert.doesNotMatch(html, /Our story|From SBX Chicken|Started with meal prep\.|Built around four choices\.|Delivered for busy days\./i);
  assert.match(html, /Giving back/);
  assert.match(html, /Ithaca-born/);
  assert.match(html, /Cornell student organizations/);
  assert.match(html, /Friendship Donations Network/);
  assert.match(html, /Ithaca Catholic Worker House/);
  assert.match(html, /110 meals/);
  assert.match(html, /200 meals/);
  assert.match(html, /Coverage of a planned 200-meal Ithaca giveaway/);
  assert.match(html, /Meet the team/);
  assert.doesNotMatch(html, /How ordering works|Pick your protein|Pick your quantity/);
  assert.doesNotMatch(html, /processSection|processCard|processImage/);
  assert.doesNotMatch(html, /#how-it-works/);
  assert.match(html, /Contact us for group pricing|group order\?/);
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
  assert.equal((html.match(/class="teamMark/g) ?? []).length, 0);
  assert.doesNotMatch(html, /threebyrd-single-chicken-star-192\.png/);
  assert.match(html, /id="order-summary"/);
  assert.match(html, /mailto:thor@threebyrd\.com/);
  assert.match(html, /mailto:truman@threebyrd\.com/);
  assert.match(html, /mailto:luc@threebyrd\.com/);
  assert.match(html, /https:\/\/www\.linkedin\.com\/in\/thorbw\//);
  assert.match(html, /https:\/\/www\.linkedin\.com\/in\/trumanpopp\//);
  assert.match(html, /https:\/\/www\.linkedin\.com\/in\/lucsurprenant\//);
  assert.equal((html.match(/class="founderContactLink founderLinkedIn"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /countdownSection|countdownPanel|countdownLayout/);
  assert.doesNotMatch(html, /hero-chicken-thigh\.png/);
  assert.equal((html.match(/class="tickerSequence"/g) ?? []).length, 0);
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

test("does not use the weekly cutoff as an order shutdown", async () => {
  const response = await render("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://threebyrd.com" },
    body: JSON.stringify({ items: [] }),
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://threebyrd.com");
  assert.match(await response.text(), /Add 3 more boxes|at least three boxes/i);
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
  assert.match(html, /delivery date assigned at checkout/);
  assert.doesNotMatch(html, /Sunday,|Saturday,/);
  assert.match(html, /Free delivery in Ithaca/);
  assert.doesNotMatch(html, /sk_(?:test|live)_/i);
});
