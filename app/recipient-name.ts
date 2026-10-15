/**
 * The recipient name is collected by ThreeByrd for delivery and fulfillment
 * records. It is intentionally separate from Stripe's billing/cardholder name.
 */
export const RECIPIENT_NAME_MAX_LENGTH = 120;

export function normalizeRecipientName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const hasControlCharacter = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (hasControlCharacter) return null;

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > RECIPIENT_NAME_MAX_LENGTH) return null;
  return normalized;
}
