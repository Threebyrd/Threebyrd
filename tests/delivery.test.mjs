import assert from "node:assert/strict";
import test from "node:test";
import {
  checkDeliveryEligibility,
  DeliveryEligibilityError,
  normalizeDeliveryAddress,
} from "../app/delivery.ts";
import { formatDeliveryAddressFields, normalizeDeliveryAddressFields } from "../app/delivery-address.ts";

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
      { types: ["locality"], long_name: "Ithaca" },
      { types: ["administrative_area_level_1"], short_name: "NY" },
      { types: ["postal_code"], long_name: "14850" },
      { types: ["country"], short_name: "US" },
    ],
  }],
};

test("normalizes delivery input without trusting a client eligibility flag", () => {
  assert.equal(normalizeDeliveryAddress("  123   State St, Ithaca, NY 14850  "), "123 State St, Ithaca, NY 14850");
  assert.equal(normalizeDeliveryAddress("short"), null);
  assert.equal(normalizeDeliveryAddress("123\nState St, Ithaca, NY 14850"), "123 State St, Ithaca, NY 14850");
});

test("normalizes complete structured address fields and rejects incomplete or malformed fields", () => {
  const fields = { streetAddress: " 700  W Buffalo St ", city: " Ithaca ", state: "ny", zipCode: "14850 " };
  assert.deepEqual(normalizeDeliveryAddressFields(fields), {
    streetAddress: "700 W Buffalo St",
    city: "Ithaca",
    state: "NY",
    zipCode: "14850",
  });
  assert.equal(formatDeliveryAddressFields(fields), "700 W Buffalo St, Ithaca, NY 14850");
  assert.equal(normalizeDeliveryAddress(fields), "700 W Buffalo St, Ithaca, NY 14850");
  assert.equal(normalizeDeliveryAddressFields({ ...fields, state: "" }), null);
  assert.equal(normalizeDeliveryAddressFields({ ...fields, zipCode: "1485" }), null);
  assert.equal(normalizeDeliveryAddressFields({ ...fields, state: "ZZ" }), null);
});

test("accepts an address at or under the 20-minute normal route limit", async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-test-key";
  try {
    const result = await checkDeliveryEligibility("123 State St, Ithaca, NY 14850", mockFetch({ geocode, route: { routes: [{ staticDuration: "1200s" }] } }));
    assert.deepEqual(result, {
      eligible: true,
      normalizedAddress: "123 State St, Ithaca, NY 14850, USA",
      driveMinutes: 20,
      taxAddress: { line1: "123 State St", city: "Ithaca", state: "NY", postal_code: "14850", country: "US" },
    });
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    else process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
  }
});

test("validates the server-composed structured address through the same route check", async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-test-key";
  try {
    const result = await checkDeliveryEligibility(
      { streetAddress: "700 W Buffalo St", city: "Ithaca", state: "NY", zipCode: "14850" },
      mockFetch({ geocode, route: { routes: [{ staticDuration: "60s" }] } }),
    );
    assert.equal(result.eligible, true);
    assert.equal(result.normalizedAddress, "123 State St, Ithaca, NY 14850, USA");
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

test("retries transient Google failures before accepting an address", async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-test-key";
  let geocodeAttempts = 0;
  let routeAttempts = 0;
  try {
    const result = await checkDeliveryEligibility("123 State St, Ithaca, NY 14850", async (input) => {
      if (String(input).startsWith("https://maps.googleapis.com/maps/api/geocode")) {
        geocodeAttempts += 1;
        if (geocodeAttempts === 1) return Response.json({}, { status: 503 });
        return Response.json(geocode);
      }
      routeAttempts += 1;
      if (routeAttempts === 1) throw new TypeError("temporary network failure");
      return Response.json({ routes: [{ staticDuration: "60s" }] });
    });
    assert.equal(result.eligible, true);
    assert.equal(geocodeAttempts, 2);
    assert.equal(routeAttempts, 2);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    else process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
  }
});

test("fails closed after bounded Google retries are exhausted", async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-test-key";
  let attempts = 0;
  try {
    await assert.rejects(
      checkDeliveryEligibility("123 State St, Ithaca, NY 14850", async () => {
        attempts += 1;
        return Response.json({}, { status: 503 });
      }),
      (error) => error instanceof DeliveryEligibilityError && error.code === "PROVIDER_UNAVAILABLE",
    );
    assert.equal(attempts, 3);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    else process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
  }
});

for (const status of ['REQUEST_DENIED', 'OVER_DAILY_LIMIT', 'UNKNOWN_ERROR', 'OVER_QUERY_LIMIT']) {
  test(`Geocoding ${status} with empty results is a provider failure, never an invalid address`, async () => {
    const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
    process.env.GOOGLE_MAPS_SERVER_API_KEY = 'server-test-key';
    const logs = [];
    const warn = console.warn;
    console.warn = (entry) => logs.push(JSON.parse(entry));
    let attempts = 0;
    try {
      await assert.rejects(checkDeliveryEligibility('700 W Buffalo St, Ithaca, NY 14850', async () => {
        attempts++;
        return Response.json({ status, results: [], error_message: 'sensitive-provider-message' });
      }), error => error.code === 'PROVIDER_UNAVAILABLE');
      assert.equal(attempts, ['UNKNOWN_ERROR', 'OVER_QUERY_LIMIT'].includes(status) ? 3 : 1);
      assert.equal(logs[0].provider, 'google_geocoding');
      assert.equal(logs[0].category, status);
      assert.doesNotMatch(JSON.stringify(logs), /Buffalo|server-test-key|sensitive-provider-message/);
    } finally {
      console.warn = warn;
      if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
      else process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
    }
  });
}

test('retries an HTTP 200 Geocoding UNKNOWN_ERROR and verifies the recovered route', async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = 'server-test-key';
  let attempts = 0;
  try {
    const result = await checkDeliveryEligibility('700 W Buffalo St, Ithaca, NY 14850', async input => {
      if (String(input).includes('/geocode/')) {
        attempts++;
        return Response.json(attempts === 1 ? { status: 'UNKNOWN_ERROR', results: [] } : geocode);
      }
      return Response.json({ routes: [{ staticDuration: '60s' }] });
    });
    assert.equal(result.eligible, true);
    assert.equal(attempts, 2);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    else process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
  }
});
