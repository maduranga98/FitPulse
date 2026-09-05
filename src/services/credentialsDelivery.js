// Resending login credentials by SMS, and reading back what was delivered.
//
// Credentials are normally sent once, automatically: for members by the
// `onMemberCreated` Cloud Function, for trainers by the client right after the
// account is created. Either send can fail for reasons nobody sees at the time
// — a mistyped or non-Sri-Lankan phone number, no SMS token configured for the
// gym, a text.lk outage — and the member simply never receives their login.
//
// This module is the one place that (a) resends those credentials on demand and
// (b) writes every attempt to `notifications`, so the screens can show whether
// the credentials ever actually went out instead of leaving an admin guessing.

import { db } from "../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import {
  sendMemberRegistrationSMS,
  sendInstructorCredentialsSMS,
  validatePhoneNumber,
} from "./smsService";

// Matches the type/channel the onMemberCreated Cloud Function already writes,
// so the automatic first send and every resend land in the same history.
export const CREDENTIALS_TYPE = "member_registration";
export const SMS_CHANNEL = "sms";

/** Members store mobile/whatsapp; trainers store phone. Try all three. */
export const getCredentialsPhone = (person) =>
  person?.mobile || person?.whatsapp || person?.phone || "";

/**
 * Can credentials be sent to this person at all?
 *
 * Checked BEFORE any send so the UI can disable the button and say why, rather
 * than firing a request that is guaranteed to fail. The three reasons here are
 * exactly the ones that silently swallowed the original send.
 */
export function checkCredentialsSendable(person) {
  const phone = getCredentialsPhone(person);
  if (!phone) {
    return { ok: false, reason: "No mobile or WhatsApp number on record." };
  }
  if (!validatePhoneNumber(phone)) {
    return {
      ok: false,
      reason: `"${phone}" is not a valid Sri Lankan mobile number, so no SMS can reach it.`,
    };
  }
  if (!person?.username || !person?.password) {
    return {
      ok: false,
      reason:
        "No login credentials are stored for this account, so there is nothing to send.",
    };
  }
  return { ok: true, phone };
}

/**
 * Record one delivery attempt. Never throws: a failure to write the audit trail
 * must not turn a successful SMS into a reported failure.
 */
async function logDelivery({
  gymId,
  memberId,
  memberName,
  status,
  error,
  attempt,
  sentBy,
}) {
  try {
    await addDoc(collection(db, "notifications"), {
      gymId: gymId || null,
      memberId: memberId || null,
      memberName: memberName || null,
      type: CREDENTIALS_TYPE,
      channel: SMS_CHANNEL,
      status,
      // "resend" distinguishes these from the automatic first send, so the
      // history reads as a sequence of attempts rather than duplicates.
      attempt: attempt || "resend",
      ...(error ? { error: String(error).slice(0, 500) } : {}),
      ...(sentBy ? { sentBy } : {}),
      sentAt: Timestamp.now(),
    });
  } catch (err) {
    console.error("Could not log credentials delivery:", err);
  }
}

/**
 * Resend a member's login credentials by SMS.
 *
 * Resolves to { success, error } rather than throwing, because every caller is
 * a button that needs to render the outcome either way. The attempt is logged
 * whether it succeeded or failed.
 */
export async function resendMemberCredentials(member, gymId, sentBy) {
  const check = checkCredentialsSendable(member);
  if (!check.ok) return { success: false, error: check.reason };

  try {
    await sendMemberRegistrationSMS(
      member,
      member.username,
      member.password,
      gymId
    );
    await logDelivery({
      gymId,
      memberId: member.id,
      memberName: member.name,
      status: "sent",
      sentBy,
    });
    return { success: true, phone: check.phone };
  } catch (err) {
    const error = err?.message || "SMS could not be sent.";
    await logDelivery({
      gymId,
      memberId: member.id,
      memberName: member.name,
      status: "failed",
      error,
      sentBy,
    });
    return { success: false, error };
  }
}

/** Resend a trainer's login credentials by SMS. Same contract as above. */
export async function resendInstructorCredentials(instructor, gymId, sentBy) {
  const check = checkCredentialsSendable(instructor);
  if (!check.ok) return { success: false, error: check.reason };

  try {
    await sendInstructorCredentialsSMS(
      { name: instructor.name, phone: check.phone },
      instructor.username,
      instructor.password,
      gymId
    );
    await logDelivery({
      gymId,
      memberId: instructor.membersDocId || instructor.id,
      memberName: instructor.name,
      status: "sent",
      sentBy,
    });
    return { success: true, phone: check.phone };
  } catch (err) {
    const error = err?.message || "SMS could not be sent.";
    await logDelivery({
      gymId,
      memberId: instructor.membersDocId || instructor.id,
      memberName: instructor.name,
      status: "failed",
      error,
      sentBy,
    });
    return { success: false, error };
  }
}

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const date = new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
};

/**
 * The credentials-SMS history for ONE person, newest first.
 *
 * Deliberately per-person and fetched on demand: the notifications collection
 * grows without bound, and this is only ever needed while looking at a single
 * profile. Equality-only filters, sorted client-side, so no composite index is
 * required.
 *
 * Returns [] on error — a history that cannot be read must not block the
 * resend button, which is the thing the admin actually came for.
 */
export async function fetchCredentialsHistory(gymId, memberId) {
  if (!gymId || !memberId) return [];
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "notifications"),
        where("gymId", "==", gymId),
        where("memberId", "==", memberId)
      )
    );
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (record) =>
          record.type === CREDENTIALS_TYPE && record.channel === SMS_CHANNEL
      )
      .sort((a, b) => toMillis(b.sentAt) - toMillis(a.sentAt));
  } catch (err) {
    console.error("Could not load credentials delivery history:", err);
    return [];
  }
}
