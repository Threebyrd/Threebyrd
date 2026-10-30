import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  buildGoogleSheetsRequestBody,
  buildGoogleSheetsDiagnosticRequestBody,
  buildOrderSheetPayload,
  getRetryDelaySeconds,
  inspectGoogleSheetsDestination,
  sendOrderToGoogleSheets,
} from "../app/order-sheet-sync.ts";

const mixedOrder = {
  id: "order-123",
  stripeSessionId: "cs_test_123",
  status: "confirmed",
  customerEmail: "john@example.com",
  customerName: "John Smith",
  recipientName: "John Smith",
  customerPhone: "6075550100",
  deliveryAddress: JSON.stringify({ normalizedAddress: "123 College Ave, Ithaca, NY 14850, USA" }),
  items: JSON.stringify([
    { productId: "big-chicken", quantity: 3 },
    { productId: "big-beef", quantity: 2 },
  ]),
  amountCents: 4_700,
  subtotalCents: 4_700,
  discountCents: 0,
  taxCents: 0,
  stripePaymentStatus: "paid",
  taxBehavior: "exclusive",
  currency: "usd",
  cutoffAt: "2026-09-26T19:00:00.000Z",
  createdAt: Math.floor(Date.parse("2026-09-25T14:30:00.000Z") / 1000),
  smsConsentDecision: "yes",
};

async function withEnvironment(values, callback) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      if (body instanceof Error) throw body;
      return body;
    },
  };
}

test("builds the exact validated mixed-cart Sheets row payload", () => {
  assert.deepEqual(buildOrderSheetPayload(mixedOrder, "test"), {
    stripeMode: "test",
    orderDateTime: "2026-09-25 10:30 AM",
    orderId: "order-123",
    customerName: "John Smith",
    recipientName: "John Smith",
    phone: "6075550100",
    email: "john@example.com",
    deliveryAddress: "123 College Ave, Ithaca, NY 14850, USA",
    bigChickenQty: 3,
    littleChickenQty: 0,
    bigBeefQty: 2,
    littleBeefQty: 0,
    totalMeals: 5,
    mealSubtotal: 47,
    discount: 0,
    salesTax: 0,
    totalPaid: 47,
    deliveryDate: "2026-09-27",
    stripeSessionId: "cs_test_123",
    mealBreakdown: "Big Chicken — No Sauce ×3\nBig Beef — No Sauce ×2",
    paymentStatus: "paid",
    orderStatus: "New",
    notes: "Stripe Tax: $0.00",
    smsConsent: "Yes",
  });
});

test("exports an affirmative decline without inferring SMS consent", () => {
  assert.equal(buildOrderSheetPayload({ ...mixedOrder, smsConsentDecision: "no" }, "test").smsConsent, "No");
  assert.equal(buildOrderSheetPayload({ ...mixedOrder, smsConsentDecision: null }, "test").smsConsent, "");
});

test("records each meal's sauce beside the correct meal", () => {
  const order = {
    ...mixedOrder,
    id: "order-sauces",
    items: JSON.stringify([
      { productId: "big-chicken", quantity: 1, sauceId: "franks-redhot" },
      { productId: "big-chicken", quantity: 1, sauceId: "bbq" },
      { productId: "little-beef", quantity: 1, sauceId: "no-sauce" },
    ]),
    amountCents: 3_100,
    subtotalCents: 3_100,
  };

  assert.equal(
    buildOrderSheetPayload(order, "test").mealBreakdown,
    "Big Chicken — Franks' RedHot ×1\nBig Chicken — BBQ ×1\nLittle Beef — No Sauce ×1",
  );
});

test("rebuilds the Sheets payload from validated D1 data, not client prices", () => {
  assert.throws(() => buildOrderSheetPayload({ ...mixedOrder, amountCents: 1 }, "test"), /failed Google Sheets export validation/);
  assert.throws(() => buildOrderSheetPayload({ ...mixedOrder, items: "not-json" }, "test"), /invalid cart data/);
});

