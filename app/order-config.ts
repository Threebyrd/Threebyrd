export const BUSINESS_TIME_ZONE = "America/New_York";
export const MINIMUM_BOXES = 3;
export const DEFAULT_CUTOFF_OVERRIDE = "2026-09-11T15:00:00";
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
    image: "/assets/big-chicken.webp",
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
    image: "/assets/big-beef.webp",
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
    image: "/assets/little-chicken.webp",
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
    image: "/assets/little-beef.webp",
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

export type CartItemInput = {
  productId: string;
  quantity: number;
};

export type PricedLine = {
  productId: ProductId;
  name: Product["name"];
  quantity: number;
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

export function getProduct(productId: string): Product | undefined {
  return productMap.get(productId as ProductId);
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
      typeof (item as { quantity?: unknown }).quantity === "number"
    ))
      ? parsed as CartItemInput[]
      : null;
  } catch {
    return null;
  }
}

export function quoteOrder(items: readonly CartItemInput[]): OrderQuote {
  const quantities = new Map<string, number>();
  const errors: string[] = [];

  for (const item of items) {
    const product = getProduct(item.productId);
    if (!product) {
      errors.push("That meal is not available.");
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

    const nextQuantity = (quantities.get(item.productId) ?? 0) + item.quantity;
    if (nextQuantity > 99) {
      errors.push(`Choose no more than 99 boxes of ${product.name}.`);
      continue;
    }
    quantities.set(item.productId, nextQuantity);
  }

  const totalBoxes = [...quantities.values()].reduce((total, quantity) => total + quantity, 0);
  const pricingTier = getCartPricingTier(totalBoxes);
  const pricingTierForDisplay = pricingTier ?? "3-4";
  const lines: PricedLine[] = [];
  let subtotalCents = 0;

  for (const product of products) {
    const quantity = quantities.get(product.id) ?? 0;
    if (!product.purchasable || quantity === 0) {
      continue;
    }

    const unitAmountCents = amountForProductAtTier(product.id, pricingTierForDisplay);
    const amountCents = unitAmountCents * quantity;
    lines.push({
      productId: product.id,
      name: product.name,
      quantity,
      unitAmountCents,
      amountCents,
      pricingTier: pricingTierForDisplay,
    });
    subtotalCents += amountCents;
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
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const daysSinceFriday = (weekday + 2) % 7;
  const friday = addBusinessDays(parts, -daysSinceFriday);
  return `${friday.year}-${String(friday.month).padStart(2, "0")}-${String(friday.day).padStart(2, "0")}`;
}

function configuredCutoffOverride(): Date | null {
  if (typeof process === "undefined") {
    return businessWallTimeToDate(DEFAULT_CUTOFF_OVERRIDE);
  }

  return businessWallTimeToDate(process.env.THREEBYRD_CUTOFF_OVERRIDE ?? DEFAULT_CUTOFF_OVERRIDE);
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

export function getSaturdayForCutoff(cutoff: Date): string {
  const parts = businessDateParts(cutoff);
  return formatBusinessDate(wallTimeForParts(addBusinessDays(parts, 1), 12, 0));
}
