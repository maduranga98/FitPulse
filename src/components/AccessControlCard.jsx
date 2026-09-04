import { useState, useEffect, useRef } from "react";
import { useNotification } from "../contexts/NotificationContext";
import {
  createDeviceCommand,
  subscribeToDeviceCommand,
  cancelDeviceCommand,
  COMMAND_TIMEOUT_MS,
} from "../services/deviceAccessService";

// Door access control card shown on the member detail modal (Owner/Manager
// only). Blocking is executed by the on-prem relay agent, so the UI queues
// a command and waits for the relay to confirm before flipping state.
const AccessControlCard = ({ member, gymId, user, onMemberUpdated }) => {
  const { showSuccess, showError } = useNotification();
  const [confirmType, setConfirmType] = useState(null); // "block" | "unblock" | null
  const [reason, setReason] = useState("Non-payment");
  const [pending, setPending] = useState(null); // { commandId, type }
  const unsubRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
      clearTimeout(timerRef.current);
    };
  }, []);

  const blocked = member.accessBlocked === true;

  const startCommand = async (type) => {
    setConfirmType(null);
    try {
      const commandId = await createDeviceCommand({
        gymId,
        member,
        type,
        reason: type === "block" ? reason.trim() || null : null,
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
          showSuccess(
            type === "block"
              ? `${member.name}'s door access has been blocked`
              : `${member.name}'s door access has been restored`
          );
          onMemberUpdated?.({
            accessBlocked: type === "block",
            accessBlockedReason: type === "block" ? reason.trim() || null : null,
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

  const cancelPending = async () => {
    if (!pending) return;
    try {
      await cancelDeviceCommand(gymId, pending.commandId);
      unsubRef.current?.();
      setPending(null);
    } catch (err) {
      showError(`Could not cancel: ${err.message}`);
    }
  };

  return (
    <div
      className={`mb-6 rounded-lg border px-4 py-3 ${
        blocked
          ? "bg-[#FF6B6B]/10 border-[#FF6B6B]/30"
          : "bg-gray-900 border-gray-700"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-white flex items-center gap-2">
            Door Access
            {blocked ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FF6B6B]/20 text-[#FF6B6B]">
                BLOCKED
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">
                ACTIVE
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {blocked
              ? `Blocked${member.accessBlockedReason ? ` — ${member.accessBlockedReason}` : ""}${
                  member.accessBlockedBy ? ` (by ${member.accessBlockedBy})` : ""
                }. Enrollment is kept; unblocking restores access instantly.`
              : "Blocks the door at the terminal without deleting face enrollment."}
          </div>
        </div>

        {pending ? (
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="flex items-center gap-2 text-xs text-blue-400">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
              Waiting for gym relay…
            </span>
            <button
              onClick={cancelPending}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              Cancel
            </button>
          </div>
        ) : blocked ? (
          <button
            onClick={() => startCommand("unblock")}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-[#0066FF] hover:bg-blue-700 text-white transition"
          >
            Unblock Access
          </button>
        ) : (
          <button
            onClick={() => setConfirmType("block")}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-[#FF6B6B] hover:bg-[#e85555] text-white transition"
          >
            Block Access
          </button>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmType === "block" && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-sm p-6">
            <h3 className="text-white font-semibold text-lg mb-2">
              Block door access?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {member.name} will no longer be able to open the door at the
              terminal. Their face enrollment is kept, so unblocking is
              instant — no re-enrollment needed.
            </p>
            <label className="block text-sm text-gray-400 mb-1.5">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Non-payment"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmType(null)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => startCommand("block")}
                className="flex-1 px-4 py-2 bg-[#FF6B6B] hover:bg-[#e85555] text-white rounded-lg font-medium transition text-sm"
              >
                Block Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessControlCard;
