// Keeping blocked members out of the attendance figures.
//
// A blocked member should never get through the door at all, so a check-in
// from one is an exception — the terminal was out of sync, or the block landed
// after they had already scanned in. Counting those scans as gym traffic
// inflates every attendance number and hides the sync problem, so every
// attendance screen splits them out into their own bucket instead.

import { isBlockedMember } from "./paymentTotals.js";

/**
 * The keys that identify a blocked member on an attendance record.
 *
 * Records carry a memberId when the device event was matched to a member, and
 * only the device's employeeNo (the member code) when it was not, so both are
 * collected. Codes are normalised to trimmed strings because the device sends
 * them as strings while some member docs hold them as numbers.
 */
export const blockedMemberKeys = (members) => {
  const keys = new Set();
  (members || []).filter(isBlockedMember).forEach((member) => {
    if (member.id) keys.add(String(member.id));
    if (member.memberCode !== undefined && member.memberCode !== null) {
      const code = String(member.memberCode).trim();
      if (code) keys.add(code);
    }
  });
  return keys;
};

/** Does this attendance record belong to a blocked member? */
export const isBlockedRecord = (record, blockedKeys) => {
  if (!blockedKeys || blockedKeys.size === 0) return false;
  const candidates = [
    record?.memberId,
    record?.memberCode,
    record?.employeeNo,
    record?.rawEvent?.employeeNo,
  ];
  return candidates.some((value) => {
    if (value === undefined || value === null) return false;
    const key = String(value).trim();
    return key !== "" && blockedKeys.has(key);
  });
};

/**
 * Split records into the ones that count (`visible`) and the ones from blocked
 * members (`blocked`). Order within each bucket is preserved.
 */
export const splitBlockedAttendance = (records, blockedKeys) => {
  const visible = [];
  const blocked = [];
  (records || []).forEach((record) => {
    (isBlockedRecord(record, blockedKeys) ? blocked : visible).push(record);
  });
  return { visible, blocked };
};
