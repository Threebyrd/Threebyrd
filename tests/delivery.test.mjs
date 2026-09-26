import assert from "node:assert/strict";
import test from "node:test";
import {
  checkDeliveryEligibility,
  DeliveryEligibilityError,
  normalizeDeliveryAddress,
} from "../app/delivery.ts";

function mockFetch({ geocode = {}, route = {}, geocodeStatus = 200, routeStatus = 200 } = {}) {
  return async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://maps.googleapis.com/maps/api/geocode")) {
      assert.match(url, /key=server-test-key/);
      return Response.json(geocode, { status: geocodeStatus });
    }

    assert.equal(url, "https://routes.googleapis.com/directions/v2:computeRoutes");
    assert.equal(new Headers(init?.headers).get("X-Goog-Api-Key"), "server-test-key");
    assert.equal(new Headers(init?.headers).get("X-Goog-FieldMask"), "routes.duration,routes.staticDuration,routes.distanceMeters");
    return Response.json(route, { status: routeStatus });
  };
}

const geocode = {
  status: "OK",
  results: [{
    formatted_address: "123 State St, Ithaca, NY 14850, USA",
    geometry: { location: { lat: 42.44, lng: -76.5 } },
    address_components: [
      { types: ["street_number"], short_name: "123" },
      { types: ["route"], short_name: "State St" },
      { types: ["country"], short_name: "US" },
    ],
  }],
};

test("normalizes delivery input without trusting a client eligibility flag", () => {
  assert.equal(normalizeDeliveryAddress("  123   State St, Ithaca, NY 14850  "), "123 State St, Ithaca, NY 14850");
  assert.equal(normalizeDeliveryAddress("short"), null);
  assert.equal(normalizeDeliveryAddress("123\nState St, Ithaca, NY 14850"), "123 State St, Ithaca, NY 14850");
});

test("accepts an address at or under the 20-minute normal route limit", async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-test-key";
  try {
    const result = await checkDeliveryEligibility("123 State St, Ithaca, NY 14850", mockFetch({ geocode, route: { routes: [{ staticDuration: "1200s" }] } }));
    assert.deepEqual(result, { eligible: true, normalizedAddress: "123 State St, Ithaca, NY 14850, USA", driveMinutes: 20 });
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    else process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
  }
});

test("rejects an address over the 20-minute normal route limit", async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-test-key";
  try {
    await assert.rejects(
      checkDeliveryEligibility("999 Outlying Rd, Ithaca, NY 14850", mockFetch({ geocode, route: { routes: [{ staticDuration: "1201s" }] } })),
      (error) => error instanceof DeliveryEligibilityError && error.code === "OUTSIDE_DELIVERY_ZONE",
    );
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    else process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
  }
});

test("rejects invalid, ambiguous, and provider-failure responses safely", async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-test-key";
  try {
    await assert.rejects(
      checkDeliveryEligibility("not an address", mockFetch({ geocode: { status: "ZERO_RESULTS", results: [] } })),
      (error) => error instanceof DeliveryEligibilityError && error.code === "INVALID_ADDRESS",
    );
    await assert.rejects(
      checkDeliveryEligibility(
        "Ithaca, NY",
        mockFetch({ geocode: { ...geocode, results: [{ ...geocode.results[0], address_components: [{ types: ["locality"], short_name: "Ithaca" }, { types: ["country"], short_name: "US" }] }] } }),
      ),
      (error) => error instanceof DeliveryEligibilityError && error.code === "INVALID_ADDRESS",
    );
    await assert.rejects(
      checkDeliveryEligibility(
        "123 State St, Ithaca, NY 14850",
        mockFetch({ geocode: { ...geocode, results: [{ ...geocode.results[0], partial_match: true }] }, route: { routes: [{ staticDuration: "60s" }] } }),
      ),
      (error) => error instanceof DeliveryEligibilityError && error.code === "INVALID_ADDRESS",
    );
    await assert.rejects(
      checkDeliveryEligibility("123 State St, Ithaca, NY 14850", mockFetch({ geocode, route: {}, routeStatus: 500 })),
      (error) => error instanceof DeliveryEligibilityError && error.code === "PROVIDER_UNAVAILABLE",
    );
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    else process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
  }
});

test("fails closed when the routing credential is not configured", async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
  try {
    await assert.rejects(
      checkDeliveryEligibility("123 State St, Ithaca, NY 14850", mockFetch()),
      (error) => error instanceof DeliveryEligibilityError && error.code === "PROVIDER_UNAVAILABLE",
    );
  } finally {
    if (previous !== undefined) process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
  }
});
