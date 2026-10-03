import { formatDeliveryAddressFields } from "./delivery-address.ts";

export const DELIVERY_ORIGIN_ADDRESS = "700 W Buffalo St, Ithaca, NY 14850, United States";
export const MAX_DELIVERY_DRIVE_MINUTES = 20;
const MAX_DELIVERY_DRIVE_SECONDS = MAX_DELIVERY_DRIVE_MINUTES * 60;

export type DeliveryEligibility = {
  eligible: boolean;
  normalizedAddress: string;
  driveMinutes: number;
  taxAddress: ValidatedTaxAddress;
};

export type ValidatedTaxAddress = {
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: "US";
};

export type DeliveryErrorCode = "INVALID_ADDRESS" | "OUTSIDE_DELIVERY_ZONE" | "PROVIDER_UNAVAILABLE";

export class DeliveryEligibilityError extends Error {
  readonly code: DeliveryErrorCode;

  constructor(code: DeliveryErrorCode, message: string) {
    super(message);
    this.name = "DeliveryEligibilityError";
    this.code = code;
  }
}

type GoogleGeocodeResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    partial_match?: boolean;
    geometry?: { location?: { lat?: number; lng?: number } };
    address_components?: Array<{ types?: string[]; short_name?: string; long_name?: string }>;
  }>;
};

type GoogleRoutesResponse = {
  routes?: Array<{ staticDuration?: string; duration?: string }>;
};

type FetchLike = typeof fetch;

const PROVIDER_RETRY_DELAYS_MS = [150, 450];

function isRetryableProviderStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

type Provider = "google_geocoding" | "google_routes";

// Never log provider bodies, URLs, exception messages, or customer input.
function logProvider(provider: Provider, category: string, attempt: number, httpStatus?: number) {
  console.warn(JSON.stringify({ event: "delivery_provider_failure", provider, category, attempt, httpStatus }));
}

async function fetchProvider<T>(
  provider: Provider,
  input: Parameters<FetchLike>[0],
  init: Parameters<FetchLike>[1],
  fetchImpl: FetchLike,
): Promise<T> {
  for (let attempt = 0; attempt <= PROVIDER_RETRY_DELAYS_MS.length; attempt += 1) {
    let response: Response;
    let data: unknown;
    try {
      response = await fetchImpl(input, { ...init, signal: AbortSignal.timeout(8000) });
      data = response.ok ? await response.json().catch(() => null) : null;
    } catch {
      logProvider(provider, "network_or_timeout", attempt + 1);
      if (attempt === PROVIDER_RETRY_DELAYS_MS.length) throw providerError();
      await new Promise((resolve) => setTimeout(resolve, PROVIDER_RETRY_DELAYS_MS[attempt]));
      continue;
    }
    if (response.ok && (!data || typeof data !== "object" || Array.isArray(data))) {
      logProvider(provider, "invalid_json_response", attempt + 1, response.status);
      throw providerError();
    }
    const status = data && typeof data === "object" && "status" in data ? data.status : undefined;
    const googleFailure = provider === "google_geocoding" && status !== "OK" && status !== "ZERO_RESULTS";
    if (response.ok && !googleFailure) return data as T;
    const knownStatuses = ["UNKNOWN_ERROR", "OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT", "REQUEST_DENIED", "INVALID_REQUEST"];
    const category = googleFailure && typeof status === "string" && knownStatuses.includes(status)
      ? status : response.status === 429 ? "quota_or_rate_limit" : response.status === 401 || response.status === 403
        ? "authorization_denied" : response.ok ? "invalid_response" : "http_error";
    logProvider(provider, category, attempt + 1, response.status);
    const retryable = isRetryableProviderStatus(response.status) || (response.ok && (status === "UNKNOWN_ERROR" || status === "OVER_QUERY_LIMIT"));
    if (!retryable || attempt === PROVIDER_RETRY_DELAYS_MS.length) throw providerError();
    await new Promise((resolve) => setTimeout(resolve, PROVIDER_RETRY_DELAYS_MS[attempt]));
  }
  throw providerError();
}

export function normalizeDeliveryAddress(value: unknown): string | null {
  const structuredAddress = formatDeliveryAddressFields(value);
  if (structuredAddress) return structuredAddress;

  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/\s+/g, " ");
  const hasControlCharacter = [...normalized].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (normalized.length < 8 || normalized.length > 240 || hasControlCharacter) {
    return null;
  }

  return normalized;
}

function providerError(message = "The delivery checker is temporarily unavailable."): DeliveryEligibilityError {
  return new DeliveryEligibilityError("PROVIDER_UNAVAILABLE", message);
}

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : null;
}

