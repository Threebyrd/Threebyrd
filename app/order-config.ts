import { SMS_REMINDER_DISCLOSURE_VERSION, SMS_REMINDER_SOURCE } from "./reminder-consent.ts";

export const BUSINESS_TIME_ZONE = "America/New_York";
export const MINIMUM_BOXES = 3;
export const DEFAULT_CUTOFF_OVERRIDE = "2026-10-17T15:00:00";
export const ORDERS_OPEN = true;

export type ProductId = "little-chicken" | "big-chicken" | "little-beef" | "big-beef";

export type CartPricingTier = "3-4" | "5-9" | "10+";

export type CartPricingTierDefinition = {
  minTotalMeals: number;
  maxTotalMeals?: number;
  prices: Record<ProductId, number>;
};

export const CART_PRICING_TIER_ORDER: readonly CartPricingTier[] = ["3-4", "5-9", "10+"];

/**
 * Canonical meal pricing. The checkout route and the browser quote both read
 * this table, but only the server-side quote is trusted for payment.
 */
export const CART_PRICING_TIERS: Record<CartPricingTier, CartPricingTierDefinition> = {
  "3-4": {
    minTotalMeals: 3,
    maxTotalMeals: 4,
    prices: {
      "big-chicken": 1000,
      "little-chicken": 800,
      "big-beef": 1100,
      "little-beef": 900,
    },
  },
  "5-9": {
    minTotalMeals: 5,
    maxTotalMeals: 9,
    prices: {
      "big-chicken": 900,
      "little-chicken": 700,
      "big-beef": 1000,
      "little-beef": 800,
    },
  },
  "10+": {
    minTotalMeals: 10,
    prices: {
      "big-chicken": 850,
      "little-chicken": 700,
      "big-beef": 950,
      "little-beef": 800,
    },
  },
};

export function getCartPricingTier(totalMeals: number): CartPricingTier | undefined {
  if (!Number.isInteger(totalMeals) || totalMeals < CART_PRICING_TIERS["3-4"].minTotalMeals) {
    return undefined;
  }

  for (const tier of CART_PRICING_TIER_ORDER) {
    const definition = CART_PRICING_TIERS[tier];
    if (totalMeals < definition.minTotalMeals) {
      continue;
    }
    if (definition.maxTotalMeals === undefined || totalMeals <= definition.maxTotalMeals) {
      return tier;
    }
  }

  return undefined;
}

export function getNextPricingTier(totalMeals: number): { tier: CartPricingTier; mealsUntil: number } | undefined {
  if (!Number.isInteger(totalMeals) || totalMeals < 0) {
    return undefined;
  }

  const tier = CART_PRICING_TIER_ORDER.find(
    (candidate) => totalMeals < CART_PRICING_TIERS[candidate].minTotalMeals,
  );
  return tier
    ? { tier, mealsUntil: CART_PRICING_TIERS[tier].minTotalMeals - totalMeals }
    : undefined;
}

export function formatPricingTier(tier: CartPricingTier): string {
  return tier.replace("-", "–");
}

function amountForProductAtTier(productId: ProductId, tier: CartPricingTier): number {
  return CART_PRICING_TIERS[tier].prices[productId];
}

export type Product = {
  id: ProductId;
  name: "Little Chicken" | "Big Chicken" | "Little Beef" | "Big Beef";
  protein: "Chicken" | "Beef";
  size: "Little" | "Big";
  image: string;
  alt: string;
  calories?: string;
  proteinGrams?: string;
  carbs?: string;
  fat?: string;
  purchasable: boolean;
  description: string;
};

