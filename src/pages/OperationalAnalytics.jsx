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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const OperationalAnalytics = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeRange, setTimeRange] = useState("30");
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalRevenue: 0,
    totalWorkouts: 0,
    totalSchedules: 0,
    pendingComplaints: 0,
    collectionRate: 0,
    memberEngagement: 0,
    overallHealth: 0,
  });
  const [chartData, setChartData] = useState({
    kpiRadar: [],
    monthlyOverview: [],
    engagementTrend: [],
    performanceScore: [],
  });

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "gym_admin" ||
    user?.role === "gym_manager";

  useEffect(() => {
    if (isAdmin && currentGymId) {
      fetchOperationalData();
    }
  }, [isAdmin, currentGymId, timeRange]);

  const fetchOperationalData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch all data
      const [
        membersSnapshot,
        paymentsSnapshot,
        schedulesSnapshot,
        workoutLogsSnapshot,
        complaintsSnapshot,
      ] = await Promise.all([
        getDocs(
          query(collection(db, "members"), where("gymId", "==", currentGymId))
        ),
        getDocs(
          query(
            collection(db, "payments"),
            where("gymId", "==", currentGymId),
            orderBy("paidAt", "desc")
          )
        ),
        getDocs(
          query(collection(db, "schedules"), where("gymId", "==", currentGymId))
        ),
        getDocs(
          query(collection(db, "workoutLogs"), orderBy("completedAt", "desc"))
        ),
        getDocs(
          query(
            collection(db, "complaints"),
            where("gymId", "==", currentGymId)
          )
        ),
      ]);

      const members = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const payments = paymentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const schedules = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const workoutLogs = workoutLogsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const complaints = complaintsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      calculateStats(members, payments, schedules, workoutLogs, complaints);
      generateChartData(members, payments, schedules, workoutLogs, complaints);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching operational data:", error);
      setLoading(false);
    }
  };

  const calculateStats = (
    members,
    payments,
    schedules,
    workoutLogs,
    complaints
  ) => {
    const totalMembers = members.length;
    const activeMembers = members.filter((m) => m.status === "active").length;
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalWorkouts = workoutLogs.length;
    const totalSchedules = schedules.length;
    const pendingComplaints = complaints.filter(
      (c) => c.status === "Pending"
    ).length;

    // Collection rate
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const paidMemberIds = new Set(
      payments.filter((p) => p.month === currentMonth).map((p) => p.memberId)
    );
    const activeMembersCount = members.filter(
      (m) => m.status === "active"
    ).length;
    const collectionRate =
      activeMembersCount > 0
        ? (paidMemberIds.size / activeMembersCount) * 100
        : 0;

    // Member engagement (based on workouts and schedules)
    const membersWithWorkouts = new Set(workoutLogs.map((w) => w.memberId))
      .size;
    const membersWithSchedules = new Set(schedules.map((s) => s.memberId)).size;
    const memberEngagement =
      totalMembers > 0
        ? ((membersWithWorkouts + membersWithSchedules) / (totalMembers * 2)) *
          100
        : 0;

    // Overall health score (composite metric)
    const revenueScore = Math.min((totalRevenue / 1000000) * 100, 100);
    const engagementScore = memberEngagement;
    const collectionScore = collectionRate;
    const complaintScore = Math.max(
      0,
      100 - (pendingComplaints / totalMembers) * 100
    );

    const overallHealth =
      (revenueScore * 0.3 +
        engagementScore * 0.3 +
        collectionScore * 0.25 +
        complaintScore * 0.15) /
      1;

    setStats({
      totalMembers,
      activeMembers,
      totalRevenue,
      totalWorkouts,
      totalSchedules,
      pendingComplaints,
      collectionRate,
      memberEngagement,
      overallHealth,
    });
  };

  const generateChartData = (
    members,
    payments,
    schedules,
    workoutLogs,
    complaints
  ) => {
    // KPI Radar Chart
    const kpiRadar = [
      {
        metric: "Revenue",
        value: Math.min((stats.totalRevenue / 1000000) * 100, 100),
        fullMark: 100,
      },
      {
        metric: "Engagement",
        value: stats.memberEngagement,
        fullMark: 100,
      },
      {
        metric: "Collection",
        value: stats.collectionRate,
        fullMark: 100,
      },
      {
        metric: "Satisfaction",
        value: Math.max(
          0,
          100 - (stats.pendingComplaints / stats.totalMembers) * 100
        ),
        fullMark: 100,
      },
      {
        metric: "Activity",
        value: Math.min((stats.totalWorkouts / stats.totalMembers) * 10, 100),
        fullMark: 100,
      },
    ];

    // Monthly overview (last 6 months)
    const monthlyData = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      monthlyData[monthKey] = {
        month: monthKey,
        members: 0,
        revenue: 0,
        workouts: 0,
        complaints: 0,
      };
    }

    // Calculate monthly metrics
    members.forEach((member) => {
      const joinDate = member.joinDate?.toDate
        ? member.joinDate.toDate()
        : new Date(member.joinDate);

      Object.keys(monthlyData).forEach((monthKey) => {
        const [month, year] = monthKey.split(" ");
        const monthDate = new Date(`${month} 1, ${year}`);
        const nextMonth = new Date(monthDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        if (joinDate <= nextMonth) {
          monthlyData[monthKey].members++;
        }
      });
    });

    payments.forEach((payment) => {
      const paidDate = payment.paidAt?.toDate
        ? payment.paidAt.toDate()
        : new Date(payment.paidAt);

      const monthKey = paidDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      if (monthlyData[monthKey]) {
        monthlyData[monthKey].revenue += payment.amount || 0;
      }
    });

    workoutLogs.forEach((log) => {
      const completedDate = log.completedAt?.toDate
        ? log.completedAt.toDate()
        : new Date(log.completedAt);

      const monthKey = completedDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      if (monthlyData[monthKey]) {
        monthlyData[monthKey].workouts++;
      }
    });

    complaints.forEach((complaint) => {
      const createdDate = complaint.createdAt?.toDate
        ? complaint.createdAt.toDate()
        : new Date(complaint.createdAt);

      const monthKey = createdDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      if (monthlyData[monthKey]) {
        monthlyData[monthKey].complaints++;
      }
    });

    const monthlyOverview = Object.values(monthlyData);

    // Engagement trend (last 30 days)
    const engagementData = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      engagementData[dateKey] = {
        date: dateKey,
        workouts: 0,
        activeMembers: 0,
      };
    }

    workoutLogs.forEach((log) => {
      const completedDate = log.completedAt?.toDate
        ? log.completedAt.toDate()
        : new Date(log.completedAt);

      const dateKey = completedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      if (engagementData[dateKey]) {
        engagementData[dateKey].workouts++;
      }
    });

    const engagementTrend = Object.values(engagementData);

    // Performance score breakdown
    const performanceScore = [
      {
        name: "Revenue",
        score: Math.min((stats.totalRevenue / 1000000) * 100, 100),
      },
      { name: "Engagement", score: stats.memberEngagement },
      { name: "Collection", score: stats.collectionRate },
      {
        name: "Satisfaction",
        score: Math.max(
          0,
          100 - (stats.pendingComplaints / stats.totalMembers) * 100
        ),
      },
    ];

    setChartData({
      kpiRadar,
      monthlyOverview,
      engagementTrend,
      performanceScore,
    });
  };

  const StatCard = ({ title, value, subtitle, icon, color, trend }) => (
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
            className={`text-sm font-medium ${
              trend >= 80
                ? "text-green-600"
                : trend >= 60
                ? "text-yellow-600"
                : "text-red-600"
            }`}
          >
            {trend >= 80 ? "✅" : trend >= 60 ? "⚠️" : "❌"}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading operational analytics...</p>
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
                    Operational Analytics
                  </h1>
                </div>
                <p className="text-gray-400 text-sm hidden sm:block">
                  Overall gym operations and performance insights
                </p>
              </div>
            </div>

            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-600"
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
          {/* Overall Health Score */}
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-600/30 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                Overall Health Score
              </h3>
              <div className="text-4xl font-bold text-yellow-400">
                {stats.overallHealth.toFixed(0)}%
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${
                  stats.overallHealth >= 80
                    ? "bg-green-600"
                    : stats.overallHealth >= 60
                    ? "bg-yellow-600"
                    : "bg-red-600"
                }`}
                style={{ width: `${stats.overallHealth}%` }}
              ></div>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              Composite score based on revenue, engagement, collection rate, and
              member satisfaction
            </p>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Members"
              value={stats.totalMembers}
              subtitle={`${stats.activeMembers} active members`}
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
              title="Member Engagement"
              value={`${stats.memberEngagement.toFixed(1)}%`}
              subtitle="Workout & schedule participation"
              color="bg-purple-600"
              trend={stats.memberEngagement}
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              }
            />

            <StatCard
              title="Collection Rate"
              value={`${stats.collectionRate.toFixed(1)}%`}
              subtitle="Payment collection efficiency"
              color="bg-green-600"
              trend={stats.collectionRate}
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
              title="Pending Complaints"
              value={stats.pendingComplaints}
              subtitle="Requires attention"
              color="bg-red-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              }
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* KPI Radar Chart */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Performance KPI Overview
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={chartData.kpiRadar}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="metric" stroke="#9ca3af" />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    stroke="#9ca3af"
                  />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.6}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Score Breakdown */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Performance Score Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.performanceScore}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="score" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Overview */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:col-span-2">
              <h3 className="text-lg font-bold text-white mb-4">
                Monthly Overview (Last 6 Months)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.monthlyOverview}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis yAxisId="left" stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="members"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Members"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="workouts"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Workouts"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Revenue"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="complaints"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Complaints"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Engagement Trend */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:col-span-2">
              <h3 className="text-lg font-bold text-white mb-4">
                Daily Workout Activity (Last 30 Days)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.engagementTrend}>
                  <defs>
                    <linearGradient
                      id="colorEngagement"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
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
                    dataKey="workouts"
                    stroke="#f59e0b"
                    fillOpacity={1}
                    fill="url(#colorEngagement)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Insights Section */}
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-600/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-yellow-400"
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
              Operational Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Overall Status</p>
                <p className="text-white font-semibold">
                  {stats.overallHealth >= 80
                    ? "🎯 Excellent"
                    : stats.overallHealth >= 60
                    ? "✅ Good"
                    : "⚠️ Needs Improvement"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.overallHealth.toFixed(0)}% health score
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Engagement Level</p>
                <p className="text-white font-semibold">
                  {stats.memberEngagement >= 70
                    ? "💪 High"
                    : stats.memberEngagement >= 40
                    ? "👍 Moderate"
                    : "📉 Low"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.memberEngagement.toFixed(1)}% active participation
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Financial Health</p>
                <p className="text-white font-semibold">
                  {stats.collectionRate >= 80
                    ? "💰 Strong"
                    : stats.collectionRate >= 60
                    ? "💵 Stable"
                    : "📊 Weak"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.collectionRate.toFixed(1)}% collection rate
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">
                  Member Satisfaction
                </p>
                <p className="text-white font-semibold">
                  {stats.pendingComplaints < 5
                    ? "😊 High"
                    : stats.pendingComplaints < 10
                    ? "😐 Medium"
                    : "😟 Low"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.pendingComplaints} pending complaints
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default OperationalAnalytics;
