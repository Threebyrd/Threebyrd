/**
 * Cloudflare supplies CF-Connecting-IP at the edge. Hash it before storing so
 * the reservation table never contains a raw customer IP address.
 */
export async function getCheckoutClientKey(request: Request): Promise<string | null> {
  const clientIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (!clientIp) return null;

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`threebyrd-checkout-client:${clientIp}`),
  );
  return `ip:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
