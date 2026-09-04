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

// The relay heartbeats every 30s; allow two misses before calling it offline.
export const RELAY_STALE_MS = 90000;
// How long a queued command may sit before the UI stops waiting on it.
export const COMMAND_TIMEOUT_MS = 60000;

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

/**
 * Subscribe to the gym relay agent's heartbeat.
 * callback receives { lastSeenAt, host }; lastSeenAt is null when no relay
 * has ever run for this gym. Liveness is derived by the caller (against
 * RELAY_STALE_MS) so it keeps re-evaluating as time passes, not only when
 * a new snapshot arrives.
 */
export const subscribeToRelayStatus = (gymId, callback) => {
  return onSnapshot(
    doc(db, "gyms", gymId, "relayStatus", "agent"),
    (snap) => {
      if (!snap.exists()) return callback({ lastSeenAt: null, host: null });
      const data = snap.data();
      callback({
        lastSeenAt: data.lastSeenAt?.toDate?.() || null,
        host: data.host || null,
      });
    },
    // A rules/permission error must not read as "relay online".
    () => callback({ lastSeenAt: null, host: null })
  );
};
