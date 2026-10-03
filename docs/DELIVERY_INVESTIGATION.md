# Delivery investigation — 2026-09-29

## Evidence before this change

- Isolated worktree based on `df776b1` (existing browser/Worker retry change).
- Live browser `OrderBuilder-CLps-7YF.js` contains the 250/750 ms retry delays.
- Existing production Worker version `12611e2c-6a60-420f-ae97-9492e13fab75`, deployed 13:25 UTC, contains the 150/450 ms provider retry delays.
- Public kitchen checks succeeded with Chrome, Firefox and mobile Safari header variants; responses included the exact allowed CORS origin.
- A sanitized live Worker tail captured the kitchen probe with HTTP 200, outcome `ok`, zero logs and zero exceptions.
- Historical telemetry query returned HTTP 403, authentication error. Existing Worker settings had no observability configuration. No historical failed customer invocation could be inspected.
- The reported full message (including “Please try again.”) comes from the browser catch handler, not a normal Google error returned by this Worker. The public kitchen address also failed on the affected laptop. This makes input normalization an unlikely explanation; it does not identify DNS, TLS, filtering, CORS, or a regional outage definitively.
- A direct browser visit to the POST-only endpoint returns an empty HTTP 405. A blank page there is expected and is not evidence of a network failure.

## Confirmed code defects and changes

Google Geocoding can return HTTP 200 with an application error status and empty results. Previously these were treated as INVALID_ADDRESS, bypassing both provider retries and browser 503 retries. Classify status first; retry UNKNOWN_ERROR and OVER_QUERY_LIMIT within the existing three-attempt limit. Authorization/daily-limit failures remain unavailable, not invalid addresses, and are not retried. Never approve an address without a successful route within 20 minutes.

Provider diagnostics record only fixed provider/category labels, attempt number and HTTP status. No full addresses, coordinates, provider messages, URLs, keys, IPs or browser headers are recorded by these diagnostics. Network calls have an eight-second per-attempt timeout. Malformed payloads, missing credentials, missing route duration, CORS rejection and unexpected endpoint errors have separate categories. Enable persisted application logs with automatic invocation logging disabled.

The browser's connection-failure message now accurately distinguishes failure to connect from a returned provider error. This wording change is diagnostic; it does not repair the still-unconfirmed laptop/network problem.

## Local validation

- TypeScript, ESLint, Worker build and GitHub Pages build passed.
- 87 automated tests passed, including valid/invalid/out-of-zone addresses, transient and exhausted provider failures, HTTP-200 application errors, logging redaction, and browser-header CORS variants.
- Chrome at 390 x 844: valid, invalid, outside-zone, transient 503 recovery, repeated 503, and network rejection exercised with mocked API responses. Retry counts were 1/1/1/2/3/3. No horizontal overflow; error remains visible and verification remains required.
- Only the public kitchen address was submitted to production. No checkout or payment was initiated.

## Unresolved

The affected laptop's underlying failure is not yet proven or fixed. Compare the same public-kitchen form submission on the normal network and a phone hotspot. If it still fails, inspect only the request URL's origin/path, HTTP status or browser network-error code, preflight status, and Cloudflare request identifier; omit request bodies and customer addresses. Correlate with the newly persisted safe logs. Historical telemetry access also needs an appropriately authorized Cloudflare session.