export const products: readonly Product[] = [
  {
    id: "big-chicken",
    name: "Big Chicken",
    protein: "Chicken",
    size: "Big",
    image: "/assets/big-chicken.jpg",
    alt: "Big Chicken meal prep boxes with rice and broccoli",
    calories: "970",
    proteinGrams: "70g",
    carbs: "114g",
    fat: "26g",
    purchasable: true,
    description: "Chicken, white rice + broccoli",
  },
  {
    id: "big-beef",
    name: "Big Beef",
    protein: "Beef",
    size: "Big",
    image: "/assets/big-beef.jpg",
    alt: "Big Beef meal prep boxes with rice and broccoli",
    calories: "1115",
    proteinGrams: "70g",
    carbs: "114g",
    fat: "41g",
    purchasable: true,
    description: "Beef, white rice + broccoli",
  },
  {
    id: "little-chicken",
    name: "Little Chicken",
    protein: "Chicken",
    size: "Little",
    image: "/assets/little-chicken.jpg",
    alt: "Little Chicken meal prep boxes with rice and broccoli",
    calories: "660",
    proteinGrams: "47g",
    carbs: "78g",
    fat: "17g",
    purchasable: true,
    description: "Chicken, white rice + broccoli",
  },
  {
    id: "little-beef",
    name: "Little Beef",
    protein: "Beef",
    size: "Little",
    image: "/assets/little-beef.jpg",
    alt: "Little Beef meal prep boxes with rice and broccoli",
    calories: "785",
    proteinGrams: "46g",
    carbs: "83g",
    fat: "41g",
    purchasable: true,
    description: "Beef, white rice + broccoli",
  },
];

const productMap = new Map(products.map((product) => [product.id, product]));

export type SauceId = "no-sauce" | "franks-redhot" | "bbq";

export type SauceOption = {
  id: SauceId;
  name: "No Sauce" | "Franks' RedHot" | "BBQ";
  surchargeCents: number;
};

export const SAUCE_OPTIONS: readonly SauceOption[] = [
  { id: "no-sauce", name: "No Sauce", surchargeCents: 0 },
  { id: "franks-redhot", name: "Franks' RedHot", surchargeCents: 100 },
  { id: "bbq", name: "BBQ", surchargeCents: 100 },
];

export type CartItemInput = {
  productId: string;
  quantity: number;
  /** Legacy carts omit sauceId and are treated as No Sauce. */
  sauceId?: string;
};

export type PricedLine = {
  productId: ProductId;
  name: Product["name"];
  sauceId: SauceId;
  sauceName: SauceOption["name"];
  quantity: number;
  mealUnitAmountCents: number;
  sauceUnitAmountCents: number;
  unitAmountCents: number;
  amountCents: number;
  pricingTier: CartPricingTier;
};

export type OrderQuote = {
  lines: PricedLine[];
  totalBoxes: number;
  subtotalCents: number;
  pricingTier: CartPricingTier | null;
  errors: string[];
  isValid: boolean;
};

export function buildCheckoutMetadata({
  quote,
  reservationId,
  deliveryAddress,
  cutoff,
  smsReminderDecision,
  smsReminderDecisionAt,
  smsMarketingDecision,
}: {
  quote: OrderQuote;
  reservationId: string;
  deliveryAddress: string;
  cutoff: Date;
  smsReminderDecision?: "yes" | "no";
  smsReminderDecisionAt?: Date;
  smsMarketingDecision?: "yes" | "no";
}): Record<string, string> {
  const quantities = Object.fromEntries(products.map((product) => [
    `${product.id.replaceAll("-", "_")}_qty`,
    String(quote.lines
      .filter((line) => line.productId === product.id)
      .reduce((total, line) => total + line.quantity, 0)),
  ]));

  return {
    order_id: reservationId,
    ...quantities,
    total_meals: String(quote.totalBoxes),
    delivery_address: deliveryAddress,
    delivery_date: getDeliveryDateIso(cutoff),
    cart: JSON.stringify(quote.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      ...(line.sauceId === "no-sauce" ? {} : { sauceId: line.sauceId }),
    }))),
    totalBoxes: String(quote.totalBoxes),
    subtotalCents: String(quote.subtotalCents),
    pricingTier: quote.pricingTier ?? "3-4",
    cutoffAt: cutoff.toISOString(),
    ...(smsReminderDecision && smsReminderDecisionAt ? {
      smsReminderDecision,
      smsMarketingDecision: smsMarketingDecision ?? "no",
      smsReminderDisclosureVersion: SMS_REMINDER_DISCLOSURE_VERSION,
      smsReminderDecisionAt: smsReminderDecisionAt.toISOString(),
      smsReminderSource: SMS_REMINDER_SOURCE,
    } : {}),
  };
}

export function getProduct(productId: string): Product | undefined {
  return productMap.get(productId as ProductId);
}

