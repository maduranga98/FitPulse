// Shared money helpers for every screen that totals payments.
//
// Two rules every payment total has to follow:
//
// 1. Coerce before adding. Amounts come back from Firestore and older or
//    hand-edited records can hold the amount as a string, or not at all.
//    "1500" + "2000" concatenates to "15002000" instead of summing to 3500,
//    so every value goes through toAmount() first.
// 2. Never estimate. A collected/outstanding figure is the sum of the actual
//    records — never a count multiplied by an average, which produces totals
//    that don't match any real package price.

export function toAmount(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/**
 * Sum of `amount` (or any picked field) across records, rounded to cents so
 * repeated float addition can't leak artefacts like 4664.999999999999.
 */
export function sumAmounts(items, pick = (item) => item?.amount) {
  const total = (items || []).reduce((sum, item) => sum + toAmount(pick(item)), 0);
  return Math.round(total * 100) / 100;
}

/** Digits only — callers add their own "Rs." prefix. */
export function formatAmount(value) {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

// VIP members are fee-exempt: no package fee is ever collected from them, so
// they must never be counted as unpaid, nor added to an outstanding balance.
export const isFeeExempt = (member) => member?.isVip === true;

// There is exactly ONE notion of "inactive" in the app. A member is inactive
// either because an admin set them that way (`status`), or because the
// scheduled job flipped them for not attending within the gym's threshold
// (`activityStatus`) — both mean the same thing to every screen, so no screen
// shows "inactive" and "attendance inactive" as two separate buckets.
//
// `activityStatus` is maintained automatically: the job sets "inactive" once
// too much time has passed since the last attendance, and a check-in sets it
// back to "active". Missing/undefined activityStatus means "never evaluated
// yet" and is treated as active so existing members aren't retroactively
// hidden.
export const isInactiveMember = (member) =>
  member?.activityStatus === "inactive" || member?.status === "inactive";

// Inactive members are excluded from "unpaid" the same way VIPs are: while
// inactive they owe nothing, so they must never show up in an outstanding
// balance or an "unpaid" list. Payments/attendance screens should show
// "active unpaid" only, never "active + inactive unpaid" combined.
export const isPayingMember = (member) => !isFeeExempt(member) && !isInactiveMember(member);

// A blocked member is one the gym has shut out, by either of the two
// independent switches the app owns:
//   - `status: "blocked"`  → staff revoked their app login (Members screen)
//   - `accessBlocked`      → the relay confirmed the door terminal rejects them
//   - `autoBlocked`        → the nightly unpaid sweep queued a door block that
//                            the relay has not confirmed yet
// `autoBlocked` is cleared again on any unblock (payment, or a manual
// override), so it never lingers on a member who is back in.
//
// Blocked is NOT the same as inactive or unpaid: an unpaid member still walks
// in and still counts. Only a blocked member's check-ins are set aside, since
// a scan from someone who should not be getting through the door is a device
// or sync problem to look at, not gym traffic to report on.
export const isBlockedMember = (member) =>
  member?.status === "blocked" ||
  member?.accessBlocked === true ||
  member?.autoBlocked === true;

/** The fee actually expected from a member this cycle (0 for VIPs). */
export const memberFee = (member) =>
  isFeeExempt(member) ? 0 : toAmount(member?.membershipFee);

/** Payments recorded FOR a given month (YYYY-MM), by the payment's month field. */
export const paymentsForMonth = (payments, month) =>
  (payments || []).filter((p) => p.month === month);

// ---------------------------------------------------------------------------
// Which month a payment counts as REVENUE in.
//
// Two different months hang off one payment record and they are not the same
// thing:
//
//   payment.month        the month the payment is FOR — the membership cycle
//                        it settles. This decides whether a member is "paid"
//                        for March, and nothing else.
//   payment.collectedOn  the day the money actually changed hands.
//
// A member who walks in during March and settles February AND March hands
// over both amounts in March, so BOTH belong in March's revenue — the gym
// counted that cash in March. Totalling by `month` instead scattered the
// takings backwards into months whose books were already closed, which is
// what made a month's collected figure disagree with the cash on hand.
//
// So: membership status is answered by `month`, money is answered by
// `collectedOn`. Older records have no collectedOn, so fall back through the
// server-set paidAt, then createdAt, and only as a last resort to the cycle
// month — which is what those legacy records always meant anyway.

const monthOf = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    // "YYYY-MM-DD" or "YYYY-MM"
    return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : "";
  }
  let date = null;
  if (value instanceof Date) date = value;
  else if (typeof value.toDate === "function") {
    try {
      date = value.toDate();
    } catch {
      date = null;
    }
  } else if (typeof value.seconds === "number") date = new Date(value.seconds * 1000);
  if (!date || isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

/** The YYYY-MM the money was actually collected in. */
export const paymentCollectedMonth = (payment) =>
  monthOf(payment?.collectedOn) ||
  monthOf(payment?.paidAt) ||
  monthOf(payment?.createdAt) ||
  payment?.month ||
  "";

/** The YYYY-MM-DD the money was collected on, for display. */
export const paymentCollectedDate = (payment) => {
  if (typeof payment?.collectedOn === "string" && payment.collectedOn) {
    return payment.collectedOn;
  }
  const raw = payment?.paidAt || payment?.createdAt;
  if (!raw) return "";
  let date = null;
  if (raw instanceof Date) date = raw;
  else if (typeof raw.toDate === "function") {
    try {
      date = raw.toDate();
    } catch {
      date = null;
    }
  } else if (typeof raw.seconds === "number") date = new Date(raw.seconds * 1000);
  else date = new Date(raw);
  if (!date || isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/** Payments whose money was COLLECTED during a given month (YYYY-MM). */
export const paymentsCollectedInMonth = (payments, month) =>
  (payments || []).filter((p) => paymentCollectedMonth(p) === month);

/**
 * A payment collected in one month for a different month — the case that made
 * the totals confusing in the first place. Screens use it to label the record
 * ("for February, collected in March") instead of hiding the difference.
 */
export const isAdvanceOrArrearsPayment = (payment) =>
  !!payment?.month && paymentCollectedMonth(payment) !== payment.month;
