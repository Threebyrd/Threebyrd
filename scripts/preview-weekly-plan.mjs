import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { PREVIEW_SCENARIOS } from "../app/subscriptions/preview-config.ts";
import { previewWeeklyPlan } from "../app/subscriptions/plan.ts";
import { formatBusinessDateTime, formatMoney } from "../app/order-config.ts";

// Standalone artifact only: no server, public route, credentials, or external requests.
const output = resolve(process.argv[2] ?? ".local-previews/weekly-plan/index.html");
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const cards = PREVIEW_SCENARIOS.map((scenario, index) => {
  const preview = previewWeeklyPlan(scenario.plan, scenario.calendar, scenario.ledger, new Date(scenario.now), scenario.availability);
  const cycles = preview.cycles.map((decision) => {
    const { cycle, quote } = decision;
    return `<details ${decision === preview.next ? "open" : ""}><summary>${escape(cycle.deliveryDate)} · ${escape(decision.status)}</summary>
    <p>${escape(decision.reason)}</p><p>Cycle ${escape(cycle.id)} · cutoff / proposed charge: ${escape(formatBusinessDateTime(new Date(cycle.cutoffAt)))}</p>
    ${quote ? `<ul>${quote.paidLines.map((line) => `<li>${line.quantity} × ${escape(line.name)} · ${escape(line.sauceName)} — ${formatMoney(line.amountCents)}</li>`).join("")}${quote.welcomeLine ? `<li>WELCOME: 1 × ${escape(quote.welcomeLine.name)} · ${escape(quote.welcomeLine.sauceName)} — $0.00</li>` : ""}</ul>
    <dl><dt>Paid quantity tier</dt><dd>${escape(quote.pricingTier ?? "Below minimum")}</dd><dt>Paid meals before discount</dt><dd>${formatMoney(quote.subtotalBeforeDiscountCents)}</dd><dt>Weekly discount (5%)</dt><dd>−${formatMoney(quote.discountCents)}</dd><dt>Subtotal before tax</dt><dd>${formatMoney(quote.subtotalBeforeTaxCents)}</dd><dt>Paid / free / physical meals</dt><dd>${quote.paidMealCount} / ${quote.freeMealCount} / ${quote.fulfillmentMealCount}</dd></dl><p>Tax not calculated. This is not a final total.</p>` : ""}</details>`;
  }).join("");
  return `<section data-scenario="${index}" ${index ? "hidden" : ""}><h2>${escape(scenario.name)}</h2><p>${escape(scenario.description)}</p><p>Simulated time: ${escape(formatBusinessDateTime(new Date(scenario.now)))}</p><div class="notice"><strong>${escape(preview.message)}</strong><br>Welcome eligibility: ${preview.welcomeEligible ? "not yet redeemed" : "already redeemed"}${preview.next ? `<br>Next candidate delivery: ${escape(preview.next.cycle.deliveryDate)}` : ""}</div>${cycles}</section>`;
}).join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'"><title>ThreeByrd weekly plan — local preview</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f4ed;color:#203829;font:16px/1.6 system-ui,sans-serif}main{max-width:880px;margin:auto;padding:32px 20px}h1{font-size:clamp(1.8rem,6vw,2.8rem);line-height:1.15}h2{margin-top:32px}label{display:block;font-weight:700}select{width:100%;padding:12px;font:inherit;background:white;border:1px solid #9caa9e;border-radius:8px}.badge{font-weight:700;color:#6b3a06}.notice{padding:18px;background:#e6eddd;border-radius:10px;margin:20px 0}details{padding:16px;background:white;border:1px solid #cbd2c7;border-radius:10px;margin:12px 0}summary{font-weight:750;cursor:pointer}dl{display:grid;grid-template-columns:1fr auto;gap:8px 20px}dd{margin:0;font-weight:700}p,li,summary{overflow-wrap:anywhere}[hidden]{display:none}@media(max-width:480px){dl{grid-template-columns:1fr}dd{margin-bottom:8px}}
</style></head><body><main><p class="badge">STAGE 1 · LOCAL SAMPLE DATA · NO BILLING</p><h1>A weekly plan that fits real life.</h1><p>Save 5% on meals, sauce included with your free welcome box with the first paid delivery. Change, skip, pause, or cancel before cutoff.</p><p>Internal scenario preview only. Dates, closures, and customers below are examples, not published delivery promises. No enrollment, payment, messaging, or production changes occur.</p><label for="scenario">Explore a scenario</label><select id="scenario">${PREVIEW_SCENARIOS.map((scenario, index) => `<option value="${index}">${escape(scenario.name)}</option>`).join("")}</select>${cards}<p>All deadlines use America/New_York. Nothing here schedules or authorizes a charge.</p></main><script>document.getElementById('scenario').addEventListener('change',function(){document.querySelectorAll('[data-scenario]').forEach(section=>{section.hidden=section.dataset.scenario!==this.value})});</script></body></html>`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`Local preview: ${output}`);