test("exports historical Stripe-confirmed pricing without repricing against the current catalog", () => {
  const historicalOrder = {
    ...mixedOrder,
    items: JSON.stringify([
      { productId: "big-chicken", quantity: 2 },
      { productId: "big-beef", quantity: 1 },
      { productId: "little-chicken", quantity: 1 },
      { productId: "little-beef", quantity: 1 },
    ]),
    amountCents: 4_400,
    subtotalCents: 4_400,
  };

  const payload = buildOrderSheetPayload(historicalOrder, "test");
  assert.equal(payload.totalMeals, 5);
  assert.equal(payload.mealSubtotal, 44);
  assert.equal(payload.totalPaid, 44);
  assert.equal(payload.bigChickenQty, 2);
  assert.equal(payload.bigBeefQty, 1);
  assert.equal(payload.littleChickenQty, 1);
  assert.equal(payload.littleBeefQty, 1);
});

test("rejects unknown products and malformed quantities in confirmed order data", () => {
  assert.throws(() => buildOrderSheetPayload({
    ...mixedOrder,
    items: JSON.stringify([{ productId: "unrecognized-sku", quantity: 5 }]),
  }, "test"), /failed Google Sheets export validation/);
  assert.throws(() => buildOrderSheetPayload({
    ...mixedOrder,
    items: JSON.stringify([{ productId: "big-chicken", quantity: 2.5 }]),
  }, "test"), /failed Google Sheets export validation/);
});

test("uses bounded exponential retry delays", () => {
  assert.equal(getRetryDelaySeconds(1), 300);
  assert.equal(getRetryDelaySeconds(2), 600);
  assert.equal(getRetryDelaySeconds(99), 21_600);
});

test("sends only the validated order payload and reports success or duplicate", async () => {
  let request;
  const result = await withEnvironment({
    GOOGLE_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_SYNC_SECRET: "test-sync-secret",
  }, () => sendOrderToGoogleSheets(buildOrderSheetPayload(mixedOrder, "test"), {
    fetchImpl: async (url, init) => {
      request = { url, init };
      return response({ ok: true, duplicate: true });
    },
  }));

  assert.deepEqual(result, { ok: true, duplicate: true });
  assert.equal(request.url, "https://script.google.com/macros/s/example/exec");
  const body = JSON.parse(request.init.body);
  assert.equal(body.secret, "test-sync-secret");
  assert.equal(body.order.totalMeals, 5);
  assert.equal(body.order.totalPaid, 47);
  assert.equal(body.order.bigChickenQty, 3);
  assert.equal(body.order.bigBeefQty, 2);
  assert.equal(body.order.littleChickenQty, 0);
  assert.equal(body.order.littleBeefQty, 0);
  assert.equal(body.order.mealBreakdown, "Big Chicken — No Sauce ×3\nBig Beef — No Sauce ×2");
});

test("keeps Sheets failures retryable and never turns them into fulfillment failures", async () => {
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  await withEnvironment({ GOOGLE_SHEETS_WEB_APP_URL: undefined, GOOGLE_SHEETS_SYNC_SECRET: undefined }, async () => {
    assert.deepEqual(await sendOrderToGoogleSheets(payload), { ok: false, reason: "not_configured" });
  });

  await withEnvironment({
    GOOGLE_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_SYNC_SECRET: "test-sync-secret",
  }, async () => {
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => response({ error: "temporary" }, { ok: false, status: 503 }),
    }), { ok: false, reason: "http_503", endpointError: "temporary" });
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => response(new Error("not-json")),
    }), { ok: false, reason: "malformed_response" });
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => response({ ok: false }),
    }), { ok: false, reason: "endpoint_rejected" });
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => response({ ok: false, error: "Spreadsheet destination is not configured." }),
    }), { ok: false, reason: "spreadsheet_not_configured", endpointError: "Spreadsheet destination is not configured." });
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => response({ ok: false, error: "Configured spreadsheet could not be opened." }),
    }), { ok: false, reason: "spreadsheet_unavailable", endpointError: "Configured spreadsheet could not be opened." });
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => { throw new Error("network down"); },
    }), { ok: false, reason: "network_error" });
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => { throw new DOMException("aborted", "AbortError"); },
    }), { ok: false, reason: "timeout" });
    assert.deepEqual(await withEnvironment({
      GOOGLE_SHEETS_WEB_APP_URL: "http://attacker.example/collect",
      GOOGLE_SHEETS_SYNC_SECRET: "test-sync-secret",
    }, () => sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => { throw new Error("must not be called"); },
    })), { ok: false, reason: "not_configured" });
  });
});

