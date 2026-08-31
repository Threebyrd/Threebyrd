const SHEET_NAME = "Signups";
const NOTIFY_EMAIL = "";
const NOTIFY_SUBJECT = "New Threebyrd launch-list signup";

function doPost(e) {
  const params = (e && e.parameter) || {};
  const email = String(params.email || "").trim();
  const phone = String(params.phone || "").trim();

  if (!isValidEmail(email) && !isValidPhone(phone)) {
    return json({ ok: false, error: "Provide a valid email or phone number." });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Email", "Phone"]);
    }
    sheet.appendRow([new Date(), email, phone]);

    if (isValidEmail(NOTIFY_EMAIL)) {
      const lines = ["New launch-list signup:", ""];
      if (email) lines.push("Email: " + email);
      if (phone) lines.push("Phone: " + phone);
      MailApp.sendEmail(NOTIFY_EMAIL, NOTIFY_SUBJECT, lines.join("\n"));
    }

    return json({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, service: "threebyrd-signups" });
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^\+?[0-9\s().-]{7,20}$/.test(value);
}