function isUnitedStates(result: NonNullable<GoogleGeocodeResponse["results"]>[number]): boolean {
  return result.address_components?.some((component) => (
    component.types?.includes("country") && component.short_name === "US"
  )) ?? false;
}

function isCompleteStreetAddress(result: NonNullable<GoogleGeocodeResponse["results"]>[number]): boolean {
  const types = new Set(result.address_components?.flatMap((component) => component.types ?? []) ?? []);
  return types.has("street_number") && types.has("route");
}

function getAddressComponent(
  result: NonNullable<GoogleGeocodeResponse["results"]>[number],
  type: string,
  name: "short_name" | "long_name" = "long_name",
): string | null {
  const component = result.address_components?.find((item) => item.types?.includes(type));
  const value = component?.[name] ?? component?.short_name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getValidatedTaxAddress(
  result: NonNullable<GoogleGeocodeResponse["results"]>[number],
): ValidatedTaxAddress | null {
  const streetNumber = getAddressComponent(result, "street_number");
  const route = getAddressComponent(result, "route");
  const city = getAddressComponent(result, "locality") ?? getAddressComponent(result, "postal_town");
  const state = getAddressComponent(result, "administrative_area_level_1", "short_name");
  const postalCode = getAddressComponent(result, "postal_code");
  const country = getAddressComponent(result, "country", "short_name");
  if (!streetNumber || !route || !city || !state || !postalCode || country !== "US") return null;

  const subpremise = getAddressComponent(result, "subpremise");
  return {
    line1: `${streetNumber} ${route}${subpremise ? `, ${subpremise}` : ""}`,
    city,
    state,
    postal_code: postalCode,
    country: "US",
  };
}

export async function checkDeliveryEligibility(
  value: unknown,
  fetchImpl: FetchLike = fetch,
): Promise<DeliveryEligibility> {
  const input = normalizeDeliveryAddress(value);
  if (!input) {
    throw new DeliveryEligibilityError("INVALID_ADDRESS", "Enter the Ithaca address where this week’s meals should be delivered.");
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!apiKey) {
    console.error(JSON.stringify({ event: "delivery_provider_failure", provider: "configuration", category: "missing_credential" }));
    throw providerError();
  }

  const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  geocodeUrl.searchParams.set("address", input);
  geocodeUrl.searchParams.set("components", "country:US");
  geocodeUrl.searchParams.set("region", "us");
  geocodeUrl.searchParams.set("key", apiKey);

  const geocode = await fetchProvider<GoogleGeocodeResponse>(
    "google_geocoding",
    geocodeUrl,
    { headers: { accept: "application/json" } },
    fetchImpl,
  );

  if (geocode.status === "ZERO_RESULTS") {
    throw new DeliveryEligibilityError("INVALID_ADDRESS", "We couldn’t find that delivery address. Check the street, city, and ZIP code.");
  }
  if (geocode.status !== "OK" || !Array.isArray(geocode.results) || !geocode.results.length) {
    logProvider("google_geocoding", "invalid_response", 1);
    throw providerError();
  }

  const result = geocode.results[0];
  const location = result.geometry?.location;
  if (
    !result.formatted_address ||
    !location ||
    typeof location.lat !== "number" ||
    typeof location.lng !== "number" ||
    result.partial_match === true ||
    !isUnitedStates(result) ||
    !isCompleteStreetAddress(result)
  ) {
    throw new DeliveryEligibilityError("INVALID_ADDRESS", "Please enter a complete US street address for delivery.");
  }

  const taxAddress = getValidatedTaxAddress(result);
  if (!taxAddress) {
    throw new DeliveryEligibilityError("INVALID_ADDRESS", "Please enter a complete US street address for delivery.");
  }

  const route = await fetchProvider<GoogleRoutesResponse>(
    "google_routes",
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: DELIVERY_ORIGIN_ADDRESS },
        destination: { location: { latLng: { latitude: location.lat, longitude: location.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        languageCode: "en-US",
        units: "IMPERIAL",
      }),
    },
    fetchImpl,
  );

  const seconds = parseDurationSeconds(route?.routes?.[0]?.staticDuration ?? route?.routes?.[0]?.duration);
  if (seconds === null) {
    logProvider("google_routes", "missing_or_invalid_duration", 1);
    throw providerError();
  }

  const driveMinutes = Math.ceil(seconds / 60);
  if (seconds > MAX_DELIVERY_DRIVE_SECONDS) {
    throw new DeliveryEligibilityError(
      "OUTSIDE_DELIVERY_ZONE",
      `Sorry — this address is outside our ${MAX_DELIVERY_DRIVE_MINUTES}-minute free delivery area.`,
    );
  }

  return {
    eligible: true,
    normalizedAddress: result.formatted_address,
    driveMinutes,
    taxAddress,
  };
}
