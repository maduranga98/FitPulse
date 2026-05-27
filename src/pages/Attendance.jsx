import { useState, useEffect } from "react";
import {
  getTodayAttendance,
  getAttendanceRange,
  subscribeToAttendance,
} from "../services/attendanceService";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";

const Attendance = () => {
  const { user } = useAuth();
  const gymId =
    user?.gymId || JSON.parse(localStorage.getItem("gymUser") || "{}")?.gymId;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [isToday, setIsToday] = useState(true);

  // Format time to readable string
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("en-LK", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  // Format date
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString("en-LK", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Get verify mode label
  const getVerifyMode = (mode) => {
    const modes = {
      face: { label: "Face", color: "text-green-400 bg-green-400/10" },
      fingerprint: {
        label: "Fingerprint",
        color: "text-blue-400 bg-blue-400/10",
      },
      card: { label: "Card", color: "text-yellow-400 bg-yellow-400/10" },
    };
    return (
      modes[mode] || {
        label: mode || "Unknown",
        color: "text-gray-400 bg-gray-400/10",
      }
    );
  };

  // Load attendance for selected date
  const loadAttendance = async () => {
    if (!gymId) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const todayFlag = selectedDate === today;
      setIsToday(todayFlag);

      let data;
      if (todayFlag) {
        data = await getTodayAttendance(gymId);
      } else {
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
        data = await getAttendanceRange(gymId, start, end);
      }

      setAttendance(data || []);
      setLiveCount(data?.length || 0);
    } catch (err) {
      console.error("Error loading attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadAttendance();
  }, [gymId, selectedDate]);

  // Realtime subscription for today only
  useEffect(() => {
    if (!gymId || !isToday) return;

    const unsubscribe = subscribeToAttendance(gymId, (newEvent) => {
      setAttendance((prev) => {
        // Avoid duplicates
        const exists = prev.find((e) => e.id === newEvent.id);
        if (exists) {
          return prev.map((e) => (e.id === newEvent.id ? newEvent : e));
        }
        return [newEvent, ...prev];
      });
      setLiveCount((prev) => prev + 1);
    });

    return unsubscribe;
  }, [gymId, isToday]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-950 text-white flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Attendance</h1>
                <p className="text-gray-400 text-sm mt-1">
                  {isToday
                    ? "Live tracking — updates in real time"
                    : `Records for ${formatDate(selectedDate)}`}
                </p>
              </div>
            </div>

            {/* Live indicator */}
            {isToday && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-green-400 text-sm font-medium">Live</span>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-white">{liveCount}</p>
              <p className="text-gray-400 text-sm mt-1">Total Check-ins</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400">
                {attendance.filter((a) => a.verify_mode === "face").length}
              </p>
              <p className="text-gray-400 text-sm mt-1">Face Verified</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">
                {attendance.filter((a) => a.enriched).length}
              </p>
              <p className="text-gray-400 text-sm mt-1">Identified</p>
            </div>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-4 mb-6">
            <input
              type="date"
              value={selectedDate}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() =>
                setSelectedDate(new Date().toISOString().split("T")[0])
              }
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Back to Today
            </button>
          </div>

          {/* Attendance List */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-400 mt-4 text-sm">
                  Loading attendance...
                </p>
              </div>
            ) : attendance.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-400">
                  No attendance records for this date
                </p>
                <p className="text-gray-600 text-sm mt-1">
                  Records will appear here when members check in
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {attendance.map((record, index) => {
                  const verifyMode = getVerifyMode(record.verify_mode);
                  const name =
                    record.member_name || record.employee_no || "Unknown";
                  const initial = name.charAt(0).toUpperCase();

                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Left — Avatar + Info */}
                      <div className="flex items-center gap-4">
                        {/* Index number */}
                        <span className="text-gray-600 text-sm w-6 text-right">
                          {index + 1}
                        </span>

                        {/* Avatar */}
                        <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-lg">
                            {initial}
                          </span>
                        </div>

                        {/* Name + Code */}
                        <div>
                          <p className="text-white font-medium">
                            {record.member_name || (
                              <span className="text-gray-500 italic">
                                Unidentified
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500 text-xs">
                              {record.employee_no}
                            </span>
                            <span className="text-gray-700">•</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${verifyMode.color}`}
                            >
                              {verifyMode.label}
                            </span>
                            {!record.enriched && (
                              <span className="text-xs px-2 py-0.5 rounded-full text-yellow-400 bg-yellow-400/10">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right — Time */}
                      <div className="text-right">
                        <p className="text-blue-400 font-bold text-lg">
                          {formatTime(record.event_time)}
                        </p>
                        <p className="text-gray-600 text-xs mt-1">
                          {record.event_type || "check_in"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Attendance;
