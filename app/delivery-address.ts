export type DeliveryAddressField = "streetAddress" | "city" | "state" | "zipCode";

export type DeliveryAddressFields = {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
};

export const EMPTY_DELIVERY_ADDRESS: DeliveryAddressFields = {
  streetAddress: "",
  city: "",
  state: "",
  zipCode: "",
};

export const US_STATE_OPTIONS = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"], ["DC", "District of Columbia"],
] as const;

const validStateCodes: Set<string> = new Set(US_STATE_OPTIONS.map(([code]) => code));

function normalizePart(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  const hasControlCharacter = [...normalized].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (!normalized || normalized.length > maxLength || hasControlCharacter) return null;
  return normalized;
}

export function normalizeZipCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, "");
  return /^\d{5}(?:-\d{4})?$/.test(normalized) ? normalized : null;
}

export function normalizeDeliveryAddressFields(value: unknown): DeliveryAddressFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = value as Partial<DeliveryAddressFields>;
  const streetAddress = normalizePart(fields.streetAddress, 120);
  const city = normalizePart(fields.city, 80);
  const state = normalizePart(fields.state, 2)?.toUpperCase() ?? null;
  const zipCode = normalizeZipCode(fields.zipCode);

  if (!streetAddress || !city || !state || !validStateCodes.has(state) || !zipCode) return null;

  return { streetAddress, city, state, zipCode };
}

export function formatDeliveryAddressFields(value: unknown): string | null {
  const fields = normalizeDeliveryAddressFields(value);
  return fields ? `${fields.streetAddress}, ${fields.city}, ${fields.state} ${fields.zipCode}` : null;
}
