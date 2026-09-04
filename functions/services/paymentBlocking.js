/**
 * Pure rules for automatic door blocking of unpaid members.
 *
 * Kept free of Firestore so they can be tested directly: a wrong answer
 * here locks a paying customer out of the gym, which is far worse than
 * collecting a fee a few days late. Every rule errs towards NOT blocking.
 */

/** Fallback collection day when a gym has none configured. */
export const DEFAULT_DUE_DAY = 10;

/** YYYY-MM for a Date. */
export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Parse joinDate/nextPaymentDate values (ISO string or Firestore Timestamp). */
export function toDateOrNull(value) {
  if (!value) return null;
  const d = value.toDate ? value.toDate() : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Members who are never auto-blocked, whatever their payment state.
 * Returns a reason string, or null when the member is eligible.
 */
export function skipReason(member) {
  if (member.role && member.role !== "member") return "not a member account";
  if (member.isVip === true) return "VIP (fee-exempt)";
  if (member.activityStatus === "inactive") return "inactive (owes nothing)";
  if (!member.memberCode) return "no member code to match on the device";
  if (member.accessBlocked === true) return "already blocked";
  return null;
}

/**
 * Is this member overdue as of `today`?
 *
 * nextPaymentDate is the authoritative signal because it accounts for
 * multi-month packages — a member on a 3-month package legitimately has no
 * payment in months 2 and 3 and must not be blocked for it. The month-based
 * rule is only a fallback for members with no nextPaymentDate recorded.
 *
 * The gym's grace period applies to BOTH paths: whatever the settings screen
 * promises ("blocked from day dueDay + grace") has to hold for every unpaid
 * member, not only the ones missing a due date.
 */
export function isPaymentOverdue({ member, paidThisMonth, today, dueDay, graceDays = 0 }) {
  if (paidThisMonth) return false;

  const grace = Math.max(0, parseInt(graceDays) || 0);
  const blockFromDay = (parseInt(dueDay) || DEFAULT_DUE_DAY) + grace;

  const nextDue = toDateOrNull(member.nextPaymentDate);
  if (nextDue) {
    // Overdue only once the due date AND the grace period have passed.
    nextDue.setHours(0, 0, 0, 0);
    nextDue.setDate(nextDue.getDate() + grace);
    return nextDue < today;
  }

  // No due date on record: fall back to "no payment this month", but only
  // once the collection day (plus grace) has passed, and never for someone
  // who joined after it — their first payment isn't late yet.
  if (today.getDate() < blockFromDay) return false;
  const joined = toDateOrNull(member.joinDate);
  if (joined && monthKey(joined) === monthKey(today) && joined.getDate() > blockFromDay) {
    return false;
  }
  return true;
}
