import { useState } from "react";

// Confirmation for blocking a member at the door. Blocking is the
// destructive direction — a member turned away at the terminal has no
// recourse until staff act — so it always asks; unblocking never does.
const BlockAccessDialog = ({ memberName, onCancel, onConfirm }) => {
  const [reason, setReason] = useState("Non-payment");

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-sm p-6">
        <h3 className="text-white font-semibold text-lg mb-2">
          Block door access?
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          {memberName} will no longer be able to open the door at the terminal.
          Their face enrollment is kept, so unblocking is instant — no
          re-enrollment needed.
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
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="flex-1 px-4 py-2 bg-[#FF6B6B] hover:bg-[#e85555] text-white rounded-lg font-medium transition text-sm"
          >
            Block Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockAccessDialog;
