export const BUSINESS_TIME_ZONE = "America/New_York";
export const MINIMUM_BOXES = 3;
export const DEFAULT_CUTOFF_OVERRIDE = "2026-09-11T15:00:00";
export const ORDERS_OPEN = false;

export type ProductId = "little-chicken" | "big-chicken" | "little-beef" | "big-beef";

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
  regularUnitAmountCents?: number;
  discountedUnitAmountCents?: number;
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
    proteinGrams: "69g",
    carbs: "114g",
    fat: "26g",
    regularUnitAmountCents: 1000,
    discountedUnitAmountCents: 900,
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
    calories: "960",
    proteinGrams: "66.5g",
    carbs: "77.5g",
    fat: "41g",
    regularUnitAmountCents: 1200,
    discountedUnitAmountCents: 1000,
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
    proteinGrams: "46.5g",
    carbs: "77.5g",
    fat: "17g",
    regularUnitAmountCents: 800,
    discountedUnitAmountCents: 600,
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
    purchasable: false,
    description: "Coming soon",
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
  regularUnitAmountCents: number;
  amountCents: number;
  discountApplied: boolean;
};

export type OrderQuote = {
  lines: PricedLine[];
  totalBoxes: number;
  subtotalCents: number;
  errors: string[];
  isValid: boolean;
};

export function getProduct(productId: string): Product | undefined {
  return productMap.get(productId as ProductId);
}

export function unitAmountFor(product: Product, quantity: number): number | undefined {
  if (!product.purchasable || product.regularUnitAmountCents === undefined) {
    return undefined;
  }

  return quantity >= 5
    ? product.discountedUnitAmountCents ?? product.regularUnitAmountCents
    : product.regularUnitAmountCents;
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

    if (!Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > 99) {
      errors.push(`Choose a whole-number quantity for ${product.name}.`);
      continue;
    }

    if (!product.purchasable && item.quantity > 0) {
      errors.push(`${product.name} is coming soon and cannot be ordered yet.`);
      continue;
    }

    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const lines: PricedLine[] = [];
  let totalBoxes = 0;
  let subtotalCents = 0;

  for (const product of products) {
    const quantity = quantities.get(product.id) ?? 0;
    if (!product.purchasable || quantity === 0) {
      continue;
    }

    const regularUnitAmountCents = product.regularUnitAmountCents as number;
    const unitAmountCents = unitAmountFor(product, quantity) as number;
    const amountCents = unitAmountCents * quantity;
    lines.push({
      productId: product.id,
      name: product.name,
      quantity,
      unitAmountCents,
      regularUnitAmountCents,
      amountCents,
      discountApplied: quantity >= 5 && unitAmountCents < regularUnitAmountCents,
    });
    totalBoxes += quantity;
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
    errors,
    isValid: errors.length === 0 && totalBoxes >= MINIMUM_BOXES,
  };
}

export function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountCents / 100);
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