test("logs the full Apps Script reply without logging the sync secret", async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...values) => logs.push(values.join(" "));
  try {
    await withEnvironment({
      GOOGLE_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/example/exec",
      GOOGLE_SHEETS_SYNC_SECRET: "never-log-this-secret",
    }, () => sendOrderToGoogleSheets(buildOrderSheetPayload(mixedOrder, "test"), {
      fetchImpl: async () => response({ ok: false, error: "Missing required order field" }),
    }));
  } finally {
    console.log = originalLog;
  }
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Missing required order field/);
  assert.doesNotMatch(logs[0], /never-log-this-secret/);
});

function loadAppsScript(allowedMode = "test", spreadsheetId = "staging-spreadsheet-id", options = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), "google-apps-script/Code.gs"), "utf8");
  const secret = "test-script-secret";
  const rows = [[
    "Order Date/Time", "Order ID", "Customer Name", "Phone", "Email", "Ithaca Delivery Address",
    "Big Chicken Qty", "Little Chicken Qty", "Big Beef Qty", "Little Beef Qty", "Total Meals", "Meal Subtotal", "Discount", "Sales Tax", "Total Paid",
    "Delivery Date", "Stripe Session ID", "Meal Breakdown", "Payment Status", "Order Status", "Name", "Notes", "SMS Consent — Orders + Promotions",
  ]];
  const sheet = {
    getName: () => "Orders",
    getLastRow: () => rows.length,
    getRange: (row, column, rowCount, columnCount) => ({
      getValues: () => rows.slice(row - 1, row - 1 + rowCount).map((value) => value.slice(column - 1, column - 1 + columnCount)),
      setValues: (values) => { for(let r=0;r<values.length;r++)for(let c=0;c<values[r].length;c++)rows[row-1+r][column-1+c]=values[r][c]; },
      setValue: (value) => { rows[row-1][column-1]=value; },
    }),
    appendRow: (row) => rows.push(row),
  };
  const configuredSheet = Object.prototype.hasOwnProperty.call(options, "sheet") ? options.sheet : sheet;
  const openedSpreadsheetIds = [];
  const properties = {
    GOOGLE_SHEETS_SYNC_SECRET: secret,
    GOOGLE_SHEETS_ALLOWED_STRIPE_MODE: allowedMode,
    GOOGLE_SHEETS_SPREADSHEET_ID: spreadsheetId,
    ...(options.weeklyEnabled ? {WEEKLY_EXPORTS_ENABLED: "true"} : {}),
  };
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key] || "" }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: {
      openById: (id) => {
        openedSpreadsheetIds.push(id);
        if (options.openByIdError) throw new Error(options.openByIdError);
        return { getName: () => "ThreeByrd Weekly Orders - STAGING", getSheetByName: () => configuredSheet };
      },
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (value) => ({ value, setMimeType() { return this; } }),
    },
  };
  vm.runInNewContext(source, context);
  return { context, rows, secret, openedSpreadsheetIds };
}

test("Apps Script authenticates, opens the configured spreadsheet, appends one row, and refuses duplicate rows", () => {
  const { context, rows, secret, openedSpreadsheetIds } = loadAppsScript();
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  const request = { postData: { contents: JSON.stringify({ secret, order: payload }) } };

  const inserted = JSON.parse(context.doPost(request).value);
  assert.deepEqual(inserted, {
    ok: true,
    inserted: true,
    spreadsheetName: "ThreeByrd Weekly Orders - STAGING",
    worksheetName: "Orders",
    lastRow: 2,
    headersValid: true,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], "order-123");
  assert.equal(rows[1][10], 5);
  assert.equal(rows[1][11], 47);
  assert.equal(rows[1][12], 0);
  assert.equal(rows[1][13], 0);
  assert.equal(rows[1][14], 47);
  assert.equal(rows[1][16], "cs_test_123");
  assert.equal(rows[1][17], "Big Chicken — No Sauce ×3\nBig Beef — No Sauce ×2");
  assert.equal(rows[1][18], "paid");
  assert.equal(rows[1][19], "New");
  assert.equal(rows[1][20], "John Smith");
  assert.equal(rows[1][22], "Yes");
  assert.deepEqual(openedSpreadsheetIds, ["staging-spreadsheet-id"]);

  const duplicate = JSON.parse(context.doPost(request).value);
  assert.deepEqual(duplicate, {
    ok: true,
    duplicate: true,
    spreadsheetName: "ThreeByrd Weekly Orders - STAGING",
    worksheetName: "Orders",
    lastRow: 2,
    headersValid: true,
    matchingRow: 2,
  });
  assert.equal(rows.length, 2);

  const wrongMode = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({
      secret,
      order: { ...payload, stripeMode: "live", stripeSessionId: "cs_live_123" },
    }) },
  }).value);
  assert.deepEqual(wrongMode, { ok: false, error: "Wrong Stripe environment" });
  assert.equal(rows.length, 2);

  const unauthorized = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({ secret: "wrong", order: payload }) },
  }).value);
  assert.deepEqual(unauthorized, { ok: false, error: "Unauthorized" });
  assert.equal(rows.length, 2);
});

