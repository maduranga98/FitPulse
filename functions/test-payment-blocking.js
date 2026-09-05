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
  paymentMonth,
  coverageThroughMonth,
  addMonths,
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
const dueDay = 10;
const today = new Date(2026, 8, 15); // 15 Sep 2026
today.setHours(0, 0, 0, 0);

// A payment record as the app writes it: `month` is the month it settles.
const paid = (month) => ({ month, paymentDate: `${month}-03`, amount: 5000 });

const overdue = (member, payments = [], graceDays = 0) =>
  isPaymentOverdue({ member, payments, today, dueDay, graceDays });

// ── who is never touched ─────────────────────────────────────────────
check("VIP members are skipped entirely", () =>
  assert.strictEqual(skipReason({ isVip: true, memberCode: "X" }), "VIP (fee-exempt)")
);

check("inactive members are skipped", () =>
  assert.strictEqual(
    skipReason({ activityStatus: "inactive", memberCode: "X" }),
    "inactive (owes nothing)"
  )
);

check("members set inactive by an admin are skipped too", () =>
  assert.strictEqual(
    skipReason({ status: "inactive", memberCode: "X" }),
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

check("a member staff unblocked by hand this month is left alone", () =>
  assert.strictEqual(
    skipReason({ memberCode: "X", autoBlockExemptMonth: "2026-09" }, "2026-09"),
    "unblocked by staff this month"
  )
);

check("...and is back in scope next month", () =>
  assert.strictEqual(
    skipReason({ memberCode: "X", autoBlockExemptMonth: "2026-09" }, "2026-10"),
    null
  )
);

// ── this month paid / not paid ───────────────────────────────────────
check("paid for this month → not overdue", () =>
  assert.strictEqual(overdue({}, [paid("2026-09")]), false)
);

check("nothing paid at all, past the collection day → overdue", () =>
  assert.strictEqual(overdue({ joinDate: "2025-01-05" }), true)
);

check("paid every month up to last month → overdue this month", () =>
  assert.strictEqual(overdue({}, [paid("2026-07"), paid("2026-08")]), true)
);

// ── settling an older month while this month is still due ────────────
// The case that matters at the desk: money arrives in September, but the
// record settles August. September is still owed.
check("paying LAST month's dues this month does not cover this month", () =>
  assert.strictEqual(overdue({}, [paid("2026-08")]), true)
);

check("...and once this month is recorded too, they are clear", () =>
  assert.strictEqual(overdue({}, [paid("2026-08"), paid("2026-09")]), false)
);

check("the order the two months are recorded in makes no difference", () =>
  assert.strictEqual(overdue({}, [paid("2026-09"), paid("2026-08")]), false)
);

check("a payment DATED this month for an older month still leaves this month due", () =>
  // Recorded on 20 Sep, settling August.
  assert.strictEqual(
    overdue({}, [{ month: "2026-08", paymentDate: "2026-09-20" }]),
    true
  )
);

// ── multi-month packages ─────────────────────────────────────────────
check("a 3-month package paid in July covers September", () =>
  assert.strictEqual(
    overdue({ packageDuration: 3 }, [paid("2026-07")]),
    false
  )
);

check("...and runs out in October", () =>
  assert.strictEqual(
    isPaymentOverdue({
      member: { packageDuration: 3 },
      payments: [paid("2026-07")],
      today: new Date(2026, 9, 15), // 15 Oct
      dueDay,
    }),
    true
  )
);

check("a duration on the payment record wins over the member's current package", () =>
  // Member has since moved to a 1-month package; the 6 months they bought
  // in May must still be honoured.
  assert.strictEqual(
    overdue({ packageDuration: 1 }, [{ month: "2026-05", packageDuration: 6 }]),
    false
  )
);

check("prepaying a future month covers this month too", () =>
  assert.strictEqual(overdue({}, [paid("2026-12")]), false)
);

// ── before the collection day, nobody is blocked ─────────────────────
const early = new Date(2026, 8, 5); // 5 Sep, before day 10
early.setHours(0, 0, 0, 0);

check("this month unpaid but the collection day hasn't arrived → not overdue", () =>
  assert.strictEqual(
    isPaymentOverdue({
      member: {},
      payments: [paid("2026-08")],
      today: early,
      dueDay,
    }),
    false
  )
);

check("a grace period pushes the block day back", () =>
  assert.strictEqual(overdue({}, [paid("2026-08")], 7), false) // blocked from day 17
);

check("...and blocks once the grace period has passed", () =>
  assert.strictEqual(overdue({}, [paid("2026-08")], 4), true) // blocked from day 14
);

// ── members with no payment history ──────────────────────────────────
check("no payments, but a future due date on record → not overdue", () =>
  assert.strictEqual(overdue({ nextPaymentDate: "2026-11-10" }), false)
);

check("no payments and a due date that has passed → overdue", () =>
  assert.strictEqual(overdue({ nextPaymentDate: "2026-09-10" }), true)
);

check("no payments, joined this month AFTER the collection day → not overdue", () =>
  assert.strictEqual(overdue({ joinDate: "2026-09-14" }), false)
);

check("no payments, joined this month BEFORE the collection day → overdue", () =>
  assert.strictEqual(overdue({ joinDate: "2026-09-02" }), true)
);

check("no payments, same day-of-month but a previous month → overdue", () =>
  // The "joined late this month" exemption must not leak into later months.
  assert.strictEqual(overdue({ joinDate: "2026-08-14" }), true)
);

// ── older records without a month field ──────────────────────────────
check("a payment with no month falls back to its payment date", () =>
  assert.strictEqual(paymentMonth({ paymentDate: "2026-09-03" }), "2026-09")
);

check("...and to paidAt when there is no payment date either", () =>
  assert.strictEqual(
    paymentMonth({ paidAt: { toDate: () => new Date(2026, 8, 3) } }),
    "2026-09"
  )
);

check("a month-less payment record still clears the month it landed in", () =>
  assert.strictEqual(overdue({}, [{ paymentDate: "2026-09-03" }]), false)
);

// ── helpers ──────────────────────────────────────────────────────────
check("coverageThroughMonth takes the furthest month covered", () =>
  assert.strictEqual(
    coverageThroughMonth([paid("2026-08"), paid("2026-05")], { packageDuration: 2 }),
    "2026-09"
  )
);

check("coverageThroughMonth is null with nothing on record", () =>
  assert.strictEqual(coverageThroughMonth([], {}), null)
);

check("addMonths rolls over the year", () =>
  assert.strictEqual(addMonths("2026-11", 3), "2027-02")
);

check("monthKey pads single-digit months", () =>
  assert.strictEqual(monthKey(new Date(2026, 0, 5)), "2026-01")
);

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
