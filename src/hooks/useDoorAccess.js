// Queue a door block/unblock and wait for the on-prem relay to confirm it.
//
// The Hikvision terminal is only reachable on the gym's LAN, so nothing here
// talks to it directly: the app writes a command document and the relay
// agent reports back on it. Shared by every place staff can change door
// access — the full panel on a member's profile and the compact button on
// the member and payment lists — so all of them behave identically.

import { useState, useRef, useEffect } from "react";
import { useNotification } from "../contexts/NotificationContext";
import {
  createDeviceCommand,
  subscribeToDeviceCommand,
  cancelDeviceCommand,
  markManualAccessOverride,
  COMMAND_TIMEOUT_MS,
} from "../services/deviceAccessService";

export function useDoorAccess({ member, gymId, user, onMemberUpdated }) {
  const { showSuccess, showError } = useNotification();
  const [pending, setPending] = useState(null); // { commandId, type }
  const unsubRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
      clearTimeout(timerRef.current);
    };
  }, []);

  const submit = async (type, reason = null) => {
    const trimmed = reason?.trim() || null;
    try {
      const commandId = await createDeviceCommand({
        gymId,
        member,
        type,
        reason: type === "block" ? trimmed : null,
        user,
      });
      setPending({ commandId, type });

      let unsub = null;
      let settled = false;
      const stopWatching = () => {
        settled = true;
        unsub?.();
        unsubRef.current = null;
        clearTimeout(timerRef.current);
      };

      // Nothing resolves a command the relay never picks up, so stop waiting
      // rather than spinning forever on "Waiting for gym relay…".
      timerRef.current = setTimeout(() => {
        if (settled) return;
        stopWatching();
        setPending(null);
        showError(
          `Device ${type} not confirmed: the gym's relay agent did not respond. ` +
            "Check that it is running on the gym PC — the command stays queued " +
            "and runs as soon as it is back."
        );
      }, COMMAND_TIMEOUT_MS);

      unsub = subscribeToDeviceCommand(gymId, commandId, (cmd) => {
        if (!cmd) return;
        if (cmd.status === "completed") {
          stopWatching();
          setPending(null);
          // A hand-made decision outranks the nightly unpaid-member job:
          // without this, someone let back in while still unpaid would be
          // blocked again at 02:00.
          markManualAccessOverride(member.id, type).catch((err) =>
            console.warn("Could not record the manual access override:", err)
          );
          showSuccess(
            type === "block"
              ? `${member.name}'s door access has been blocked`
              : `${member.name}'s door access has been restored`
          );
          onMemberUpdated?.({
            accessBlocked: type === "block",
            accessBlockedReason: type === "block" ? trimmed : null,
          });
        } else if (cmd.status === "failed") {
          stopWatching();
          setPending(null);
          showError(
            `Device ${type} failed: ${cmd.errorMessage || "unknown error"}`
          );
        }
      });

      // If the callback already fired, unsub was still null inside it.
      if (settled) unsub();
      else unsubRef.current = unsub;
    } catch (err) {
      showError(`Could not queue ${type} command: ${err.message}`);
    }
  };

  const cancel = async () => {
    if (!pending) return;
    try {
      await cancelDeviceCommand(gymId, pending.commandId);
      unsubRef.current?.();
      setPending(null);
    } catch (err) {
      showError(`Could not cancel: ${err.message}`);
    }
  };

  return { blocked: member?.accessBlocked === true, pending, submit, cancel };
}

export default useDoorAccess;
