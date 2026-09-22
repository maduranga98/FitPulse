#!/usr/bin/env node
// Rules test for the blocked-attendance split (utils/attendanceFilters.js).
//
//   node src/utils/attendanceFilters.test.js
//
// What this file asserts is which check-ins a gym's attendance figures count.
// A false positive here hides a paying member's visit; a false negative puts a
// blocked member back into the numbers the owner reports on.

import assert from "assert";
import {
  blockedMemberKeys,
  isBlockedRecord,
  splitBlockedAttendance,
} from "./attendanceFilters.js";
import { isBlockedMember } from "./paymentTotals.js";

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

const members = [
  { id: "m1", name: "Active", memberCode: "101", status: "active" },
  { id: "m2", name: "App blocked", memberCode: "102", status: "blocked" },
  { id: "m3", name: "Door blocked", memberCode: 103, accessBlocked: true },
  { id: "m4", name: "Auto blocked", memberCode: "104", autoBlocked: true },
  { id: "m5", name: "Inactive", memberCode: "105", status: "inactive" },
  { id: "m6", name: "Unpaid but in", memberCode: "106", status: "active", accessBlocked: false },
];
const keys = blockedMemberKeys(members);

// ── who counts as blocked ────────────────────────────────────────────
check("a staff app block counts", () => assert.ok(isBlockedMember(members[1])));
check("a confirmed door block counts", () => assert.ok(isBlockedMember(members[2])));
check("a queued auto block counts", () => assert.ok(isBlockedMember(members[3])));
check("inactive is not blocked", () => assert.ok(!isBlockedMember(members[4])));
check("accessBlocked:false is not blocked", () => assert.ok(!isBlockedMember(members[5])));
check("a missing member is not blocked", () => assert.ok(!isBlockedMember(null)));

// ── matching records to members ──────────────────────────────────────
check("matches on memberId", () => assert.ok(isBlockedRecord({ memberId: "m2" }, keys)));
check("matches an unidentified scan on its employeeNo", () =>
  assert.ok(isBlockedRecord({ rawEvent: { employeeNo: "102" } }, keys))
);
check("matches a numeric member code sent as a string", () =>
  assert.ok(isBlockedRecord({ employeeNo: "103" }, keys))
);
check("an active member's scan is not blocked", () =>
  assert.ok(!isBlockedRecord({ memberId: "m1", employeeNo: "101" }, keys))
);
check("an unmatched scan is not blocked", () =>
  assert.ok(!isBlockedRecord({ employeeNo: "999" }, keys))
);
check("an empty code never matches", () =>
  assert.ok(!isBlockedRecord({ memberId: "", employeeNo: "  " }, keys))
);
check("no blocked members means nothing is filtered", () =>
  assert.ok(!isBlockedRecord({ memberId: "m2" }, blockedMemberKeys([])))
);

// ── the split ────────────────────────────────────────────────────────
check("blocked scans are separated, order kept", () => {
  const { visible, blocked } = splitBlockedAttendance(
    [
      { id: "a", memberId: "m1" },
      { id: "b", memberId: "m2" },
      { id: "c", memberId: "m5" },
      { id: "d", employeeNo: "104" },
    ],
    keys
  );
  assert.deepStrictEqual(visible.map((r) => r.id), ["a", "c"]);
  assert.deepStrictEqual(blocked.map((r) => r.id), ["b", "d"]);
});
check("an empty list splits into two empty lists", () => {
  const { visible, blocked } = splitBlockedAttendance(null, keys);
  assert.deepStrictEqual([visible, blocked], [[], []]);
});

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