export function getSauce(sauceId: string | undefined): SauceOption | undefined {
  const candidate = sauceId ?? "no-sauce";
  return SAUCE_OPTIONS.find((sauce) => sauce.id === candidate);
}

export function unitAmountFor(product: Product, totalMeals: number): number | undefined {
  const pricingTier = getCartPricingTier(totalMeals);
  if (!product.purchasable || !pricingTier) {
    return undefined;
  }

  return amountForProductAtTier(product.id, pricingTier);
}

export function minimumTierUnitAmountFor(product: Product): number | undefined {
  return product.purchasable
    ? amountForProductAtTier(product.id, "3-4")
    : undefined;
}

export function unitAmountAtTier(product: Product, tier: CartPricingTier): number | undefined {
  return product.purchasable ? amountForProductAtTier(product.id, tier) : undefined;
}

export function priceRangeFor(product: Product): { highestCents: number; lowestCents: number } | undefined {
  if (!product.purchasable) {
    return undefined;
  }

  return {
    highestCents: amountForProductAtTier(product.id, CART_PRICING_TIER_ORDER[0]),
    lowestCents: amountForProductAtTier(product.id, CART_PRICING_TIER_ORDER[CART_PRICING_TIER_ORDER.length - 1]),
  };
}

export function readCartMetadata(value: unknown): CartItemInput[] | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.every((item) => (
      typeof item === "object" &&
      item !== null &&
      typeof (item as { productId?: unknown }).productId === "string" &&
      typeof (item as { quantity?: unknown }).quantity === "number" &&
      (typeof (item as { sauceId?: unknown }).sauceId === "undefined" || typeof (item as { sauceId?: unknown }).sauceId === "string")
    ))
      ? parsed as CartItemInput[]
      : null;
  } catch {
    return null;
  }
}

export function quoteOrder(items: readonly CartItemInput[]): OrderQuote {
  const quantities = new Map<ProductId, number>();
  const sauceQuantities = new Map<string, number>();
  const errors: string[] = [];

  for (const item of items) {
    const product = getProduct(item.productId);
    if (!product) {
      errors.push("That meal is not available.");
      continue;
    }

    const sauce = getSauce(item.sauceId);
    if (!sauce) {
      errors.push("That sauce is not available.");
      continue;
    }

    if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > 99) {
      errors.push(`Choose a whole-number quantity for ${product.name}.`);
      continue;
    }

    if (!product.purchasable && item.quantity > 0) {
      errors.push(`${product.name} is coming soon and cannot be ordered yet.`);
      continue;
    }

    const nextQuantity = (quantities.get(product.id) ?? 0) + item.quantity;
    if (nextQuantity > 99) {
      errors.push(`Choose no more than 99 boxes of ${product.name}.`);
      continue;
    }
    quantities.set(product.id, nextQuantity);
    const sauceKey = `${product.id}:${sauce.id}`;
    sauceQuantities.set(sauceKey, (sauceQuantities.get(sauceKey) ?? 0) + item.quantity);
  }

  const totalBoxes = [...quantities.values()].reduce((total, quantity) => total + quantity, 0);
  const pricingTier = getCartPricingTier(totalBoxes);
  const pricingTierForDisplay = pricingTier ?? "3-4";
  const lines: PricedLine[] = [];
  let subtotalCents = 0;

  for (const product of products) {
    for (const sauce of SAUCE_OPTIONS) {
      const quantity = sauceQuantities.get(`${product.id}:${sauce.id}`) ?? 0;
      if (!product.purchasable || quantity === 0) continue;

      const mealUnitAmountCents = amountForProductAtTier(product.id, pricingTierForDisplay);
      const unitAmountCents = mealUnitAmountCents + sauce.surchargeCents;
      const amountCents = unitAmountCents * quantity;
      lines.push({
        productId: product.id,
        name: product.name,
        sauceId: sauce.id,
        sauceName: sauce.name,
        quantity,
        mealUnitAmountCents,
        sauceUnitAmountCents: sauce.surchargeCents,
        unitAmountCents,
        amountCents,
        pricingTier: pricingTierForDisplay,
      });
      subtotalCents += amountCents;
    }
  }

  if (totalBoxes < MINIMUM_BOXES) {
    const remaining = MINIMUM_BOXES - totalBoxes;
    errors.push(`Add ${remaining} more ${remaining === 1 ? "box" : "boxes"} to reach the ${MINIMUM_BOXES}-box minimum.`);
  }

  return {
    lines,
    totalBoxes,
    subtotalCents,
    pricingTier: pricingTier ?? null,
    errors,
    isValid: errors.length === 0 && totalBoxes >= MINIMUM_BOXES,
  };
}

