// The gym collects all payments on one dedicated day of the month
// (settings.payment.dueDay). Every member's due date falls on that day;
// what varies per member is WHICH month they are next due, based on how
// many months their package covers.

export const DEFAULT_DUE_DAY = 10;

/**
 * Next due date: the gym's collection day, `monthsToAdd` months after
 * `baseDate`. Clamped to the last day of shorter months.
 * Returns a YYYY-MM-DD string, or "" if baseDate is invalid.
 */
export function nextDueDateOnCollectionDay(baseDate, monthsToAdd, dueDay) {
  // Accept Dates, ISO strings, and Firestore Timestamps
  let base;
  if (baseDate instanceof Date) base = baseDate;
  else if (baseDate?.toDate) base = baseDate.toDate();
  else if (baseDate?.seconds) base = new Date(baseDate.seconds * 1000);
  else base = new Date(baseDate);
  if (!base || isNaN(base.getTime())) return "";
  const day = parseInt(dueDay) || DEFAULT_DUE_DAY;
  const months = parseInt(monthsToAdd) || 1;

  const target = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const lastDayOfMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDayOfMonth));

  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}
