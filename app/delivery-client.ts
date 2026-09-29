import type { DeliveryAddressFields } from "./delivery-address";

export type DeliveryEligibilityResponse = {
  normalizedAddress?: unknown;
  driveMinutes?: unknown;
  error?: unknown;
};

export type DeliveryEligibilityRequestResult = {
  body: DeliveryEligibilityResponse;
  ok: boolean;
  status: number;
};

const RETRY_DELAYS_MS = [250, 750];

export async function requestDeliveryEligibility(
  url: string,
  address: DeliveryAddressFields,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryEligibilityRequestResult> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const body = await response.json().catch(() => ({})) as DeliveryEligibilityResponse;
      if (response.status !== 503 || attempt === RETRY_DELAYS_MS.length) {
        return { body, ok: response.ok, status: response.status };
      }
    } catch (error) {
      if (attempt === RETRY_DELAYS_MS.length) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }

  throw new Error("Delivery check failed.");
}
