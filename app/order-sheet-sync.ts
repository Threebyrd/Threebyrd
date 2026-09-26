import { getDeliveryDateIso, quoteOrder, type CartItemInput } from "./order-config.ts";

export const GOOGLE_SHEETS_HEADERS = [
  "Order Date/Time",
  "Order ID",
  "Customer Name",
  "Phone",
  "Email",
  "Ithaca Delivery Address",
  "Big Chicken Qty",
  "Little Chicken Qty",
  "Big Beef Qty",
  "Little Beef Qty",
  "Total Meals",
  "Total Paid",
  "Delivery Date",
  "Stripe Session ID",
  "Payment Status",
  "Order Status",
  "Notes",
] as const;

export type ConfirmedOrderForSheet = {
  id: string;
  stripeSessionId: string;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  items: string;
  amountCents: number;
  currency: string;
  cutoffAt: string | null;
  createdAt: number;
};

export type GoogleSheetsOrderPayload = {
  stripeMode: "test" | "live";
  orderDateTime: string;
  orderId: string;
  customerName: string;
  phone: string;
  email: string;
  deliveryAddress: string;
  bigChickenQty: number;
  littleChickenQty: number;
  bigBeefQty: number;
  littleBeefQty: number;
  totalMeals: number;
  totalPaid: number;
  deliveryDate: string;
  stripeSessionId: string;
  paymentStatus: "paid";
  orderStatus: "New";
  notes: string;
};

export type GoogleSheetsSyncResult =
  | { ok: true; duplicate: boolean; diagnostics?: GoogleSheetsDestinationDiagnostics }
  | { ok: false; reason: "not_configured" | "timeout" | "network_error" | "malformed_response" | "endpoint_rejected" | "endpoint_unauthorized" | "endpoint_wrong_mode" | "spreadsheet_not_configured" | "spreadsheet_unavailable" | "orders_worksheet_unavailable" | "orders_worksheet_missing" | `http_${number}` };

export type GoogleSheetsDestinationDiagnostics = {
  spreadsheetName: string;
  worksheetName: string;
  lastRow: number;
  headersValid: boolean;
  matchingRow?: number;
};

export type GoogleSheetsOrderSender = (payload: GoogleSheetsOrderPayload) => Promise<GoogleSheetsSyncResult>;

export type GoogleSheetsDestinationDiagnosticResult =
  | { ok: true; diagnostics: GoogleSheetsDestinationDiagnostics }
  | { ok: false; reason: Extract<GoogleSheetsSyncResult, { ok: false }>["reason"] };

const retryBaseSeconds = 5 * 60;
const retryMaxSeconds = 6 * 60 * 60;

export function buildOrderSheetPayload(order: ConfirmedOrderForSheet, stripeMode: "test" | "live"): GoogleSheetsOrderPayload {
  const items = parseItems(order.items);
  const quote = quoteOrder(items);
  if (!quote.isValid || quote.subtotalCents !== order.amountCents || order.currency.toLowerCase() !== "usd") {
    throw new Error("Confirmed order failed Google Sheets export validation.");
  }

  const deliveryAddress = parseDeliveryAddress(order.deliveryAddress);
  const cutoff = order.cutoffAt ? new Date(order.cutoffAt) : null;
  if (!cutoff || Number.isNaN(cutoff.getTime())) {
    throw new Error("Confirmed order is missing a valid delivery date.");
  }

  const quantityFor = (productId: string) => items
    .filter((item) => item.productId === productId)
    .reduce((total, item) => total + item.quantity, 0);

  return {
    stripeMode,
    orderDateTime: formatEasternDateTime(new Date(order.createdAt * 1000)),
    orderId: order.id,
    customerName: order.customerName ?? "",
    phone: order.customerPhone ?? "",
    email: order.customerEmail ?? "",
    deliveryAddress,
    bigChickenQty: quantityFor("big-chicken"),
    littleChickenQty: quantityFor("little-chicken"),
    bigBeefQty: quantityFor("big-beef"),
    littleBeefQty: quantityFor("little-beef"),
    totalMeals: quote.totalBoxes,
    totalPaid: Number((order.amountCents / 100).toFixed(2)),
    deliveryDate: getDeliveryDateIso(cutoff),
    stripeSessionId: order.stripeSessionId,
    paymentStatus: "paid",
    orderStatus: "New",
    notes: "",
  };
}

