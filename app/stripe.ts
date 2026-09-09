import Stripe from "stripe";

export type StripeMode = "test" | "live";

const stripeKeyPrefixes: Record<StripeMode, RegExp> = {
  test: /^(?:sk|rk)_test_/,
  live: /^(?:sk|rk)_live_/,
};

export function getStripeMode(): StripeMode | null {
  const mode = process.env.STRIPE_MODE?.trim();
  return mode === "test" || mode === "live" ? mode : null;
}

export function isStripeKeyForMode(secretKey: string, mode: StripeMode): boolean {
  return stripeKeyPrefixes[mode].test(secretKey.trim());
}

export function getStripeConfigurationError(): string | null {
  const mode = getStripeMode();
  if (!mode) {
    return "STRIPE_MODE must be set to test or live.";
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return "STRIPE_SECRET_KEY is not configured.";
  }

  if (!isStripeKeyForMode(secretKey, mode)) {
    return `STRIPE_SECRET_KEY does not match configured Stripe mode (${mode}).`;
  }

  return null;
}

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || getStripeConfigurationError()) {
    return null;
  }

  return new Stripe(secretKey.trim());
}

export function isStripeEventForMode(livemode: boolean, mode: StripeMode): boolean {
  return livemode === (mode === "live");
}

export function getSiteOrigin(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!configuredOrigin) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for Stripe redirect URLs.");
  }

  const origin = new URL(configuredOrigin);
  if (origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must contain only the site origin.");
  }

  return origin.origin;
}