test("Apps Script fails safely when the spreadsheet ID is missing", () => {
  const { context, rows, secret, openedSpreadsheetIds } = loadAppsScript("test", "");
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  const response = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({ secret, order: payload }) },
  }).value);
  assert.deepEqual(response, { ok: false, error: "Spreadsheet destination is not configured." });
  assert.equal(rows.length, 1);
  assert.deepEqual(openedSpreadsheetIds, []);
});

test("Apps Script returns a safe error when the configured spreadsheet cannot be opened", () => {
  const { context, rows, secret } = loadAppsScript("test", "missing-spreadsheet-id", { openByIdError: "not found" });
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  const response = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({ secret, order: payload }) },
  }).value);
  assert.deepEqual(response, { ok: false, error: "Configured spreadsheet could not be opened." });
  assert.equal(rows.length, 1);
});

test("Apps Script returns a safe error when the Orders worksheet is unavailable", () => {
  const { context, rows, secret } = loadAppsScript("test", "staging-spreadsheet-id", { sheet: null });
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  const response = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({ secret, order: payload }) },
  }).value);
  assert.deepEqual(response, { ok: false, error: "Orders worksheet was not found." });
  assert.equal(rows.length, 1);
});

test("Apps Script rejects test payloads in a live-mode project", () => {
  const { context, secret } = loadAppsScript("live");
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  const response = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({ secret, order: payload }) },
  }).value);
  assert.deepEqual(response, { ok: false, error: "Wrong Stripe environment" });
});

test("Apps Script stores formula-like customer text as literal text", () => {
  const { context, rows, secret } = loadAppsScript();
  const payload = {
    ...buildOrderSheetPayload(mixedOrder, "test"),
    customerName: "=HYPERLINK(\"https://example.com\")",
    deliveryAddress: "+not-a-formula-command",
    notes: "@literal",
  };
  const response = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({ secret, order: payload }) },
  }).value);
  assert.deepEqual(response, {
    ok: true,
    inserted: true,
    spreadsheetName: "ThreeByrd Weekly Orders - STAGING",
    worksheetName: "Orders",
    lastRow: 2,
    headersValid: true,
  });
  assert.equal(rows[1][2], "'=HYPERLINK(\"https://example.com\")");
  assert.equal(rows[1][5], "'+not-a-formula-command");
  assert.equal(rows[1][20], "John Smith");
  assert.equal(rows[1][21], "'@literal");
});

test("the Apps Script source contains no credential material", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "google-apps-script/Code.gs"), "utf8");
  assert.doesNotMatch(source, /sk_(?:test|live)_|rk_(?:test|live)_|whsec_|AIza/);
  assert.match(source, /LockService/);
  assert.match(source, /GOOGLE_SHEETS_SYNC_SECRET/);
  assert.match(source, /GOOGLE_SHEETS_SPREADSHEET_ID/);
  assert.match(source, /SpreadsheetApp\.openById/);
  assert.doesNotMatch(source, /getActiveSpreadsheet/);
});

test("Apps Script diagnostic mode is authenticated and read-only", () => {
  const { context, rows, secret, openedSpreadsheetIds } = loadAppsScript();
  const diagnostic = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({ secret, diagnostic: true }) },
  }).value);
  assert.deepEqual(diagnostic, {
    ok: true,
    diagnostic: true,
    spreadsheetName: "ThreeByrd Weekly Orders - STAGING",
    worksheetName: "Orders",
    lastRow: 1,
    headersValid: true,
  });
  assert.equal(rows.length, 1);
  assert.deepEqual(openedSpreadsheetIds, ["staging-spreadsheet-id"]);

  const unauthorized = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({ secret: "wrong", diagnostic: true }) },
  }).value);
  assert.deepEqual(unauthorized, { ok: false, error: "Unauthorized" });
});

