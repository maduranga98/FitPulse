import { useState } from "react";
import { useDoorAccess } from "../hooks/useDoorAccess";
import BlockAccessDialog from "./BlockAccessDialog";

// Compact door block/unblock control for list rows and cards, where the full
// AccessControlCard panel would not fit. Same relay command underneath, so
// staff can lock a member out from the list they are already looking at
// instead of opening the profile first.
const DoorAccessButton = ({ member, gymId, user, onMemberUpdated, className = "" }) => {
  const [confirming, setConfirming] = useState(false);
  const { blocked, pending, submit } = useDoorAccess({
    member,
    gymId,
    user,
    onMemberUpdated,
  });

  const base =
    "w-full py-2 rounded-lg font-medium text-sm transition active:scale-95 flex items-center justify-center gap-2";

  if (pending) {
    return (
      <button disabled className={`${base} bg-gray-700 text-gray-400 ${className}`}>
        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
        Waiting for gym relay…
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => (blocked ? submit("unblock") : setConfirming(true))}
        title={
          blocked
            ? "Restore this member's door access at the terminal"
            : "Stop this member opening the door at the terminal"
        }
        className={`${base} ${
          blocked
            ? "bg-[#0066FF] hover:bg-blue-700 text-white"
            : "bg-gray-700 hover:bg-[#FF6B6B] text-gray-200 hover:text-white"
        } ${className}`}
      >
        {blocked ? "Unblock Door" : "Block Door"}
      </button>

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
    </>
  );
};

export default DoorAccessButton;
