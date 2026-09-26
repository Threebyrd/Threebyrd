import { chromium } from "/Users/thorbw/.npm/_npx/fd3bca3c548369c0/node_modules/playwright/index.mjs";

const checkoutUrl = process.env.CHECKOUT_URL;
if (!checkoutUrl) throw new Error("CHECKOUT_URL is required");

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
});
const page = await browser.newPage();
page.on("pageerror", (error) => console.error("PAGEERROR", error.message.slice(0, 240)));
await page.goto(checkoutUrl, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8_000);

await page.locator('input[name="email"]').fill("threebyrd-zapier-sample@example.com");
await page.locator('input[name="shippingName"]').fill("ThreeByrd Zapier Sample");
await page.locator('input[name="shippingAddressLine1"]').fill("700 W Buffalo St");
await page.locator('input[name="shippingLocality"]').fill("Ithaca");
await page.locator('select[name="shippingAdministrativeArea"]').selectOption("NY");
await page.locator('input[name="shippingPostalCode"]').fill("14850");
await page.locator('input[name="phoneNumber"]').fill("6075550100");
await page.locator('input[name="payment-method-accordion-item-title"]').first().check({ force: true });
await page.waitForTimeout(1_000);
await page.locator('input[name="cardNumber"]').fill("4242 4242 4242 4242");
await page.locator('input[name="cardExpiry"]').fill("12 / 34");
await page.locator('input[name="cardCvc"]').fill("123");

const verificationCode = page.locator('input[name="one-time-code"]');
if (await verificationCode.count()) {
  await verificationCode.fill("000000");
  await page.waitForTimeout(1_500);
}

await page.getByTestId("hosted-payment-submit-button").click({ force: true });
await page.waitForTimeout(15_000);
console.log(JSON.stringify({
  url: page.url().split("#", 1)[0],
  title: await page.title(),
  tail: (await page.locator("body").innerText()).slice(-700),
}, null, 2));
await browser.close();
