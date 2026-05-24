import { useState, useEffect } from "react";
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
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const initials = (name = "") =>
  name
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const MethodBadge = ({ method }) => {
  let label = "Manual";
  let cls = "bg-gray-500/20 text-gray-300";
  if (method === "hikvision-openapi") {
    label = "HikCentral";
    cls = "bg-blue-500/20 text-blue-400";
  } else if (method === "cloud-vision-multi-photo" || method === "cloud-vision") {
    label = "AI Vision";
    cls = "bg-purple-500/20 text-purple-400";
  }
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

const AttendanceLiveWidget = () => {
  const { user } = useAuth();
  const gymId = user?.gymId;
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gymId) {
      setLoading(false);
      return;
    }

    let unsubscribe;
    const setup = async () => {
      try {
        const { db } = await import("../config/firebase");
        const { collection, query, where, orderBy, limit, onSnapshot } =
          await import("firebase/firestore");

        const q = query(
          collection(db, "attendance"),
          where("gymId", "==", gymId),
          where("date", "==", todayStr()),
          orderBy("checkInTime", "desc"),
          limit(10)
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
    };

    setup();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [gymId]);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
          <h2 className="text-lg font-bold text-white">Live Check-ins Today</h2>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
          {checkIns.length} check-in{checkIns.length === 1 ? "" : "s"} today
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : checkIns.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No check-ins yet today</p>
      ) : (
        <div className="space-y-2">
          {checkIns.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 animate-[slideIn_0.3s_ease-out]"
            >
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {initials(item.memberName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {item.memberName || "Unknown"}
                </p>
                <p className="text-gray-400 text-xs truncate">
                  {item.doorName || "—"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-gray-300 text-xs">{formatTime(item.checkInTime)}</span>
                <MethodBadge method={item.recognitionMethod} />
              </div>
            </div>
          ))}
        </div>
      )}

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
