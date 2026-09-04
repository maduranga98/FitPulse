#!/usr/bin/env node
// Rules test for automatic door blocking (services/paymentBlocking.js).
//
//   npm test   (in functions/)
//
// The cost of a false positive here is a paying member standing at a locked
// door, so most of these cases assert that someone is NOT blocked.

import assert from "assert";
import {
  isPaymentOverdue,
  skipReason,
  monthKey,
} from "./services/paymentBlocking.js";

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

// Gym collects on the 10th, no grace → blocking starts on day 10.
const blockFromDay = 10;
const today = new Date(2026, 8, 15); // 15 Sep 2026
today.setHours(0, 0, 0, 0);

const overdue = (member, paidThisMonth = false) =>
  isPaymentOverdue({ member, paidThisMonth, today, blockFromDay });

// ── never blocked ────────────────────────────────────────────────────
check("a member who paid this month is not overdue", () =>
  assert.strictEqual(overdue({ nextPaymentDate: "2026-09-10" }, true), false)
);

check("VIP members are skipped entirely", () =>
  assert.strictEqual(skipReason({ isVip: true, memberCode: "X" }), "VIP (fee-exempt)")
);

check("inactive members are skipped", () =>
  assert.strictEqual(
    skipReason({ activityStatus: "inactive", memberCode: "X" }),
    "inactive (owes nothing)"
  )
);

check("a member with no member code is skipped", () =>
  assert.strictEqual(skipReason({}), "no member code to match on the device")
);

check("an already-blocked member is skipped (no duplicate command)", () =>
  assert.strictEqual(
    skipReason({ memberCode: "X", accessBlocked: true }),
    "already blocked"
  )
);

check("staff/instructor accounts are skipped", () =>
  assert.strictEqual(
    skipReason({ role: "instructor", memberCode: "X" }),
    "not a member account"
  )
);

check("an ordinary paying member is eligible", () =>
  assert.strictEqual(skipReason({ memberCode: "PGNA117X", role: "member" }), null)
);

// ── the multi-month package trap ─────────────────────────────────────
check("a 3-month package member mid-term is NOT overdue", () =>
  // Paid in August for Aug–Oct: no September payment exists, but their next
  // due date is still in the future.
  assert.strictEqual(overdue({ nextPaymentDate: "2026-11-10" }), false)
);

check("...and IS overdue once that due date passes", () =>
  assert.strictEqual(overdue({ nextPaymentDate: "2026-09-10" }), true)
);

check("due exactly today is not yet overdue", () =>
  assert.strictEqual(overdue({ nextPaymentDate: "2026-09-15" }), false)
);

check("a Firestore Timestamp due date works like an ISO string", () =>
  assert.strictEqual(
    overdue({ nextPaymentDate: { toDate: () => new Date(2026, 8, 1) } }),
    true
  )
);

// ── fallback: no nextPaymentDate on record ───────────────────────────
check("no due date, unpaid, past the collection day → overdue", () =>
  assert.strictEqual(overdue({ joinDate: "2025-01-05" }), true)
);

check("no due date, joined this month AFTER the collection day → not overdue", () =>
  assert.strictEqual(overdue({ joinDate: "2026-09-14" }), false)
);

check("no due date, joined this month BEFORE the collection day → overdue", () =>
  assert.strictEqual(overdue({ joinDate: "2026-09-02" }), true)
);

check("no due date, same day-of-month but a previous month → overdue", () =>
  // Joined 14 Aug: the "joined late this month" exemption must not leak
  // into later months.
  assert.strictEqual(overdue({ joinDate: "2026-08-14" }), true)
);

// ── before the collection day, nobody is blocked ─────────────────────
const early = new Date(2026, 8, 5); // 5 Sep, before day 10
early.setHours(0, 0, 0, 0);
check("no due date and the collection day hasn't arrived → not overdue", () =>
  assert.strictEqual(
    isPaymentOverdue({
      member: { joinDate: "2025-01-05" },
      paidThisMonth: false,
      today: early,
      blockFromDay,
    }),
    false
  )
);

check("a grace period pushes the block day back", () =>
  assert.strictEqual(
    isPaymentOverdue({
      member: { joinDate: "2025-01-05" },
      paidThisMonth: false,
      today, // the 15th
      blockFromDay: 17, // collection day 10 + 7 days grace
    }),
    false
  )
);

check("monthKey pads single-digit months", () =>
  assert.strictEqual(monthKey(new Date(2026, 0, 5)), "2026-01")
);

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
