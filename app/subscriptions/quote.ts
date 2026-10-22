import { getProduct, getSauce, quoteOrder, type CartItemInput, type PricedLine } from "../order-config.ts";

export type WelcomeSelection = Readonly<{
  productId: string;
  sauceId: string;
}>;

/** Must come from server-side inventory/configuration, never a customer payload. */
export type Availability = Readonly<{
  unavailableProductIds?: readonly string[];
  unavailableSauceIds?: readonly string[];
}>;

export type WeeklyQuote = {
  paidLines: PricedLine[];
  pricingTier: ReturnType<typeof quoteOrder>["pricingTier"];
  paidMealCount: number;
  freeMealCount: number;
  fulfillmentMealCount: number;
  mealSubtotalCents: number;
  sauceSubtotalCents: number;
  subtotalBeforeDiscountCents: number;
  discountCents: number;
  subtotalBeforeTaxCents: number;
  welcomeLine: { productId: string; name: string; sauceId: string; sauceName: string; quantity: 1; amountCents: 0 } | null;
  taxStatus: "not_calculated";
  errors: string[];
  isValid: boolean;
};

export function fivePercentDiscount(subtotalCents: number): number {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0 || subtotalCents > Math.floor((Number.MAX_SAFE_INTEGER - 50) / 5)) throw new Error("Invalid cent subtotal.");
  // Round once on the whole paid subtotal: half cents round up.
  return Math.floor((subtotalCents * 5 + 50) / 100);
}

/** Pure domain quote, NOT an HTTP boundary. Eligibility is supplied by the trusted resolver. */
export function quoteWeeklyPlan(
  paidCart: readonly CartItemInput[],
  welcome: WelcomeSelection | null,
  availability: Availability = {},
): WeeklyQuote {
  const base = quoteOrder(paidCart);
  const errors = [...base.errors];
  const unavailable = (productId: string, sauceId: string) => availability.unavailableProductIds?.includes(productId) || availability.unavailableSauceIds?.includes(sauceId);
  for (const line of base.lines) if (unavailable(line.productId, line.sauceId)) errors.push(`${line.name} or its selected sauce is unavailable; choose a replacement.`);
  // Paid meals retain standard sauce charges. Only the welcome meal and its sauce are free.
  const paidLines = base.lines;
  const mealSubtotalCents = paidLines.reduce((sum, line) => sum + line.mealUnitAmountCents * line.quantity, 0);
  const sauceSubtotalCents = paidLines.reduce((sum, line) => sum + line.sauceUnitAmountCents * line.quantity, 0);
  const subtotalBeforeDiscountCents = mealSubtotalCents + sauceSubtotalCents;
  const discountCents = fivePercentDiscount(mealSubtotalCents);
  let welcomeLine: WeeklyQuote["welcomeLine"] = null;
  if (welcome) {
    const product = getProduct(welcome.productId);
    const sauce = getSauce(welcome.sauceId);
    if (!product || !product.purchasable || !sauce || unavailable(welcome.productId, welcome.sauceId)) {
      errors.push("Your welcome meal or sauce is unavailable; choose a replacement or contact support.");
    } else {
      welcomeLine = { productId: product.id, name: product.name, sauceId: sauce.id, sauceName: sauce.name, quantity: 1, amountCents: 0 };
    }
  }
  return {
    paidLines, pricingTier: base.pricingTier, paidMealCount: base.totalBoxes,
    freeMealCount: welcomeLine ? 1 : 0, fulfillmentMealCount: base.totalBoxes + (welcomeLine ? 1 : 0),
    mealSubtotalCents, sauceSubtotalCents, subtotalBeforeDiscountCents, discountCents, subtotalBeforeTaxCents: subtotalBeforeDiscountCents - discountCents,
    welcomeLine, taxStatus: "not_calculated", errors, isValid: errors.length === 0,
  };
}
