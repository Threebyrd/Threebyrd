import assert from "node:assert/strict";
import test from "node:test";
import {
  mayCreateSmsReminderJobs,
  normalizeSmsDestination,
  parseSmsReminderDecision,
} from "../app/reminder-consent.ts";

test("accepts only the strict yes/no reminder decision enum", () => {
  assert.equal(parseSmsReminderDecision("yes"), "yes");
  assert.equal(parseSmsReminderDecision("no"), "no");
  for (const value of [undefined, null, "", "true", true, false, 1, "YES", "maybe"]) {
    assert.equal(parseSmsReminderDecision(value), null);
  }
});

test("normalizes common US phone formats and rejects malformed destinations", () => {
  assert.equal(normalizeSmsDestination("(607) 555-0123"), "+16075550123");
  assert.equal(normalizeSmsDestination("+16075550123"), "+16075550123");
  assert.equal(normalizeSmsDestination("60755"), null);
});

test("only yes with a normalized destination can create reminder jobs", () => {
  assert.equal(mayCreateSmsReminderJobs("yes", "+16075550123"), true);
  assert.equal(mayCreateSmsReminderJobs("yes", null), false);
  assert.equal(mayCreateSmsReminderJobs("no", "+16075550123"), false);
});