export function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountCents / 100);
}

export function formatCompactMoney(amountCents: number): string {
  return amountCents % 100 === 0 ? `$${amountCents / 100}` : formatMoney(amountCents);
}

type BusinessDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const businessDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function businessDateParts(date: Date): BusinessDateParts {
  const values = Object.fromEntries(
    businessDateFormatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function businessOffsetMilliseconds(date: Date): number {
  const parts = businessDateParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
}

function businessWallTimeToDate(wallTime: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(wallTime.trim());
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const wallTimestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const firstOffset = businessOffsetMilliseconds(new Date(wallTimestamp));
  let timestamp = wallTimestamp - firstOffset;
  const correctedOffset = businessOffsetMilliseconds(new Date(timestamp));
  if (correctedOffset !== firstOffset) {
    timestamp = wallTimestamp - correctedOffset;
  }
  return new Date(timestamp);
}

function wallTimeForParts(parts: BusinessDateParts, hour: number, minute: number): Date {
  const wallTimestamp = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0);
  const firstOffset = businessOffsetMilliseconds(new Date(wallTimestamp));
  let timestamp = wallTimestamp - firstOffset;
  const correctedOffset = businessOffsetMilliseconds(new Date(timestamp));
  if (correctedOffset !== firstOffset) {
    timestamp = wallTimestamp - correctedOffset;
  }
  return new Date(timestamp);
}

function addBusinessDays(parts: BusinessDateParts, days: number): BusinessDateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { ...parts, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Return the next Friday 3:00 PM cutoff in the business timezone. */
export function getNextFridayCutoffAfter(now = new Date()): Date {
  const parts = businessDateParts(now);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  let daysUntilFriday = (5 - weekday + 7) % 7;
  const candidate = wallTimeForParts(addBusinessDays(parts, daysUntilFriday), 15, 0);

  if (candidate.getTime() <= now.getTime()) {
    daysUntilFriday += 7;
  }

  return wallTimeForParts(addBusinessDays(parts, daysUntilFriday), 15, 0);
}

export function getOrderCapacityWindowKey(cutoff: Date): string {
  const parts = businessDateParts(cutoff);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function configuredCutoffOverride(): Date | null {
  if (typeof window !== "undefined") {
    return businessWallTimeToDate(process.env.NEXT_PUBLIC_THREEBYRD_CUTOFF_OVERRIDE ?? DEFAULT_CUTOFF_OVERRIDE);
  }

  return businessWallTimeToDate(process.env.THREEBYRD_CUTOFF_OVERRIDE ?? process.env.NEXT_PUBLIC_THREEBYRD_CUTOFF_OVERRIDE ?? DEFAULT_CUTOFF_OVERRIDE);
}

export function isCutoffOverrideActive(now = new Date()): boolean {
  const override = configuredCutoffOverride();
  return override !== null && now.getTime() < override.getTime();
}

export function getNextOrderCutoff(now = new Date()): Date {
  const override = configuredCutoffOverride();
  if (override && now.getTime() < override.getTime()) {
    return override;
  }
  return getNextFridayCutoffAfter(now);
}

export function formatBusinessDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatBusinessDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function getDeliveryDayForCutoff(cutoff: Date): string {
  const parts = businessDateParts(cutoff);
  return formatBusinessDate(wallTimeForParts(addBusinessDays(parts, 1), 12, 0));
}

export function getDeliveryDateIso(cutoff: Date): string {
  const parts = businessDateParts(cutoff);
  const deliveryParts = addBusinessDays(parts, 1);
  return `${deliveryParts.year}-${String(deliveryParts.month).padStart(2, "0")}-${String(deliveryParts.day).padStart(2, "0")}`;
}
