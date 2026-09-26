import Stripe from "stripe";

export type StripeMode = "test" | "live";

const secretPatterns = [
  /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9_*.-]+/gi,
  /\bwhsec_[A-Za-z0-9_*.-]+/gi,
  /AIza[A-Za-z0-9_-]+/g,
];

/** Keep third-party error details useful without allowing credentials into logs. */
export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return secretPatterns.reduce((safe, pattern) => safe.replace(pattern, "[redacted-secret]"), message);
}

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
  if (origin.username || origin.password || (origin.pathname && origin.pathname !== "/") || origin.search || origin.hash) {
    const shapeIssue = [
      origin.username || origin.password ? "credentials" : null,
      origin.pathname && origin.pathname !== "/" ? "path" : null,
      origin.search ? "query" : null,
      origin.hash ? "fragment" : null,
    ].filter(Boolean).join(",");
    console.error("Stripe site origin has an invalid shape", {
      configured: true,
      hostname: origin.hostname,
      pathname: origin.pathname,
      hasCredentials: Boolean(origin.username || origin.password),
      hasSearch: Boolean(origin.search),
      hasHash: Boolean(origin.hash),
    });
    throw new Error(`NEXT_PUBLIC_SITE_URL must contain only the site origin (${shapeIssue || "unknown"}).`);
  }

  return origin.origin;
}
