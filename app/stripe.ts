import Stripe from "stripe";

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey ? new Stripe(secretKey) : null;
}

export function getSiteOrigin(request: Request): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configuredOrigin) {
    return configuredOrigin;
  }

  return new URL(request.url).origin;
}
