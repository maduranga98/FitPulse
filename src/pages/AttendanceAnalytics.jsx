import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getAttendanceRange } from "../services/attendanceService";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const AttendanceAnalytics = () => {
  const { user } = useAuth();
  const gymId = user?.gymId;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [timeRange, setTimeRange] = useState("30");

  const [stats, setStats] = useState({
    totalCheckins: 0,
    todayCheckins: 0,
    avgPerDay: 0,
    peakHour: "N/A",
    uniqueMembers: 0,
  });
  const [dailyData, setDailyData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [verifyModeData, setVerifyModeData] = useState([]);
  const [topMembers, setTopMembers] = useState([]);

  const getDate = (record) => {
    if (record.checkInTime?.toDate) return record.checkInTime.toDate();
    if (record.checkInTime?.seconds) return new Date(record.checkInTime.seconds * 1000);
    return null;
  };

  const getEmployeeNo = (record) =>
    record.rawEvent?.employeeNo || record.employeeNo || record.memberId;

  const getVerifyMode = (record) =>
    record.rawEvent?.verifyMode || record.verifyMode || "unknown";

  useEffect(() => {
    if (!gymId) return;
    fetchData();
  }, [gymId, timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const days = parseInt(timeRange);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0);

      const data = await getAttendanceRange(gymId, start, end);
      setAttendance(data);
      computeStats(data, start, end, days);
    } catch (err) {
      console.error("Error fetching attendance analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (data, start, end, days) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCheckins = data.filter((r) => {
      const d = getDate(r);
      return d && d >= today;
    }).length;

    const uniqueMembers = new Set(data.map((r) => getEmployeeNo(r)).filter(Boolean)).size;

    // Daily buckets
    const daily = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toLocaleDateString("en-LK", { month: "short", day: "numeric" });
      daily[key] = 0;
    }
    data.forEach((r) => {
      const d = getDate(r);
      if (!d) return;
      const key = d.toLocaleDateString("en-LK", { month: "short", day: "numeric" });
      if (daily[key] !== undefined) daily[key]++;
    });
    const dailyArr = Object.entries(daily).map(([date, count]) => ({ date, count }));

    // Hourly distribution
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, count: 0 }));
    data.forEach((r) => {
      const d = getDate(r);
      if (!d) return;
      hourly[d.getHours()].count++;
    });
    const peakHourObj = hourly.reduce((a, b) => (b.count > a.count ? b : a), hourly[0]);

    // Verify mode breakdown
    const modes = {};
    data.forEach((r) => {
      const m = getVerifyMode(r);
      modes[m] = (modes[m] || 0) + 1;
    });
    const modeArr = Object.entries(modes).map(([name, value]) => ({ name, value }));

    // Top members by attendance
    const byMember = {};
    data.forEach((r) => {
      const key = getEmployeeNo(r) || "unknown";
      if (!byMember[key]) byMember[key] = { name: r.memberName || key, count: 0 };
      byMember[key].count++;
    });
    const top = Object.values(byMember)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setStats({
      totalCheckins: data.length,
      todayCheckins,
      avgPerDay: days > 0 ? (data.length / days).toFixed(1) : 0,
      peakHour: peakHourObj.hour,
      uniqueMembers,
    });
    setDailyData(dailyArr);
    setHourlyData(hourly);
    setVerifyModeData(modeArr);
    setTopMembers(top);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Attendance Analytics</h1>
                <p className="text-gray-400 text-sm hidden sm:block">Check-in trends and member patterns</p>
              </div>
            </div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
                {[
                  { label: "Total Check-ins", value: stats.totalCheckins, color: "text-blue-400" },
                  { label: "Today", value: stats.todayCheckins, color: "text-green-400" },
                  { label: "Avg / Day", value: stats.avgPerDay, color: "text-yellow-400" },
                  { label: "Unique Members", value: stats.uniqueMembers, color: "text-purple-400" },
                  { label: "Peak Hour", value: stats.peakHour, color: "text-pink-400" },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-gray-400 text-xs mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Daily Trend */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
                <h3 className="text-white font-semibold mb-4">Daily Check-ins</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", color: "#fff" }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Check-ins" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Hourly Distribution */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4">Check-in by Hour</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="hour" tick={{ fill: "#9ca3af", fontSize: 10 }} interval={3} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", color: "#fff" }} />
                      <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} name="Check-ins" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Verify Mode Pie */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4">Verification Method</h3>
                  {verifyModeData.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="60%" height={180}>
                        <PieChart>
                          <Pie data={verifyModeData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                            {verifyModeData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", color: "#fff" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {verifyModeData.map((item, i) => (
                          <div key={item.name} className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                            <span className="text-gray-300 capitalize">{item.name}</span>
                            <span className="ml-auto text-white font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No data</p>
                  )}
                </div>
              </div>

              {/* Top Members */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Top Members by Attendance</h3>
                {topMembers.length === 0 ? (
                  <p className="text-gray-500 text-sm">No attendance records in this period</p>
                ) : (
                  <div className="space-y-3">
                    {topMembers.map((m, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm w-5">{i + 1}</span>
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{m.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-white text-sm flex-1 truncate">{m.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-700 rounded-full h-2 w-24 overflow-hidden">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${(m.count / topMembers[0].count) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-blue-400 font-medium text-sm w-8 text-right">{m.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AttendanceAnalytics;
