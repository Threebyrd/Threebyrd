const ORDER_SHEET_NAME = "Orders";
const SYNC_SECRET_PROPERTY = "GOOGLE_SHEETS_SYNC_SECRET";
const SPREADSHEET_ID_PROPERTY = "GOOGLE_SHEETS_SPREADSHEET_ID";
const ORDER_HEADERS = [
  "Order Date/Time",
  "Order ID",
  "Customer Name",
  "Phone",
  "Email",
  "Ithaca Delivery Address",
  "Big Chicken Qty",
  "Little Chicken Qty",
  "Big Beef Qty",
  "Little Beef Qty",
  "Total Meals",
  "Meal Subtotal",
  "Discount",
  "Sales Tax",
  "Total Paid",
  "Delivery Date",
  "Stripe Session ID",
  "Meal Breakdown",
  "Payment Status",
  "Order Status",
  "Name",
  "Notes",
  "SMS Consent — Orders + Promotions",
];

function doPost(e) {
  try {
    const body = parseRequestBody(e);
    const configuredSecret = PropertiesService.getScriptProperties().getProperty(SYNC_SECRET_PROPERTY) || "";
    if (!configuredSecret || !secureEqual(String(body.secret || ""), configuredSecret)) {
      return json({ ok: false, error: "Unauthorized" });
    }

    const order = body.order;
    const allowedMode = PropertiesService.getScriptProperties().getProperty("GOOGLE_SHEETS_ALLOWED_STRIPE_MODE") || "";
    if (allowedMode !== "test" && allowedMode !== "live") {
      return json({ ok: false, error: "Wrong Stripe environment" });
    }

    if (body.diagnostic === true) {
      return inspectConfiguredDestination();
    }

    if (!order || order.stripeMode !== allowedMode) {
      return json({ ok: false, error: "Wrong Stripe environment" });
    }
    const validationError = validateOrder(order);
    if (validationError) {
      return json({ ok: false, error: validationError });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY) || "";
      if (!spreadsheetId) {
        return json({ ok: false, error: "Spreadsheet destination is not configured." });
      }

      let spreadsheet;
      try {
        spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      } catch (error) {
        return json({ ok: false, error: "Configured spreadsheet could not be opened." });
      }

      let sheet;
      try {
        sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
      } catch (error) {
        return json({ ok: false, error: "Orders worksheet could not be opened." });
      }
      if (!sheet) {
        return json({ ok: false, error: "Orders worksheet was not found." });
      }

      validateHeaders(sheet);
      const rows = readOrderRows(sheet);
      const matchingRow = rows.findIndex(function(row) {
        return String(row[1]) === order.orderId || String(row[16]) === paymentReference(order);
      });
      const destination = getDestinationDiagnostics(spreadsheet, sheet, true);
      if (order.weeklyRevision !== undefined) {
        if (!weeklyFeaturesEnabled() || !Number.isSafeInteger(order.weeklyRevision) || order.weeklyRevision < 1 || matchingRow < 0) return json({ ok: false, error: "Weekly revisions require an existing staging order" });
        const existing = rows[matchingRow];
        if (String(existing[1]) !== order.orderId || String(existing[16]) !== paymentReference(order)) return json({ ok: false, error: "Revision payment reference mismatch" });
        const marker = String(existing[21]).match(/\[weekly-revision:(\d+)\]/);
        const current = marker ? Number(marker[1]) : 0;
        if (current === order.weeklyRevision) return json({ ok: true, duplicate: true, revision: current, ...destination, matchingRow: matchingRow + 2 });
        if (current + 1 !== order.weeklyRevision) return json({ ok: false, error: "Weekly revision out of sequence" });
        const revised = toSheetRow(order);
        // Preserve contact fields, payment identity and manually managed kitchen status.
        sheet.getRange(matchingRow + 2, 7, 1, 9).setValues([revised.slice(6, 15)]);
        sheet.getRange(matchingRow + 2, 18).setValue(revised[17]);
        sheet.getRange(matchingRow + 2, 22).setValue(safeSheetText(String(existing[21]).replace(/\s*\[weekly-revision:\d+\]/g, "") + " | Revision " + order.weeklyRevision + ": current meal total " + order.totalMeals + "; current paid total " + order.totalPaid + " [weekly-revision:" + order.weeklyRevision + "]"));
        return json({ ok: true, updated: true, revision: order.weeklyRevision, ...destination, matchingRow: matchingRow + 2 });
      }
      if (matchingRow >= 0) {
        return json({ ok: true, duplicate: true, ...destination, matchingRow: matchingRow + 2 });
      }

      sheet.appendRow(toSheetRow(order));
      return json({ ok: true, inserted: true, ...getDestinationDiagnostics(spreadsheet, sheet, true) });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json({ ok: false, error: "The order could not be added to the sheet." });
  }
}

function doGet() {
  return json({ ok: true, service: "threebyrd-orders", exportResult: false });
}

function inspectConfiguredDestination() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY) || "";
    if (!spreadsheetId) {
      return json({ ok: false, error: "Spreadsheet destination is not configured." });
    }

    let spreadsheet;
    try {
      spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      return json({ ok: false, error: "Configured spreadsheet could not be opened." });
    }

    let sheet;
    try {
      sheet = spreadsheet.getSheetByName(ORDER_SHEET_NAME);
    } catch (error) {
      return json({ ok: false, error: "Orders worksheet could not be opened." });
    }
    if (!sheet) {
      return json({ ok: false, error: "Orders worksheet was not found." });
    }

    try {
      validateHeaders(sheet);
    } catch (error) {
      return json({ ok: false, error: "Orders worksheet headers do not match the expected structure." });
    }

    return json({ ok: true, diagnostic: true, ...getDestinationDiagnostics(spreadsheet, sheet, true) });
  } finally {
    lock.releaseLock();
  }
}

