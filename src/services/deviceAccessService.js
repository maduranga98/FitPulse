// Client-side helpers for the device access block/unblock command queue.
//
// The Hikvision terminal is only reachable on the gym's LAN, so the app
// never calls it directly. Instead it queues a command document under
// gyms/{gymId}/deviceCommands and the on-prem relay agent (relay-agent/)
// executes the ISAPI call and reports back on the same document.

import { db } from "../config/firebase";
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Queue a block or unblock command for the gym's relay agent.
 * @param {"block"|"unblock"} type
 * @returns {Promise<string>} the command document id
 */
export const createDeviceCommand = async ({ gymId, member, type, reason, user }) => {
  if (!member.memberCode) {
    throw new Error(
      "This member has no member code, so they can't be matched to a device user."
    );
  }
  const ref = await addDoc(collection(db, "gyms", gymId, "deviceCommands"), {
    type,
    employeeNo: member.memberCode,
    memberId: member.id,
    memberName: member.name || "",
    gymId,
    reason: reason || null,
    status: "pending",
    errorMessage: null,
    createdAt: serverTimestamp(),
    completedAt: null,
    createdBy: user?.id || null,
    createdByName: user?.name || user?.username || null,
  });
  return ref.id;
};

/**
 * Subscribe to a command's live status. Returns the unsubscribe function.
 * callback receives { status, errorMessage } (or null if deleted).
 */
export const subscribeToDeviceCommand = (gymId, commandId, callback) => {
  return onSnapshot(
    doc(db, "gyms", gymId, "deviceCommands", commandId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (err) => callback({ status: "failed", errorMessage: err.message })
  );
};

/** Cancel a command that hasn't been picked up by the relay yet. */
export const cancelDeviceCommand = async (gymId, commandId) => {
  await deleteDoc(doc(db, "gyms", gymId, "deviceCommands", commandId));
};
