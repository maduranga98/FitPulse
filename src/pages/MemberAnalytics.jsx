import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const MemberAnalytics = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeRange, setTimeRange] = useState("30"); // days
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    newThisMonth: 0,
    newLastMonth: 0,
    retentionRate: 0,
    avgAge: 0,
    growthRate: 0,
  });
  const [chartData, setChartData] = useState({
    growth: [],
    status: [],
    level: [],
    ageDistribution: [],
    monthlyGrowth: [],
  });

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "gym_admin" ||
    user?.role === "gym_manager";

  useEffect(() => {
    if (isAdmin && currentGymId) {
      fetchMemberData();
    }
  }, [isAdmin, currentGymId, timeRange]);

  const fetchMemberData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch all members for this gym
      const membersQuery = query(
        collection(db, "members"),
        where("gymId", "==", currentGymId),
        orderBy("joinDate", "desc")
      );

      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setMembers(membersData);
      calculateStats(membersData);
      generateChartData(membersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching member data:", error);
      setLoading(false);
    }
  };

  const calculateStats = (membersData) => {
    const total = membersData.length;
    const active = membersData.filter((m) => m.status === "active").length;
    const inactive = total - active;

    // Calculate new members this month and last month
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const firstDayTwoMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 2,
      1
    );

    const newThisMonth = membersData.filter((m) => {
      const joinDate = m.joinDate?.toDate
        ? m.joinDate.toDate()
        : new Date(m.joinDate);
      return joinDate >= firstDayThisMonth;
    }).length;

    const newLastMonth = membersData.filter((m) => {
      const joinDate = m.joinDate?.toDate
        ? m.joinDate.toDate()
        : new Date(m.joinDate);
      return joinDate >= firstDayLastMonth && joinDate < firstDayThisMonth;
    }).length;

    // Calculate retention rate (members who joined 2+ months ago and are still active)
    const oldMembers = membersData.filter((m) => {
      const joinDate = m.joinDate?.toDate
        ? m.joinDate.toDate()
        : new Date(m.joinDate);
      return joinDate < firstDayTwoMonthsAgo;
    });
    const activeOldMembers = oldMembers.filter(
      (m) => m.status === "active"
    ).length;
    const retentionRate =
      oldMembers.length > 0
        ? ((activeOldMembers / oldMembers.length) * 100).toFixed(1)
        : 0;

    // Calculate average age
    const membersWithAge = membersData.filter((m) => m.age);

    const avgAge =
      membersWithAge.length > 0
        ? (
            membersWithAge.reduce((sum, m) => sum + parseInt(m.age || 0), 0) /
            membersWithAge.length
          ).toFixed(1)
        : 0;
    // console.log("Members with age:", membersWithAge, avgAge);
    // Calculate growth rate
    const growthRate =
      newLastMonth > 0
        ? (((newThisMonth - newLastMonth) / newLastMonth) * 100).toFixed(1)
        : newThisMonth > 0
        ? 100
        : 0;

    setStats({
      total,
      active,
      inactive,
      newThisMonth,
      newLastMonth,
      retentionRate,
      avgAge,
      growthRate,
    });
  };

  const generateChartData = (membersData) => {
    // Growth over time (last 6 months)
    const monthlyData = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      monthlyData[monthKey] = { month: monthKey, members: 0, new: 0 };
    }

    // Count members by join date
    membersData.forEach((member) => {
      const joinDate = member.joinDate?.toDate
        ? member.joinDate.toDate()
        : new Date(member.joinDate);

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });

        if (joinDate <= new Date(date.getFullYear(), date.getMonth() + 1, 0)) {
          monthlyData[monthKey].members++;
        }

        // Count new members in this month
        if (
          joinDate >= date &&
          joinDate < new Date(date.getFullYear(), date.getMonth() + 1, 1)
        ) {
          monthlyData[monthKey].new++;
        }
      }
    });

    const growthData = Object.values(monthlyData);

    // Status distribution
    const statusData = [
      { name: "Active", value: stats.active || 0, color: "#10b981" },
      { name: "Inactive", value: stats.inactive || 0, color: "#ef4444" },
    ];

    // Level distribution
    const levelCounts = membersData.reduce((acc, member) => {
      const level = member.level || "beginner";
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    const levelData = [
      { name: "Beginner", value: levelCounts.beginner || 0, color: "#3b82f6" },
      {
        name: "Intermediate",
        value: levelCounts.intermediate || 0,
        color: "#8b5cf6",
      },
      { name: "Advanced", value: levelCounts.advanced || 0, color: "#ec4899" },
      { name: "Expert", value: levelCounts.expert || 0, color: "#f59e0b" },
    ];

    // Age distribution
    const ageRanges = {
      "18-25": 0,
      "26-35": 0,
      "36-45": 0,
      "46-55": 0,
      "56+": 0,
    };

    membersData.forEach((member) => {
      const age = parseInt(member.age);
      if (age >= 18 && age <= 25) ageRanges["18-25"]++;
      else if (age >= 26 && age <= 35) ageRanges["26-35"]++;
      else if (age >= 36 && age <= 45) ageRanges["36-45"]++;
      else if (age >= 46 && age <= 55) ageRanges["46-55"]++;
      else if (age >= 56) ageRanges["56+"]++;
    });

    const ageData = Object.entries(ageRanges).map(([range, count]) => ({
      range,
      count,
    }));

    setChartData({
      growth: growthData,
      status: statusData,
      level: levelData.filter((d) => d.value > 0),
      ageDistribution: ageData,
      monthlyGrowth: growthData,
    });
  };

  const StatCard = ({ title, value, subtitle, icon, trend, color }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {icon}
          </svg>
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {trend > 0 ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              )}
            </svg>
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-gray-400 text-sm mb-1">{title}</p>
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
        {subtitle && <p className="text-gray-500 text-xs">{subtitle}</p>}
      </div>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-400">
            You don't have permission to view analytics.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading member analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.history.back()}
                    className="p-1 hover:bg-gray-700 rounded-lg transition"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">
                    Member Analytics
                  </h1>
                </div>
                <p className="text-gray-400 text-sm hidden sm:block">
                  Track member growth, retention, and engagement metrics
                </p>
              </div>
            </div>

            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </header>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Members"
              value={stats.total}
              subtitle={`${stats.active} active, ${stats.inactive} inactive`}
              color="bg-blue-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              }
            />

            <StatCard
              title="Active Members"
              value={stats.active}
              subtitle={`${((stats.active / stats.total) * 100).toFixed(
                1
              )}% of total`}
              color="bg-green-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              }
            />

            <StatCard
              title="New This Month"
              value={stats.newThisMonth}
              subtitle={`${stats.newLastMonth} last month`}
              trend={parseFloat(stats.growthRate)}
              color="bg-purple-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              }
            />

            <StatCard
              title="Retention Rate"
              value={`${stats.retentionRate}%`}
              subtitle={`Average age: ${stats.avgAge} years`}
              color="bg-orange-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              }
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Member Growth Chart */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Member Growth Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.growth}>
                  <defs>
                    <linearGradient
                      id="colorMembers"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="members"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorMembers)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly New Members */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                New Members per Month
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.monthlyGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="new" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Member Status Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.status}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.status.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Level Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Member Level Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.level}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.level.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Age Distribution Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold text-white mb-4">
              Age Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.ageDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="range" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "0.5rem",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="count" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Insights Section */}
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-600/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              Key Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Growth Trend</p>
                <p className="text-white font-semibold">
                  {stats.growthRate > 0 ? "📈 Positive" : "📉 Declining"} (
                  {stats.growthRate}%)
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.newThisMonth} new members this month
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Retention Health</p>
                <p className="text-white font-semibold">
                  {stats.retentionRate >= 80
                    ? "✅ Excellent"
                    : stats.retentionRate >= 60
                    ? "⚠️ Good"
                    : "❌ Needs Attention"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.retentionRate}% retention rate
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Active Ratio</p>
                <p className="text-white font-semibold">
                  {((stats.active / stats.total) * 100).toFixed(1)}% Active
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.active} out of {stats.total} members
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MemberAnalytics;
