import { useState } from "react";
import { useDoorAccess } from "../hooks/useDoorAccess";
import BlockAccessDialog from "./BlockAccessDialog";

// Full door access panel for the member detail modal — available to owners,
// managers and trainers alike, since whoever is at the desk is who has to
// lock a member out or let them back in. Blocking is executed by the on-prem
// relay agent, so the UI queues a command and waits for the relay to confirm
// before flipping state.
const AccessControlCard = ({ member, gymId, user, onMemberUpdated }) => {
  const [confirming, setConfirming] = useState(false);
  const { blocked, pending, submit, cancel } = useDoorAccess({
    member,
    gymId,
    user,
    onMemberUpdated,
  });

  return (
    <div
      className={`mb-6 rounded-lg border px-4 py-3 ${
        blocked
          ? "bg-[#FF6B6B]/10 border-[#FF6B6B]/30"
          : "bg-gray-900 border-gray-700"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              onClick={cancel}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              Cancel
            </button>
          </div>
        ) : blocked ? (
          <button
            onClick={() => submit("unblock")}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-[#0066FF] hover:bg-blue-700 text-white transition"
          >
            Unblock Access
          </button>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-[#FF6B6B] hover:bg-[#e85555] text-white transition"
          >
            Block Access
          </button>
        )}
      </div>

      {confirming && (
        <BlockAccessDialog
          memberName={member.name}
          onCancel={() => setConfirming(false)}
          onConfirm={(reason) => {
            setConfirming(false);
            submit("block", reason);
          }}
        />
      )}
    </div>
  );
};

export default AccessControlCard;