export function getRetryDelaySeconds(attempts: number): number {
  const safeAttempts = Number.isSafeInteger(attempts) && attempts > 0 ? attempts : 1;
  return Math.min(retryMaxSeconds, retryBaseSeconds * (2 ** Math.min(safeAttempts - 1, 8)));
}

export function buildGoogleSheetsRequestBody(payload: GoogleSheetsOrderPayload, secret: string): string {
  return JSON.stringify({ secret, order: payload });
}

export function buildGoogleSheetsDiagnosticRequestBody(secret: string): string {
  return JSON.stringify({ secret, diagnostic: true });
}

export async function inspectGoogleSheetsDestination(
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<GoogleSheetsDestinationDiagnosticResult> {
  const url = process.env.GOOGLE_SHEETS_WEB_APP_URL?.trim();
  const secret = process.env.GOOGLE_SHEETS_SYNC_SECRET?.trim();
  if (!url || !secret || !isAllowedGoogleAppsScriptUrl(url)) {
    return { ok: false, reason: "not_configured" };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), 10_000) : null;

  try {
    const response = await fetchGoogleAppsScript(
      fetchImpl,
      url,
      buildGoogleSheetsDiagnosticRequestBody(secret),
      options.signal ?? controller?.signal,
    );
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, reason: "malformed_response" };
    }

    if (!isGoogleSheetsDiagnosticResponse(body)) {
      return { ok: false, reason: getSafeEndpointRejectionReason(body) };
    }

    return { ok: true, diagnostics: getDestinationDiagnostics(body)! };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "network_error" };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function sendOrderToGoogleSheets(
  payload: GoogleSheetsOrderPayload,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<GoogleSheetsSyncResult> {
  const url = process.env.GOOGLE_SHEETS_WEB_APP_URL?.trim();
  const secret = process.env.GOOGLE_SHEETS_SYNC_SECRET?.trim();
  if (!url || !secret) {
    console.error("Google Sheets order export configuration is incomplete", {
      urlConfigured: Boolean(url),
      secretConfigured: Boolean(secret),
    });
    return { ok: false, reason: "not_configured" };
  }

  if (!isAllowedGoogleAppsScriptUrl(url)) {
    console.error("Google Sheets order export URL has an invalid shape", {
      urlConfigured: true,
      secretConfigured: true,
      urlAllowed: false,
    });
    return { ok: false, reason: "not_configured" };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), 10_000) : null;

  try {
    const response = await fetchGoogleAppsScript(
      fetchImpl,
      url,
      buildGoogleSheetsRequestBody(payload, secret),
      options.signal ?? controller?.signal,
    );

    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, reason: "malformed_response" };
    }

    if (!isGoogleSheetsResponse(body)) {
      return { ok: false, reason: getSafeEndpointRejectionReason(body) };
    }

    const diagnostics = getDestinationDiagnostics(body);
    return diagnostics
      ? { ok: true, duplicate: body.duplicate === true, diagnostics }
      : { ok: true, duplicate: body.duplicate === true };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "network_error" };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fetchGoogleAppsScript(
  fetchImpl: typeof fetch,
  initialUrl: string,
  body: string,
  signal: AbortSignal | undefined,
): Promise<Response> {
  const initialResponse = await fetchImpl(initialUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal,
    redirect: "manual",
  });

  if (![301, 302, 303].includes(initialResponse.status)) {
    return initialResponse;
  }

  const location = initialResponse.headers?.get("location");
  if (!location) {
    return initialResponse;
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(location, initialUrl);
  } catch {
    return initialResponse;
  }

  if (!isAllowedGoogleAppsScriptRedirect(redirectUrl)) {
    return initialResponse;
  }

  // Apps Script's ContentService responds to /exec with a 302 and expects the
  // one-time script.googleusercontent.com target to be followed as a normal
  // GET. Never replay the original POST body across that redirect.
  let url = redirectUrl;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
      redirect: "manual",
    });

    if (![301, 302, 303].includes(response.status)) {
      return response;
    }

    const nextLocation = response.headers?.get("location");
    if (!nextLocation || redirectCount === 3) {
      return response;
    }

    let nextUrl: URL;
    try {
      nextUrl = new URL(nextLocation, url);
    } catch {
      return response;
    }

    if (!isAllowedGoogleAppsScriptRedirect(nextUrl)) {
      return response;
    }

    url = nextUrl;
  }

  throw new Error("Google Sheets redirect handling failed.");
}