test("doGet cannot be mistaken for an export success", () => {
  const { context } = loadAppsScript();
  assert.deepEqual(JSON.parse(context.doGet().value), {
    ok: true,
    service: "threebyrd-orders",
    exportResult: false,
  });
});

test("generic ok responses, malformed success, and doGet-shaped responses stay retryable", async () => {
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  await withEnvironment({
    GOOGLE_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_SYNC_SECRET: "test-sync-secret",
  }, async () => {
    for (const body of [{ ok: true }, { ok: true, exportResult: false }, { ok: true, inserted: true, duplicate: true }]) {
      assert.deepEqual(await sendOrderToGoogleSheets(payload, {
        fetchImpl: async () => response(body),
      }), { ok: false, reason: "endpoint_rejected" });
    }
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => response({ ok: true, inserted: true }),
    }), { ok: true, duplicate: false });
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => response({ ok: true, duplicate: true }),
    }), { ok: true, duplicate: true });
    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => response({ ok: true, updated: true }),
    }), { ok: true, duplicate: false });
  });
});

test("Apps Script redirects are followed with GET after the initial POST, while unsafe redirects remain retryable", async () => {
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  await withEnvironment({
    GOOGLE_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_SYNC_SECRET: "test-sync-secret",
  }, async () => {
    const requests = [];
    const result = await sendOrderToGoogleSheets(payload, {
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        if (requests.length === 1) {
          return { ok: false, status: 302, headers: new Headers({ location: "https://script.googleusercontent.com/macros/echo?token=opaque" }) };
        }
        return response({ ok: true, inserted: true });
      },
    });
    assert.deepEqual(result, { ok: true, duplicate: false });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].init.method, "POST");
    assert.equal(requests[1].init.method, "GET");
    assert.equal(requests[1].init.body, undefined);
    assert.equal(requests[1].init.redirect, "manual");

    assert.deepEqual(await sendOrderToGoogleSheets(payload, {
      fetchImpl: async () => ({ ok: false, status: 302, headers: new Headers({ location: "https://attacker.example/collect" }) }),
    }), { ok: false, reason: "http_302" });
  });
});

test("Apps Script never replays POST to a 307 or 308 redirect", async () => {
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  await withEnvironment({
    GOOGLE_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_SYNC_SECRET: "test-sync-secret",
  }, async () => {
    for (const status of [307, 308]) {
      const requests = [];
      const result = await sendOrderToGoogleSheets(payload, {
        fetchImpl: async (url, init) => {
          requests.push({ url, init });
          return { ok: false, status, headers: new Headers({ location: "https://script.googleusercontent.com/macros/echo?token=opaque" }) };
        },
      });

      assert.deepEqual(result, { ok: false, reason: `http_${status}` });
      assert.equal(requests.length, 1);
      assert.equal(requests[0].init.method, "POST");
    }
  });
});

test("Apps Script rejects an unsafe redirect after an allowed first redirect", async () => {
  const payload = buildOrderSheetPayload(mixedOrder, "test");
  await withEnvironment({
    GOOGLE_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_SYNC_SECRET: "test-sync-secret",
  }, async () => {
    const requests = [];
    const result = await sendOrderToGoogleSheets(payload, {
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        if (requests.length === 1) {
          return { ok: false, status: 302, headers: new Headers({ location: "https://script.googleusercontent.com/macros/echo?token=opaque" }) };
        }
        return { ok: false, status: 302, headers: new Headers({ location: "https://attacker.example/collect" }) };
      },
    });

    assert.deepEqual(result, { ok: false, reason: "http_302" });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].init.method, "POST");
    assert.equal(requests[1].init.method, "GET");
  });
});

test("request body helper keeps the shared secret server-side", () => {
  const body = buildGoogleSheetsRequestBody(buildOrderSheetPayload(mixedOrder, "test"), "test-sync-secret");
  assert.equal(JSON.parse(body).order.stripeSessionId, "cs_test_123");
  assert.equal(JSON.parse(body).secret, "test-sync-secret");
});

