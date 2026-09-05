/**
 * Pure rules for automatic door blocking of unpaid members.
 *
 * Kept free of Firestore so they can be tested directly: a wrong answer
 * here locks a paying customer out of the gym, which is far worse than
 * collecting a fee a few days late. Every rule errs towards NOT blocking.
 *
 * The gym collects on one day a month (settings.payment.dueDay). What
 * decides whether a member is overdue is which MONTHS their payments are
 * recorded FOR — payment.month — never when the money arrived. A member who
 * walks in on 20 September and settles August still owes September, so they
 * stay blocked until September is recorded too. Recording the two months in
 * either order gives the same answer.
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

/** A YYYY-MM key from a "YYYY-MM", "YYYY-MM-DD", Date or Timestamp. */
export function toMonthKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}/.test(value)) {
    return value.slice(0, 7);
  }
  const d = toDateOrNull(value);
  return d ? monthKey(d) : null;
}

/** Shift a YYYY-MM key by whole months. */
export function addMonths(key, count) {
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(year, month - 1 + count, 1);
  return monthKey(shifted);
}

/**
 * The month a payment is FOR. `month` is what every screen writes and what
 * the member is told they are settling; the dates are only a fallback for
 * older records that predate the field.
 */
export function paymentMonth(payment) {
  return (
    toMonthKey(payment?.month) ||
    toMonthKey(payment?.paymentDate) ||
    toMonthKey(payment?.paidAt) ||
    null
  );
}

/**
 * The last month a member's payments cover, or null when nothing is on
 * record. A payment covers its own month plus the rest of the package it
 * bought, so one payment on a 3-month package covers three months and the
 * member is not chased in months 2 and 3.
 */
export function coverageThroughMonth(payments, member) {
  const memberMonths = Math.max(1, parseInt(member?.packageDuration) || 1);
  let latest = null;

  for (const payment of payments || []) {
    const start = paymentMonth(payment);
    if (!start) continue;
    // A payment may carry the duration it bought; the member's current
    // package is the fallback for records that don't.
    const months = Math.max(
      1,
      parseInt(payment.packageDuration ?? payment.months) || memberMonths,
    );
    const end = addMonths(start, months - 1);
    if (!latest || end > latest) latest = end; // YYYY-MM sorts lexically
  }

  return latest;
}

/**
 * Members who are never auto-blocked, whatever their payment state.
 * Returns a reason string, or null when the member is eligible.
 *
 * `thisMonth` (YYYY-MM) is what an owner's or trainer's manual unblock is
 * measured against: a member let back in by hand is left alone for the rest
 * of that month, so the job can't undo the decision hours later.
 */
export function skipReason(member, thisMonth) {
  if (member.role && member.role !== "member") return "not a member account";
  if (member.isVip === true) return "VIP (fee-exempt)";
  if (member.activityStatus === "inactive") return "inactive (owes nothing)";
  if (!member.memberCode) return "no member code to match on the device";
  if (member.accessBlocked === true) return "already blocked";
  if (thisMonth && member.autoBlockExemptMonth === thisMonth) {
    return "unblocked by staff this month";
  }
  return null;
}

/**
 * Is this member overdue as of `today`?
 *
 * Two questions, in order:
 *   1. Has the collection day (plus the gym's grace period) arrived this
 *      month? Before that, nobody is overdue — the month isn't due yet.
 *   2. Do their payments cover this month? Paying off an older month does
 *      not answer for this one.
 *
 * `payments` is every payment record for the member, in any order.
 */
export function isPaymentOverdue({ member, payments, today, dueDay, graceDays = 0 }) {
  const grace = Math.max(0, parseInt(graceDays) || 0);
  const blockFromDay = (parseInt(dueDay) || DEFAULT_DUE_DAY) + grace;

  // Nothing is late until the gym has actually asked for it.
  if (today.getDate() < blockFromDay) return false;

  const thisMonth = monthKey(today);
  const covered = coverageThroughMonth(payments, member);
  if (covered) return covered < thisMonth; // YYYY-MM sorts lexically

  // Nothing on record at all. nextPaymentDate is the next-best signal —
  // a member migrated in with a future due date has not missed anything.
  const nextDue = toDateOrNull(member.nextPaymentDate);
  if (nextDue) {
    nextDue.setHours(0, 0, 0, 0);
    nextDue.setDate(nextDue.getDate() + grace);
    return nextDue < today;
  }

  // Not even a due date: a member who joined after this month's collection
  // day isn't late yet — their first payment is next month's.
  const joined = toDateOrNull(member.joinDate);
  if (joined && monthKey(joined) === thisMonth && joined.getDate() > blockFromDay) {
    return false;
  }
  return true;
}
