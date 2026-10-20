export const SMS_REMINDER_DISCLOSURE_VERSION = "order-and-promotions-v1";
export const SMS_REMINDER_SOURCE = "checkout";
export const SMS_CONSENT_PURPOSE = "order_and_promotional";

export type SmsReminderDecision = "yes" | "no";

export function parseSmsReminderDecision(value: unknown): SmsReminderDecision | null {
  return value === "yes" || value === "no" ? value : null;
}

export function normalizeSmsDestination(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function mayCreateSmsReminderJobs(
  decision: SmsReminderDecision,
  destination: string | null,
): boolean {
  return decision === "yes" && destination !== null;
}