test("destination diagnostic uses the same server-side secret and accepts only diagnostic responses", async () => {
  let request;
  const result = await withEnvironment({
    GOOGLE_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_SYNC_SECRET: "test-sync-secret",
  }, () => inspectGoogleSheetsDestination({
    fetchImpl: async (url, init) => {
      request = { url, init };
      return response({
        ok: true,
        diagnostic: true,
        spreadsheetName: "ThreeByrd Weekly Orders - STAGING",
        worksheetName: "Orders",
        lastRow: 1,
        headersValid: true,
      });
    },
  }));

  assert.deepEqual(result, {
    ok: true,
    diagnostics: {
      spreadsheetName: "ThreeByrd Weekly Orders - STAGING",
      worksheetName: "Orders",
      lastRow: 1,
      headersValid: true,
    },
  });
  assert.equal(request.url, "https://script.google.com/macros/s/example/exec");
  assert.deepEqual(JSON.parse(request.init.body), { secret: "test-sync-secret", diagnostic: true });
  assert.equal(buildGoogleSheetsDiagnosticRequestBody("test-sync-secret"), request.init.body);
});

test('PaymentIntent order references are accepted only in the pinned test workbook', () => {
  const payload = buildOrderSheetPayload(mixedOrder, 'test');
  delete payload.stripeSessionId;
  payload.stripePaymentIntentId = 'pi_recurringTest123';
  for (const [mode,id,allowed] of [['test','1yIAcqcs5jdivSJb1AfAxNiu8b4_MuFzLD0B8SpUY4oE',true],['test','different-workbook',false],['live','production-workbook',false]]) {
    const {context,rows,secret}=loadAppsScript(mode,id);
    const request={postData:{contents:JSON.stringify({secret,order:{...payload,stripeMode:mode}})}};
    const result=JSON.parse(context.doPost(request).value);
    assert.equal(result.ok,allowed);
    if(allowed){assert.equal(rows[1][16],payload.stripePaymentIntentId);assert.equal(JSON.parse(context.doPost(request).value).duplicate,true);assert.equal(rows.length,2);}
    else assert.equal(rows.length,1);
  }
});

test('staging weekly revisions update one kitchen row in order and preserve operator status', () => {
 const {context,rows,secret}=loadAppsScript('test','1yIAcqcs5jdivSJb1AfAxNiu8b4_MuFzLD0B8SpUY4oE');
 const payload=buildOrderSheetPayload(mixedOrder,'test');const post=order=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({secret,order})}}).value);
 assert.equal(post(payload).inserted,true);rows[1][19]='Packed';rows[1][21]='Operator note';
 const revision={...payload,bigChickenQty:payload.bigChickenQty+1,totalMeals:payload.totalMeals+1,mealSubtotal:payload.mealSubtotal+10,totalPaid:payload.totalPaid+10,weeklyRevision:1};
 assert.equal(post({...revision,weeklyRevision:2}).ok,false);assert.equal(rows[1][10],payload.totalMeals);
 assert.equal(post(revision).updated,true);assert.equal(rows.length,2);assert.equal(rows[1][10],revision.totalMeals);assert.equal(rows[1][19],'Packed');assert.match(rows[1][21],/Operator note/);assert.match(rows[1][21],/weekly-revision:1/);
 assert.equal(post(revision).duplicate,true);assert.equal(post({...revision,orderId:'different'}).ok,false);
});

test('production weekly receiver requires pinned workbook plus explicit flag and preserves one-time exports',()=>{
 const id='1NCVNbcIUnzH5nMhlxvu1qus2xPIOOC-JOx4rHqJ-Or8';
 for(const enabled of [false,true]){
  const {context,rows,secret}=loadAppsScript('live',id,{weeklyEnabled:enabled});
  const post=order=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({secret,order})}}).value);
  const oneTime={...buildOrderSheetPayload(mixedOrder,'test'),stripeMode:'live',stripeSessionId:'cs_live_fixture'};
  assert.equal(post(oneTime).inserted,true);
  const recurring={...oneTime,orderId:'recurring-live',stripeSessionId:undefined,stripePaymentIntentId:'pi_liveFixture'};
  assert.equal(post(recurring).ok,enabled);
  if(enabled){const result=post({...recurring,weeklyRevision:1});assert.equal(result.updated,true);assert.equal(rows.length,3);assert.equal(result.spreadsheetId,id);assert.equal(post({...recurring,weeklyRevision:1}).duplicate,true)}
 }
});
