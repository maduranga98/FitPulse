import { useState, useEffect, useCallback } from "react";
import {
  checkCredentialsSendable,
  getCredentialsPhone,
  fetchCredentialsHistory,
  resendMemberCredentials,
  resendInstructorCredentials,
} from "../services/credentialsDelivery";

/**
 * "Credentials SMS" panel — whether the login SMS ever reached this person,
 * and a button to send it again.
 *
 * Shared by the member detail modal and the trainer list so both answer the
 * same question the same way. The history is loaded once when the panel opens
 * (a per-person query, not the whole notifications collection) and refreshed
 * after each send.
 *
 * `kind` selects which message template is used: "member" or "instructor".
 *
 * `withHistory` is off in list views on purpose: mounting the panel on every
 * card would fire one Firestore query per row just to render a button nobody
 * has clicked yet. Lists get the button; detail views get the full history.
 */
const CredentialsSmsPanel = ({
  person,
  gymId,
  kind = "member",
  sentBy,
  compact = false,
  withHistory = true,
}) => {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(withHistory);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Trainers live in `users` but their SMS history is logged against their
  // mirrored member document, so the lookup has to follow the same id.
  const historyId =
    kind === "instructor" ? person?.membersDocId || person?.id : person?.id;

  const loadHistory = useCallback(async () => {
    if (!withHistory || !gymId || !historyId) {
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    setHistory(await fetchCredentialsHistory(gymId, historyId));
    setLoadingHistory(false);
  }, [withHistory, gymId, historyId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sendable = checkCredentialsSendable(person);
  const phone = getCredentialsPhone(person);

  const handleResend = async () => {
    setSending(true);
    setResult(null);
    const outcome =
      kind === "instructor"
        ? await resendInstructorCredentials(person, gymId, sentBy)
        : await resendMemberCredentials(person, gymId, sentBy);
    setResult(outcome);
    setSending(false);
    loadHistory();
  };

  const lastSent = history.find((record) => record.status === "sent");
  const lastAttempt = history[0];

  const formatWhen = (value) => {
    const date = value?.toDate
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : value
          ? new Date(value)
          : null;
    if (!date || isNaN(date.getTime())) return "unknown time";
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // One line summarising delivery, and the tone to render it in. "No record"
  // is its own case: the automatic send predates this log, or never ran, so it
  // must not be reported as either a success or a failure.
  const status = loadingHistory
    ? { tone: "muted", text: "Checking delivery..." }
    : lastSent
      ? {
          tone: "good",
          text: `Last sent ${formatWhen(lastSent.sentAt)}${
            history.length > 1 ? ` · ${history.length} attempts` : ""
          }`,
        }
      : lastAttempt
        ? {
            tone: "bad",
            text: `Last attempt failed ${formatWhen(lastAttempt.sentAt)}${
              lastAttempt.error ? ` — ${lastAttempt.error}` : ""
            }`,
          }
        : {
            tone: "warn",
            text: "No delivery on record — the credentials SMS may never have arrived.",
          };

  const toneClass = {
    good: "text-green-400",
    bad: "text-red-400",
    warn: "text-amber-400",
    muted: "text-gray-500",
  }[status.tone];

  const dotClass = {
    good: "bg-green-500",
    bad: "bg-red-500",
    warn: "bg-amber-500",
    muted: "bg-gray-600",
  }[status.tone];

  return (
    <div
      className={`bg-gray-900 border border-gray-700 rounded-lg ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white">Credentials SMS</div>
          {withHistory && (
            <div className="flex items-start gap-2 mt-1.5">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${dotClass}`}
              />
              <span className={`text-xs ${toneClass}`}>{status.text}</span>
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {phone ? `To ${phone}` : "No number on record"}
          </div>
        </div>

        <button
          type="button"
          onClick={handleResend}
          disabled={sending || !sendable.ok}
          title={sendable.ok ? "Send the login credentials again" : sendable.reason}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition flex-shrink-0 active:scale-95 ${
            sendable.ok
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          } disabled:opacity-60 disabled:active:scale-100`}
        >
          {sending ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4h16v12H5.17L4 17.17V4z"
              />
            </svg>
          )}
          {sending ? "Sending..." : "Resend SMS"}
        </button>
      </div>

      {/* Why the button is unavailable — the reason is the fix the admin needs */}
      {!sendable.ok && (
        <p className="mt-2.5 text-xs text-amber-400/90">{sendable.reason}</p>
      )}

      {/* Outcome of the send just attempted */}
      {result && (
        <p
          className={`mt-2.5 text-xs ${
            result.success ? "text-green-400" : "text-red-400"
          }`}
        >
          {result.success
            ? `Credentials sent to ${result.phone}.`
            : `Could not send: ${result.error}`}
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <button
            type="button"
            onClick={() => setShowHistory((open) => !open)}
            className="text-xs text-gray-400 hover:text-white transition"
          >
            {showHistory ? "Hide" : "Show"} delivery history ({history.length})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
              {history.map((record) => (
                <li
                  key={record.id}
                  className="flex items-start gap-2 text-xs text-gray-400"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                      record.status === "sent" ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="min-w-0">
                    {record.status === "sent" ? "Sent" : "Failed"}{" "}
                    {formatWhen(record.sentAt)}
                    {record.attempt === "resend" ? " (resend)" : ""}
                    {record.error ? ` — ${record.error}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CredentialsSmsPanel;