function getDestinationDiagnostics(spreadsheet, sheet, headersValid) {
  return {
    spreadsheetName: String(spreadsheet.getName()),
    worksheetName: String(sheet.getName()),
    lastRow: sheet.getLastRow(),
    headersValid: headersValid === true,
    ...(weeklyFeaturesEnabled() ? { spreadsheetId: PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY), supportsWeeklyPaymentIntents: true, supportsWeeklyRevisions: true } : {}),
  };
}

function parseRequestBody(e) {
  if (!e || !e.postData || typeof e.postData.contents !== "string") {
    throw new Error("Missing request body");
  }
  const body = JSON.parse(e.postData.contents);
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }
  return body;
}

function validateHeaders(sheet) {
  const actual = sheet.getRange(1, 1, 1, ORDER_HEADERS.length).getValues()[0].map(String);
  if (JSON.stringify(actual) !== JSON.stringify(ORDER_HEADERS)) {
    throw new Error("Orders worksheet headers do not match the expected structure");
  }
}

function readOrderRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, ORDER_HEADERS.length).getValues();
}

function validateOrder(order) {
  if (!order || typeof order !== "object") return "Missing order";
  const requiredStrings = ["stripeMode", "orderDateTime", "orderId", "recipientName", "email", "deliveryAddress", "deliveryDate", "mealBreakdown"];
  for (let i = 0; i < requiredStrings.length; i += 1) {
    if (typeof order[requiredStrings[i]] !== "string" || !order[requiredStrings[i]].trim()) return "Missing required order field";
  }

  if (!/^(test|live)$/.test(order.stripeMode)) return "Invalid Stripe mode";
  if (order.stripePaymentIntentId) {
    if (!weeklyFeaturesEnabled() || order.stripeSessionId || !/^pi_[a-zA-Z0-9]+$/.test(order.stripePaymentIntentId)) return "Recurring payments are staging-only";
  } else if (typeof order.stripeSessionId !== "string" || !new RegExp("^cs_" + order.stripeMode + "_").test(order.stripeSessionId)) return "Invalid Stripe session";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) return "Invalid customer email";
  if (!/^(paid|no_payment_required)$/.test(order.paymentStatus) || order.orderStatus !== "New") return "Invalid order status";
  if (!/^(Yes|No)?$/.test(order.smsConsent || "")) return "Invalid SMS consent";

  const quantities = ["bigChickenQty", "littleChickenQty", "bigBeefQty", "littleBeefQty"].map(function(key) {
    return order[key];
  });
  if (!quantities.every(function(value) { return Number.isInteger(value) && value >= 0; })) return "Invalid meal quantities";
  if (!Number.isInteger(order.totalMeals) || order.totalMeals < 3) return "Invalid meal total";
  if (quantities.reduce(function(total, value) { return total + value; }, 0) !== order.totalMeals) return "Meal total does not match quantities";
  const moneyFields = ["mealSubtotal", "discount", "salesTax", "totalPaid"];
  if (!moneyFields.every(function(key) {
    return typeof order[key] === "number" && Number.isFinite(order[key]) && order[key] >= 0;
  })) return "Invalid order totals";
  if (Math.abs((order.mealSubtotal - order.discount + order.salesTax) - order.totalPaid) > 0.001) return "Order totals do not reconcile";
  return null;
}

function toSheetRow(order) {
  return [
    safeSheetText(order.orderDateTime),
    safeSheetText(order.orderId),
    safeSheetText(order.customerName || ""),
    safeSheetText(order.phone || ""),
    safeSheetText(order.email),
    safeSheetText(order.deliveryAddress),
    order.bigChickenQty,
    order.littleChickenQty,
    order.bigBeefQty,
    order.littleBeefQty,
    order.totalMeals,
    order.mealSubtotal,
    order.discount,
    order.salesTax,
    order.totalPaid,
    safeSheetText(order.deliveryDate),
    safeSheetText(paymentReference(order)),
    safeSheetText(order.mealBreakdown),
    safeSheetText(order.paymentStatus),
    safeSheetText(order.orderStatus),
    safeSheetText(order.recipientName),
    safeSheetText(order.notes || ""),
    safeSheetText(order.smsConsent || ""),
  ];
}

function safeSheetText(value) {
  const text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function secureEqual(left, right) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) {
    difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return difference === 0;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function paymentReference(order) { return order.stripeSessionId || order.stripePaymentIntentId || ""; }

// Existing one-time Checkout exports remain valid regardless of this feature flag.
function weeklyFeaturesEnabled() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(SPREADSHEET_ID_PROPERTY);
  const mode = props.getProperty("GOOGLE_SHEETS_ALLOWED_STRIPE_MODE");
  return mode === "test" && id === "1yIAcqcs5jdivSJb1AfAxNiu8b4_MuFzLD0B8SpUY4oE" || mode === "live" && id === "1NCVNbcIUnzH5nMhlxvu1qus2xPIOOC-JOx4rHqJ-Or8" && props.getProperty("WEEKLY_EXPORTS_ENABLED") === "true";
}
