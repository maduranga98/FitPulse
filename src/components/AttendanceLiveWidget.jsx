import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const todayStr = () => new Date().toISOString().split("T")[0];

const toJsDate = (value) => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  return new Date(value);
};

const formatTime = (value) => {
  const d = toJsDate(value);
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

const initials = (name = "") =>
  name
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const EVENT_LABELS = {
  196893: "Face Recognition",
  198914: "Card Tap",
  198915: "Card + PIN",
  196890: "Face + Card",
};

const methodLabel = (method) => {
  if (method === "hikvision-openapi") return "Access Control";
  if (method === "cloud-vision-multi-photo" || method === "cloud-vision") return "AI Vision";
  if (method === "manual") return "Manual";
  return "Other";
};

const AttendanceLiveWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const gymId = user?.gymId;
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gymId) {
      setLoading(false);
      return;
    }
    let unsubscribe;
    (async () => {
      try {
        const { db } = await import("../config/firebase");
        const { collection, query, where, orderBy, limit, onSnapshot } =
          await import("firebase/firestore");
        const q = query(
          collection(db, "attendance"),
          where("gymId", "==", gymId),
          where("date", "==", todayStr()),
          orderBy("checkInTime", "desc"),
          limit(5)
        );
        unsubscribe = onSnapshot(
          q,
          (snap) => {
            setCheckIns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoading(false);
          },
          (err) => {
            console.error("Live check-ins listener error:", err);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Failed to set up live check-ins:", err);
        setLoading(false);
      }
    })();
    return () => unsubscribe && unsubscribe();
  }, [gymId]);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
          <h2 className="text-lg font-bold text-white">Live Check-ins Today</h2>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
          {checkIns.length}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-28">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : checkIns.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No check-ins today yet</p>
      ) : (
        <div className="divide-y divide-gray-700/50">
          {checkIns.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 sm:px-6 py-3 animate-[slideIn_0.3s_ease-out]"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {initials(item.memberName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.memberName || "Unknown"}</p>
                <p className="text-gray-400 text-xs truncate">
                  {methodLabel(item.recognitionMethod)}
                  {item.eventType && EVENT_LABELS[item.eventType] ? ` · ${EVENT_LABELS[item.eventType]}` : ""}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-gray-300 text-xs">{item.doorName || "—"}</p>
                <p className="text-gray-500 text-xs">{formatTime(item.checkInTime)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate("/devices", { state: { tab: "log" } })}
        className="w-full px-4 sm:px-6 py-3 border-t border-gray-700 text-blue-400 hover:text-blue-300 hover:bg-gray-700/30 text-sm font-medium transition"
      >
        View All →
      </button>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AttendanceLiveWidget;
