import { useState } from "react";
import { X, Send, Users, AlertCircle } from "lucide-react";

const AnnouncementModal = ({ classData, isOpen, onClose, onSend }) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      alert("Please enter both title and message");
      return;
    }

    setSending(true);
    try {
      await onSend(title, message);
      setTitle("");
      setMessage("");
      onClose();
    } catch (error) {
      console.error("Error sending announcement:", error);
      alert("Failed to send announcement. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !classData) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full my-4 sm:my-8 mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2">
                📢 Send Announcement
              </h2>
              <p className="text-white/80">
                For: <span className="font-semibold">{classData.className}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Info Banner */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-300 text-sm">
                  This announcement will be sent to all{" "}
                  <span className="font-bold">{classData.currentBookings || 0} enrolled members</span>
                </p>
              </div>
            </div>
          </div>

          {/* Warning if no members */}
          {(!classData.currentBookings || classData.currentBookings === 0) && (
            <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <p className="text-orange-300 text-sm">
                  There are currently no members enrolled in this class. The announcement will not be sent to anyone.
                </p>
              </div>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Announcement Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Important Update, Class Reminder, etc."
              maxLength={50}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <p className="text-xs text-gray-500 mt-1">{title.length}/50 characters</p>
          </div>

          {/* Message Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your announcement message here. This will be sent to all enrolled members."
              rows={6}
              maxLength={500}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">{message.length}/500 characters</p>
          </div>

          {/* Preview */}
          {(title || message) && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Preview</label>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">📢</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold mb-1">
                      {title || "Announcement Title"}
                    </h4>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">
                      {message || "Your message will appear here..."}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Class: {classData.className}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              disabled={sending}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !message.trim()}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Announcement
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
