// Last-attendance helpers, shared by every screen that has to answer
// "when was this member last here?".
//
// The Members list, the member detail modal and the payment screens all read
// the SAME field through these helpers, so they can never disagree about a
// member's last visit or about why they count as inactive.
//
// `lastAttendanceDate` is stamped on the member document by
// markMemberAttendedNow (functions/index.js) on every check-in — face
// recognition, HikCentral webhook and HikCentral OpenAPI all go through it.
// Depending on the write path it lands as a Firestore Timestamp, a Date or an
// ISO string, so every read is coerced first.

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Firestore Timestamp | Date | ISO string | {seconds} → Date, or null. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }
  if (typeof value.seconds === "number") {
    const date = new Date(value.seconds * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export const getLastAttendanceDate = (member) =>
  toDate(member?.lastAttendanceDate);

/** Whole days between `date` and today, both floored to midnight. */
export function daysSince(date, now = new Date()) {
  const from = toDate(date);
  if (!from) return null;
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
}

/** "12 Mar 2026" — short and unambiguous in every locale we ship to. */
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Today" / "Yesterday" / "12 days ago" / "3 months ago". */
export function formatRelativeDays(days) {
  if (days === null || days === undefined) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

/**
 * Everything a screen needs to render "last attendance", in one call.
 *
 * A member who has NEVER checked in is deliberately not the same as "no data":
 * we fall back to their join date so the UI can still say how long they have
 * been absent, which is exactly the number an admin wants when deciding
 * whether to chase an inactive member.
 */
export function getAttendanceSummary(member) {
  const lastDate = getLastAttendanceDate(member);
  const joinDate = toDate(member?.joinDate);
  const reference = lastDate || joinDate;
  const days = daysSince(reference);

  return {
    lastDate,
    joinDate,
    neverAttended: !lastDate,
    // Days since the last visit, or since joining for a member who never came.
    daysSince: days,
    // Absolute date, e.g. "12 Mar 2026".
    dateLabel: lastDate ? formatDate(lastDate) : "",
    // Relative date, e.g. "3 months ago".
    relativeLabel: formatRelativeDays(days),
    // One line, ready to drop into a card.
    summaryLabel: lastDate
      ? `${formatDate(lastDate)} · ${formatRelativeDays(days)}`
      : joinDate
        ? `Never attended · joined ${formatDate(joinDate)}`
        : "No attendance on record",
  };
}

/**
 * Why a member counts as inactive — for tooltips and detail panels.
 * An admin-set status is reported first because it is the one a human can
 * undo directly; the attendance job's flag clears itself on the next check-in.
 */
export function getInactiveReason(member) {
  if (member?.status === "inactive") return "Set inactive by an admin";
  if (member?.activityStatus === "inactive")
    return "No attendance within the gym's inactivity threshold";
  return null;
}