function isGoogleSheetsResponse(value: unknown): value is { ok: true; inserted?: true; duplicate?: true; [key: string]: unknown } {
  if (typeof value !== "object" || value === null || (value as { ok?: unknown }).ok !== true) {
    return false;
  }

  const inserted = (value as { inserted?: unknown }).inserted === true;
  const duplicate = (value as { duplicate?: unknown }).duplicate === true;
  return inserted !== duplicate;
}

function isGoogleSheetsDiagnosticResponse(value: unknown): value is { ok: true; diagnostic: true; [key: string]: unknown } {
  return typeof value === "object" && value !== null &&
    (value as { ok?: unknown }).ok === true &&
    (value as { diagnostic?: unknown }).diagnostic === true &&
    getDestinationDiagnostics(value as Record<string, unknown>) !== undefined;
}

function getDestinationDiagnostics(value: { [key: string]: unknown }): GoogleSheetsDestinationDiagnostics | undefined {
  const spreadsheetName = value.spreadsheetName;
  const worksheetName = value.worksheetName;
  const lastRow = value.lastRow;
  const headersValid = value.headersValid;
  const matchingRow = value.matchingRow;
  if (
    typeof spreadsheetName !== "string" ||
    typeof worksheetName !== "string" ||
    typeof lastRow !== "number" ||
    !Number.isSafeInteger(lastRow) ||
    lastRow < 1 ||
    typeof headersValid !== "boolean"
  ) {
    return undefined;
  }

  return {
    spreadsheetName,
    worksheetName,
    lastRow,
    headersValid,
    ...(typeof matchingRow === "number" && Number.isSafeInteger(matchingRow) && matchingRow >= 2 ? { matchingRow } : {}),
  };
}

function getSafeEndpointRejectionReason(value: unknown): Extract<GoogleSheetsSyncResult, { ok: false }>["reason"] {
  const error = typeof value === "object" && value !== null && typeof (value as { error?: unknown }).error === "string"
    ? (value as { error: string }).error
    : "";

  switch (error) {
    case "Unauthorized":
      return "endpoint_unauthorized";
    case "Wrong Stripe environment":
      return "endpoint_wrong_mode";
    case "Spreadsheet destination is not configured.":
      return "spreadsheet_not_configured";
    case "Configured spreadsheet could not be opened.":
      return "spreadsheet_unavailable";
    case "Orders worksheet could not be opened.":
      return "orders_worksheet_unavailable";
    case "Orders worksheet was not found.":
      return "orders_worksheet_missing";
    default:
      return "endpoint_rejected";
  }
}

function isAllowedGoogleAppsScriptUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      url.pathname.startsWith("/macros/s/") &&
      url.pathname.endsWith("/exec") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
  } catch {
    return false;
  }
}

function isAllowedGoogleAppsScriptRedirect(url: URL): boolean {
  return url.protocol === "https:" &&
    ((url.hostname === "script.google.com" && url.pathname.startsWith("/macros/")) ||
      (url.hostname === "script.googleusercontent.com" && url.pathname.startsWith("/macros/")));
}

export function getConfiguredStripeMode(): "test" | "live" {
  const mode = process.env.STRIPE_MODE?.trim();
  if (mode === "test" || mode === "live") {
    return mode;
  }
  throw new Error("Stripe mode is not configured for Google Sheets export.");
}

function parseItems(value: string): CartItemInput[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) throw new Error("items is not an array");
    return parsed as CartItemInput[];
  } catch {
    throw new Error("Confirmed order has invalid cart data.");
  }
}

function parseDeliveryAddress(value: string | null): string {
  if (!value) throw new Error("Confirmed order has no delivery address.");
  try {
    const parsed = JSON.parse(value) as { normalizedAddress?: unknown };
    if (typeof parsed.normalizedAddress !== "string" || !parsed.normalizedAddress.trim()) {
      throw new Error("normalizedAddress is missing");
    }
    return parsed.normalizedAddress.trim();
  } catch {
    throw new Error("Confirmed order has invalid delivery address data.");
  }
}

function formatEasternDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute} ${values.dayPeriod}`;
}
