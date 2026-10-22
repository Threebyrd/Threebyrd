import type { DeliveryCycle } from "./calendar.ts";
import type { WeeklyPlan, WelcomeRedemption } from "./plan.ts";
import type { Availability } from "./quote.ts";

/** FIXTURES ONLY. Not imported by checkout, Worker, or any public route.
 * Friday 3 PM New York cutoffs mirror the normal one-time schedule.
 * This Thanksgiving closure is a demonstration, not a published business decision.
 */
export const PREVIEW_CALENDAR: readonly DeliveryCycle[] = [
  { id: "demo-2026-44", sequence: 44, deliveryDate: "2026-10-31", cutoffAt: "2026-10-30T15:00:00-04:00", chargeAt: "2026-10-30T15:00:00-04:00", status: "open" },
  { id: "demo-2026-45", sequence: 45, deliveryDate: "2026-11-08", cutoffAt: "2026-11-06T15:00:00-05:00", chargeAt: "2026-11-06T15:00:00-05:00", status: "open" },
  { id: "demo-2026-46", sequence: 46, deliveryDate: "2026-11-14", cutoffAt: "2026-11-13T15:00:00-05:00", chargeAt: "2026-11-13T15:00:00-05:00", status: "open" },
  { id: "demo-2026-47", sequence: 47, deliveryDate: "2026-11-21", cutoffAt: "2026-11-20T15:00:00-05:00", chargeAt: "2026-11-20T15:00:00-05:00", status: "open" },
  { id: "demo-2026-48", sequence: 48, deliveryDate: "2026-11-28", cutoffAt: "2026-11-27T15:00:00-05:00", chargeAt: "2026-11-27T15:00:00-05:00", status: "closed", closureReason: "Thanksgiving break (sample closure): no charge; resumes at the next open delivery." },
  { id: "demo-2026-49", sequence: 49, deliveryDate: "2026-12-05", cutoffAt: "2026-12-04T15:00:00-05:00", chargeAt: "2026-12-04T15:00:00-05:00", status: "open" },
];

export const PREVIEW_PLAN: WeeklyPlan = {
  id: "demo-plan", verifiedCustomerId: "demo-verified-customer", enrolledAt: "2026-10-21T17:00:00Z",
  status: "active", resumeCycleId: null,
  defaultCart: [{ productId: "big-chicken", quantity: 5, sauceId: "bbq" }],
  overrides: {}, skippedCycleIds: [], welcomeSelection: { productId: "little-beef", sauceId: "franks-redhot" },
};

export type PreviewScenario = {
  name: string; description: string; now: string; plan: WeeklyPlan;
  calendar: readonly DeliveryCycle[]; ledger: readonly WelcomeRedemption[]; availability?: Availability;
};
const paidLedger: readonly WelcomeRedemption[] = [{ verifiedCustomerId: PREVIEW_PLAN.verifiedCustomerId, orderId: "demo-paid-order", cycleId: "previous-demo-cycle", redeemedAt: "2026-10-20T17:00:00Z" }];
const base = { now: "2026-10-21T17:00:00Z", plan: PREVIEW_PLAN, calendar: PREVIEW_CALENDAR, ledger: [] };
export const PREVIEW_SCENARIOS: readonly PreviewScenario[] = [
  { ...base, name: "First delivery", description: "5% off five paid meals, regular paid-meal sauce charges, plus one free Little Beef welcome box." },
  { ...base, name: "Returning subscriber", description: "Same recurring discount; the customer has already redeemed the welcome box.", ledger: paidLedger },
  { ...base, name: "This week only", description: "Four beef meals this week; five chicken meals remain the usual order.", plan: { ...PREVIEW_PLAN, overrides: { "demo-2026-44": [{ productId: "big-beef", quantity: 4, sauceId: "franks-redhot" }] } } },
  { ...base, name: "Skip a week", description: "The welcome box moves to the first eligible unskipped cycle.", plan: { ...PREVIEW_PLAN, skippedCycleIds: ["demo-2026-44"] } },
  { ...base, name: "Pause through Thanksgiving", description: "Return cycle is closed; resume at the next open delivery.", plan: { ...PREVIEW_PLAN, status: "paused", resumeCycleId: "demo-2026-48" } },
  { ...base, name: "Indefinite pause", description: "No orders or charges until the customer resumes.", plan: { ...PREVIEW_PLAN, status: "paused", resumeCycleId: null } },
  { ...base, name: "Canceled", description: "No future automatic orders.", plan: { ...PREVIEW_PLAN, status: "canceled" } },
  { ...base, name: "Signup at cutoff", description: "Friday deadline is inclusive: at 3 PM signup starts the next eligible week.", now: "2026-10-30T19:00:00Z", plan: { ...PREVIEW_PLAN, enrolledAt: "2026-10-30T19:00:00Z" } },
  { ...base, name: "Holiday closure", description: "Thanksgiving week is closed in this sample calendar; no charge, then automatic return.", now: "2026-11-23T17:00:00Z" },
  { ...base, name: "Welcome selection unavailable", description: "Explicit replacement needed; no silent substitution.", availability: { unavailableProductIds: ["little-beef"] } },
  { ...base, name: "Below paid minimum", description: "Two paid meals plus a free box cannot satisfy the three-paid-meal minimum.", plan: { ...PREVIEW_PLAN, defaultCart: [{ productId: "big-chicken", quantity: 2 }] } },
  { ...base, name: "No future dates published", description: "Enrollment cannot be scheduled after the last published cutoff.", now: "2026-12-04T20:00:00Z" },
];
