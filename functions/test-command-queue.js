#!/usr/bin/env node
// Rules test for the door-command queue (services/commandQueue.js).
//
//   npm test   (in functions/)
//
// The case that matters most is the one this file exists for: a relay agent
// that stopped running leaves commands at "pending" forever, and treating
// those as in-flight made every later sweep skip the member and report
// "nothing to do" while they kept walking in unblocked.

import assert from "assert";
import {
  classifyWaitingCommands,
  isWaiting,
  isRelayOnline,
  STALE_COMMAND_MS,
} from "./services/commandQueue.js";

let failures = 0;
const check = (label, fn) => {
  try {
    fn();
    console.log(`  ok  ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${label}: ${err.message}`);
  }
};

const now = new Date(2026, 8, 18, 10, 0, 0).getTime(); // 18 Sep 2026, 10:00
const agoMs = (ms) => new Date(now - ms);
const minutes = (n) => n * 60 * 1000;
const days = (n) => n * 24 * 60 * 60 * 1000;

const cmd = (status, queuedAt, id = status) => ({ id, status, queuedAt });

console.log("\nWhich commands are still waiting on the relay\n");

check("pending and processing are waiting; finished states are not", () => {
  assert.strictEqual(isWaiting({ status: "pending" }), true);
  assert.strictEqual(isWaiting({ status: "processing" }), true);
  assert.strictEqual(isWaiting({ status: "completed" }), false);
  assert.strictEqual(isWaiting({ status: "failed" }), false);
  assert.strictEqual(isWaiting({ status: "superseded" }), false);
  assert.strictEqual(isWaiting(undefined), false);
});

check("a command queued seconds ago is in flight, not abandoned", () => {
  const r = classifyWaitingCommands([cmd("pending", agoMs(5000))], now);
  assert.strictEqual(r.active, true);
  assert.strictEqual(r.stale.length, 0);
});

check("a command just under the threshold is still in flight", () => {
  const r = classifyWaitingCommands(
    [cmd("pending", agoMs(STALE_COMMAND_MS - minutes(1)))],
    now,
  );
  assert.strictEqual(r.active, true);
  assert.strictEqual(r.stale.length, 0);
});

check("a command past the threshold is abandoned", () => {
  const r = classifyWaitingCommands(
    [cmd("pending", agoMs(STALE_COMMAND_MS + minutes(1)))],
    now,
  );
  assert.strictEqual(r.active, false);
  assert.strictEqual(r.stale.length, 1);
});

// The production case: the relay died on 4 Sep, the nightly sweep queued a
// block on 16 Sep, nobody consumed it. A re-run must block this member.
check("a 2-day-old pending command does not count as in flight", () => {
  const r = classifyWaitingCommands([cmd("pending", agoMs(days(2)))], now);
  assert.strictEqual(r.active, false, "must not look in flight");
  assert.strictEqual(r.stale.length, 1, "must be offered up to supersede");
});

check("a command with NO timestamp is treated as in flight, never abandoned", () => {
  // A local write whose server timestamp hasn't landed yet. Abandoning it
  // would double-queue a command the relay is about to run.
  const r = classifyWaitingCommands([cmd("pending", null)], now);
  assert.strictEqual(r.active, true);
  assert.strictEqual(r.stale.length, 0);
});

check("one fresh command protects the member even alongside stale ones", () => {
  const r = classifyWaitingCommands(
    [cmd("pending", agoMs(days(2)), "old"), cmd("pending", agoMs(3000), "new")],
    now,
  );
  assert.strictEqual(r.active, true, "the fresh one is still being applied");
  assert.deepStrictEqual(r.stale.map((c) => c.id), ["old"]);
});

check("a relay that crashed mid-command releases it once it goes stale", () => {
  // processingStartedAt is what queuedAt carries for a claimed command.
  const r = classifyWaitingCommands(
    [cmd("processing", agoMs(days(1)))],
    now,
  );
  assert.strictEqual(r.active, false);
  assert.strictEqual(r.stale.length, 1);
});

check("finished commands are ignored entirely", () => {
  const r = classifyWaitingCommands(
    [
      cmd("completed", agoMs(days(5))),
      cmd("failed", agoMs(days(4))),
      cmd("superseded", agoMs(days(3))),
    ],
    now,
  );
  assert.strictEqual(r.active, false);
  assert.strictEqual(r.stale.length, 0);
  assert.strictEqual(r.oldestWaitingAt, null);
});

check("an empty or missing queue is not active", () => {
  assert.strictEqual(classifyWaitingCommands([], now).active, false);
  assert.strictEqual(classifyWaitingCommands(null, now).active, false);
});

check("oldestWaitingAt reports the longest-waiting command", () => {
  const oldest = agoMs(days(3));
  const r = classifyWaitingCommands(
    [cmd("pending", agoMs(days(1)), "a"), cmd("pending", oldest, "b")],
    now,
  );
  assert.strictEqual(r.oldestWaitingAt.getTime(), oldest.getTime());
});

console.log("\nRelay liveness\n");

check("a heartbeat from seconds ago is online", () => {
  assert.strictEqual(isRelayOnline(agoMs(20000), now), true);
});

check("two missed heartbeats is offline", () => {
  assert.strictEqual(isRelayOnline(agoMs(minutes(2)), now), false);
});

check("a relay that has never run is offline, not online", () => {
  assert.strictEqual(isRelayOnline(null, now), false);
});

check("the 14-day outage that caused this is offline", () => {
  assert.strictEqual(isRelayOnline(agoMs(days(14)), now), false);
});

console.log(
  failures === 0
    ? "\nALL TESTS PASSED\n"
    : `\n${failures} TEST(S) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
