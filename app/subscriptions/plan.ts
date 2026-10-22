import type { CartItemInput } from "../order-config.ts";
import { instantMilliseconds, validateCalendar, type DeliveryCycle } from "./calendar.ts";
import { quoteWeeklyPlan, type Availability, type WelcomeSelection, type WeeklyQuote } from "./quote.ts";

export type WeeklyPlan = Readonly<{
  id: string;
  verifiedCustomerId: string;
  enrolledAt: string;
  status: "active" | "paused" | "canceled";
  /** null on a paused plan means indefinite pause; otherwise permanent cycle ID. */
  resumeCycleId: string | null;
  defaultCart: readonly CartItemInput[];
  overrides: Readonly<Record<string, readonly CartItemInput[]>>;
  skippedCycleIds: readonly string[];
  welcomeSelection: WelcomeSelection | null;
}>;

/** Customer-scoped audit ledger, deliberately independent of Stripe or plan IDs. */
export type WelcomeRedemption = Readonly<{
  verifiedCustomerId: string;
  orderId: string;
  cycleId: string;
  redeemedAt: string;
}>;
export type PaidWelcomeEvent = Readonly<{
  verifiedCustomerId: string;
  orderId: string;
  cycleId: string;
  occurredAt: string;
  paymentStatus: "paid" | "failed" | "refunded";
  orderKind: "weekly" | "one_time";
  includedWelcomeBox: boolean;
}>;

/** Models idempotent redemption; future storage MUST enforce uniqueness atomically. */
export function recordWelcomeRedemption(ledger: readonly WelcomeRedemption[], event: PaidWelcomeEvent): readonly WelcomeRedemption[] {
  if (event.paymentStatus !== "paid" || event.orderKind !== "weekly" || !event.includedWelcomeBox) return ledger;
  if (ledger.some((entry) => entry.verifiedCustomerId === event.verifiedCustomerId)) return ledger;
  if (!event.verifiedCustomerId.trim() || !event.orderId.trim() || !event.cycleId.trim()) throw new Error("Redemption requires verified customer, order, and cycle identity.");
  instantMilliseconds(event.occurredAt);
  return [...ledger, { verifiedCustomerId: event.verifiedCustomerId, orderId: event.orderId, cycleId: event.cycleId, redeemedAt: event.occurredAt }];
}

export type CycleDecision = {
  cycle: DeliveryCycle;
  status: "cutoff_passed" | "not_enrolled" | "closed" | "skipped" | "paused" | "canceled" | "ready" | "blocked";
  reason: string;
  quote: WeeklyQuote | null;
};
export type PlanPreview = {
  kind: "preview_only";
  timeZone: "America/New_York";
  welcomeEligible: boolean;
  cycles: CycleDecision[];
  next: CycleDecision | null;
  message: string;
};

function assertPlan(plan: WeeklyPlan, calendar: readonly DeliveryCycle[]) {
  if (!plan.id.trim() || !plan.verifiedCustomerId.trim()) throw new Error("A verified customer identity is required.");
  instantMilliseconds(plan.enrolledAt);
  if (!["active", "paused", "canceled"].includes(plan.status)) throw new Error("Invalid plan status.");
  const ids = new Set(calendar.map((cycle) => cycle.id));
  if (plan.resumeCycleId !== null && (plan.status !== "paused" || !ids.has(plan.resumeCycleId))) throw new Error("Publish the return cycle before scheduling a resume.");
  // Calendar passed here is the complete published history, including referenced cycles.
  for (const id of [...plan.skippedCycleIds, ...Object.keys(plan.overrides)]) if (!ids.has(id)) throw new Error(`Unknown referenced cycle: ${id}`);
}

export function previewWeeklyPlan(
  plan: WeeklyPlan, calendar: readonly DeliveryCycle[], ledger: readonly WelcomeRedemption[],
  now: Date, availability: Availability = {},
): PlanPreview {
  const sorted = validateCalendar(calendar);
  assertPlan(plan, sorted);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid preview time.");
  const enrolledAt = instantMilliseconds(plan.enrolledAt);
  const eligibleAt = Math.max(now.getTime(), enrolledAt);
  const welcomeEligible = !ledger.some((entry) => entry.verifiedCustomerId === plan.verifiedCustomerId);
  const resumeSequence = sorted.find((cycle) => cycle.id === plan.resumeCycleId)?.sequence;
  let welcomePreviewAssigned = false;
  const cycles = sorted.map((cycle): CycleDecision => {
    const decision = (status: CycleDecision["status"], reason: string, quote: WeeklyQuote | null = null) => ({ cycle, status, reason, quote });
    const cutoff = instantMilliseconds(cycle.cutoffAt);
    if (cutoff <= eligibleAt) return decision(cutoff <= enrolledAt ? "not_enrolled" : "cutoff_passed", "The signup/change deadline has passed. Existing committed orders are not represented by this preview.");
    if (plan.status === "canceled") return decision("canceled", "Plan canceled; no future order or charge.");
    if (cycle.status === "closed") return decision("closed", cycle.closureReason || "Business closed; no order or charge.");
    if (plan.status === "paused" && (resumeSequence === undefined || cycle.sequence < resumeSequence)) return decision("paused", "Plan paused; no order or charge.");
    if (plan.skippedCycleIds.includes(cycle.id)) return decision("skipped", "Customer skipped this delivery; no order or charge.");
    const includeWelcome = welcomeEligible && !welcomePreviewAssigned;
    const quote = quoteWeeklyPlan(plan.overrides[cycle.id] ?? plan.defaultCart, includeWelcome ? plan.welcomeSelection : null, availability);
    if (includeWelcome && !plan.welcomeSelection) quote.errors.push("Choose a welcome box before enrollment.");
    quote.isValid = quote.errors.length === 0;
    if (!quote.isValid) return decision("blocked", quote.errors.join(" "), quote);
    // Projection only: never writes to the redemption ledger. A failed payment
    // leaves eligibility intact and a later recomputation moves the box forward.
    if (includeWelcome) welcomePreviewAssigned = true;
    return decision("ready", "Editable preview only. Charge and lock at cutoff are future-stage work.", quote);
  });
  // Do not silently jump over an invalid upcoming order to claim a later date.
  const next = cycles.find((cycle) => cycle.status === "ready" || cycle.status === "blocked") ?? null;
  return {
    kind: "preview_only", timeZone: "America/New_York", welcomeEligible, cycles, next,
    message: next ? next.status === "ready" ? "Next eligible delivery preview; no payment scheduled." : "Resolve the upcoming order before enrollment or charging." : plan.status === "canceled" ? "Plan canceled." : plan.status === "paused" && plan.resumeCycleId === null ? "Paused until you resume." : "No eligible published delivery; enrollment cannot yet be scheduled.",
  };
}

