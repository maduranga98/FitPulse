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

/** The fee actually expected from a member this cycle (0 for VIPs). */
export const memberFee = (member) =>
  isFeeExempt(member) ? 0 : toAmount(member?.membershipFee);

/** Payments recorded FOR a given month (YYYY-MM), by the payment's month field. */
export const paymentsForMonth = (payments, month) =>
  (payments || []).filter((p) => p.month === month);
