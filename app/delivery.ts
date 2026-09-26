export const DELIVERY_ORIGIN_ADDRESS = "700 W Buffalo St, Ithaca, NY 14850, United States";
export const MAX_DELIVERY_DRIVE_MINUTES = 20;
const MAX_DELIVERY_DRIVE_SECONDS = MAX_DELIVERY_DRIVE_MINUTES * 60;

export type DeliveryEligibility = {
  eligible: boolean;
  normalizedAddress: string;
  driveMinutes: number;
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
    address_components?: Array<{ types?: string[]; short_name?: string }>;
  }>;
};

type GoogleRoutesResponse = {
  routes?: Array<{ staticDuration?: string; duration?: string }>;
};

type FetchLike = typeof fetch;

export function normalizeDeliveryAddress(value: unknown): string | null {
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
    throw providerError();
  }

  const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  geocodeUrl.searchParams.set("address", input);
  geocodeUrl.searchParams.set("components", "country:US");
  geocodeUrl.searchParams.set("region", "us");
  geocodeUrl.searchParams.set("key", apiKey);

  let geocodeResponse: Response;
  try {
    geocodeResponse = await fetchImpl(geocodeUrl, { headers: { accept: "application/json" } });
  } catch {
    throw providerError();
  }

  if (!geocodeResponse.ok) throw providerError();

  let geocode: GoogleGeocodeResponse;
  try {
    geocode = await geocodeResponse.json() as GoogleGeocodeResponse;
  } catch {
    throw providerError();
  }

  if (geocode.status === "ZERO_RESULTS" || !geocode.results?.length) {
    throw new DeliveryEligibilityError("INVALID_ADDRESS", "We couldn’t find that delivery address. Check the street, city, and ZIP code.");
  }
  if (geocode.status !== "OK") throw providerError();

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

  let routeResponse: Response;
  try {
    routeResponse = await fetchImpl("https://routes.googleapis.com/directions/v2:computeRoutes", {
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
    });
  } catch {
    throw providerError();
  }

  if (!routeResponse.ok) throw providerError();

  let route: GoogleRoutesResponse;
  try {
    route = await routeResponse.json() as GoogleRoutesResponse;
  } catch {
    throw providerError();
  }

  const seconds = parseDurationSeconds(route.routes?.[0]?.staticDuration ?? route.routes?.[0]?.duration);
  if (seconds === null) throw providerError();

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
  };
}