/** Stage 2 must load plan/cycle and locked IDs from trusted storage. */
export function changePlanCart(
  plan: WeeklyPlan, calendar: readonly DeliveryCycle[], cycleId: string,
  cart: readonly CartItemInput[], scope: "this_delivery" | "this_and_future",
  now: Date, lockedCycleIds: readonly string[], availability: Availability = {},
): WeeklyPlan {
  const sorted = validateCalendar(calendar);
  assertPlan(plan, sorted);
  if (plan.status === "canceled" || (plan.status === "paused" && plan.resumeCycleId === null)) throw new Error("Resume an active plan before editing meals.");
  const resumeSequence = sorted.find((entry) => entry.id === plan.resumeCycleId)?.sequence;
  const cycle = sorted.find((entry) => entry.id === cycleId);
  if (!Number.isFinite(now.getTime()) || !cycle || cycle.status !== "open" || instantMilliseconds(cycle.cutoffAt) <= Math.max(now.getTime(), instantMilliseconds(plan.enrolledAt)) || lockedCycleIds.includes(cycleId)) throw new Error("This delivery cannot be edited; contact support for a committed order.");
  if (plan.status === "paused" && resumeSequence !== undefined && cycle.sequence < resumeSequence) throw new Error("Choose a delivery at or after your scheduled return.");
  const quote = quoteWeeklyPlan(cart, null, availability);
  if (!quote.isValid) throw new Error(quote.errors.join(" "));
  const copy = cart.map(({ productId, quantity, sauceId }) => ({ productId, quantity, ...(sauceId ? { sauceId } : {}) }));
  if (scope === "this_delivery") return { ...plan, overrides: { ...plan.overrides, [cycleId]: copy } };
  if (scope !== "this_and_future") throw new Error("Invalid edit scope.");
  // Without versioned defaults, future-wide edits must start at the first
  // still-editable open cycle; otherwise an earlier preview would change too.
  const first = sorted.find((entry) => entry.status === "open" && !plan.skippedCycleIds.includes(entry.id) && (resumeSequence === undefined || entry.sequence >= resumeSequence) && instantMilliseconds(entry.cutoffAt) > Math.max(now.getTime(), instantMilliseconds(plan.enrolledAt)) && !lockedCycleIds.includes(entry.id));
  if (first?.id !== cycleId) throw new Error("Permanent defaults must start with the next editable delivery.");
  return { ...plan, defaultCart: copy, overrides: Object.fromEntries(Object.entries(plan.overrides).filter(([id]) => sorted.find((entry) => entry.id === id)!.sequence < cycle.sequence)) };
}

export type PlanAction =
  | { type: "skip" | "unskip"; cycleId: string }
  | { type: "pause"; resumeCycleId: string | null }
  | { type: "resume" }
  | { type: "cancel" };

/** Pure preview transitions. Does not mutate or cancel an existing paid order. */
export function applyPlanAction(
  plan: WeeklyPlan, calendar: readonly DeliveryCycle[], action: PlanAction,
  now: Date, lockedCycleIds: readonly string[],
): WeeklyPlan {
  const sorted = validateCalendar(calendar);
  assertPlan(plan, sorted);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid action time.");
  if (plan.status === "canceled") throw new Error("Canceled plans require a new enrollment; welcome eligibility remains customer-scoped.");
  if (action.type === "cancel") return { ...plan, status: "canceled", resumeCycleId: null };
  if (action.type === "resume") return { ...plan, status: "active", resumeCycleId: null };
  if (action.type === "pause") {
    const target = sorted.find((cycle) => cycle.id === action.resumeCycleId);
    if (action.resumeCycleId !== null && (!target || instantMilliseconds(target.cutoffAt) <= Math.max(now.getTime(), instantMilliseconds(plan.enrolledAt)))) throw new Error("Return cycle must be published and before its cutoff.");
    return { ...plan, status: "paused", resumeCycleId: action.resumeCycleId };
  }
  const target = sorted.find((cycle) => cycle.id === action.cycleId);
  if (!target || instantMilliseconds(target.cutoffAt) <= Math.max(now.getTime(), instantMilliseconds(plan.enrolledAt)) || lockedCycleIds.includes(target.id)) throw new Error("This delivery is committed or its cutoff has passed; contact support.");
  return { ...plan, skippedCycleIds: action.type === "skip" ? [...new Set([...plan.skippedCycleIds, action.cycleId])] : plan.skippedCycleIds.filter((id) => id !== action.cycleId) };
}
