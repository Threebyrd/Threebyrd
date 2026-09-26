# ThreeByrd → Google Sheets setup

This integration replaces the unfinished Zapier export. The verified Stripe webhook and D1 database remain authoritative. Google Sheets is an asynchronous operational export only: a Sheets outage cannot reject payment, undo a confirmed order, or change capacity.

## Files

- `google-apps-script/Code.gs` is the self-contained Apps Script Web App for the existing `Orders` worksheet.
- `scripts/apps-script/Code.gs` is the existing launch-list signup handler and is unrelated to order exports.
- The Worker records a pending export in D1 after a confirmed order, then retries delivery from the scheduled Worker handler.

## Required worksheet

Open the existing `ThreeByrd Weekly Orders` spreadsheet and select the `Orders` worksheet. Row 1 must contain these headers, in this exact order:

```text
Order Date/Time | Order ID | Customer Name | Phone | Email | Ithaca Delivery Address | Big Chicken Qty | Little Chicken Qty | Big Beef Qty | Little Beef Qty | Total Meals | Total Paid | Delivery Date | Stripe Session ID | Payment Status | Order Status | Notes
```

Keep the existing Weekly Summary worksheet unchanged. `Total Paid` is written as a numeric dollar value, such as `47.00`, so the sheet can format it as currency.

## Apps Script deployment

1. Open `ThreeByrd Weekly Orders` in the Google account that owns the sheet.
2. Open **Extensions → Apps Script**.
3. Replace the Apps Script editor contents with the contents of `google-apps-script/Code.gs` and save.
4. Open **Project Settings → Script Properties** and add all three required properties:
   - `GOOGLE_SHEETS_SPREADSHEET_ID` — the exact ID of the destination spreadsheet. This is required; the script does not use or fall back to the active/container-bound spreadsheet.
   - `GOOGLE_SHEETS_SYNC_SECRET` — a newly generated strong random value.
   - `GOOGLE_SHEETS_ALLOWED_STRIPE_MODE` — exactly `live` for the production sheet or `test` for the staging sheet.
   Do not put the secret in this repository, a URL, a frontend bundle, or a log.
5. Choose **Deploy → New deployment**.
6. Select **Web app** as the deployment type.
7. Set **Execute as** to **Me** and **Who has access** to **Anyone**. The shared secret is the application-level write authentication.
8. Deploy, complete Google authorization if prompted, and copy the Web App URL ending in `/exec`.

The endpoint can be public because it rejects requests without the Script Property secret. It does not accept query-string secrets. Apps Script may return HTTP 200 for an application-level error; the Worker marks an export synced only for an explicit `{ "ok": true, "inserted": true }` or `{ "ok": true, "duplicate": true }` response. Generic `{ "ok": true }` and the health-check `doGet()` response are retryable failures.

During staging verification, confirm that the active `/exec` deployment is bound to the intended staging spreadsheet and that its `Orders` tab is the one being inspected. A successful `{ "ok": true }` response alone cannot identify which spreadsheet a container-bound Apps Script wrote to. If the Worker outbox becomes `synced` but the intended sheet remains header-only, inspect the Apps Script deployment’s bound file, redeploy the corrected `Code.gs`, and replace the staging Worker URL with that deployment’s `/exec` URL before declaring end-to-end validation complete.

The destination is now explicit rather than container-bound: `Code.gs` reads `GOOGLE_SHEETS_SPREADSHEET_ID` and calls `SpreadsheetApp.openById(...)`, then selects the `Orders` worksheet. If the property is missing, the spreadsheet cannot be opened, or the `Orders` worksheet is unavailable, the Web App returns a safe structured error and does not write a row. It never falls back to `SpreadsheetApp.getActiveSpreadsheet()`.

Successful writes and duplicate responses include only safe destination diagnostics: spreadsheet name, worksheet name, last row, and header validity. The authenticated `{ "secret": "...", "diagnostic": true }` POST performs a read-only destination check without appending a row. The staging Worker exposes this check only while `STRIPE_MODE=test` and `ORDERS_OPEN=false` at `POST /api/sheets-diagnostic`; it is not available in production configuration. `doGet()` includes `exportResult:false` and is never an export success response.

## Cloudflare staging configuration

After a separate staging Apps Script project and staging spreadsheet exist, add these server-only values to the `threebyrd-website-staging` Worker:

```text
GOOGLE_SHEETS_WEB_APP_URL=<the Apps Script /exec URL>
GOOGLE_SHEETS_SYNC_SECRET=<the same value stored in Script Properties>
```

Use Cloudflare secrets for `GOOGLE_SHEETS_SYNC_SECRET`. Set the staging Apps Script project's `GOOGLE_SHEETS_ALLOWED_STRIPE_MODE` property to `test`; set the production Apps Script project's property to `live`. Use separate Apps Script projects, spreadsheets, secrets, and Web App URLs so a staging test cannot write a test order into the production `Orders` tab. The Worker accepts only HTTPS `script.google.com/macros/s/<deployment>/exec` URLs. The Web App URL is server-only even though it is not itself a credential. Never add either value to a Pages environment or `NEXT_PUBLIC_*` variable.

The URL may be stored as a Worker secret, as it is for the staging setup. Do not define an empty `GOOGLE_SHEETS_WEB_APP_URL` entry in Wrangler `vars`: an empty variable can shadow the real secret at runtime. If the secret inventory is missing the URL, add it with the exact staging `/exec` URL before testing.

For staging, the stored URL must pass the Worker allowlist. In the Cloudflare Dashboard, edit the staging `GOOGLE_SHEETS_WEB_APP_URL` secret to the exact Apps Script deployment URL, interactively and without putting it in shell history or Git:

```text
https://script.google.com/macros/s/<deployment-id>/exec
```

It must use HTTPS, the `script.google.com/macros/s/<deployment-id>/exec` path, and no query string or fragment. Do not substitute a redirect URL or a `script.googleusercontent.com` URL.

If using Wrangler instead of the Dashboard, enter it only at the hidden prompt:

```bash
npx wrangler secret put GOOGLE_SHEETS_WEB_APP_URL --config wrangler.staging.jsonc
```

For staging, use the existing test Stripe/D1 environment and remove the synthetic staging row only after verifying every column. Do not deploy or configure production from this document. Production requires the same two values to be added to the production Worker separately after review and approval.

## Delivery and retry behavior

After `checkout.session.completed` or a successful asynchronous payment is verified, the Worker atomically confirms the D1 order and creates one `pending` `order_sheet_exports` row. A duplicate Stripe webhook cannot create another order or another outbox row.

Every five minutes the Worker claims pending or expired leases, rebuilds the row from validated D1 order data, and sends it to Apps Script. Success, including Apps Script's duplicate response, marks the outbox row `synced`. Timeouts, network failures, malformed responses, endpoint errors, or missing configuration retain the row as `pending` with exponential retry backoff (5 minutes up to 6 hours). A five-minute lease prevents overlapping scheduled runs from sending the same item concurrently.

The Apps Script uses `LockService` and refuses a row whose `Order ID` or `Stripe Session ID` already exists. This protects the sheet if the Worker retries after a response was lost.

## Verification checklist

- Send a staging test order only after the staging Worker migration and secrets are configured.
- Confirm one row appears in `Orders` with 17 populated columns and numeric quantities/total.
- Replay the same webhook or run the Worker retry; confirm the row count remains one.
- Confirm the D1 order and capacity reservation remain intact if Sheets is unavailable.
- Remove synthetic staging D1 data and the staging test row after the result is recorded.
- Keep staging `ORDERS_OPEN=false` after verification.
