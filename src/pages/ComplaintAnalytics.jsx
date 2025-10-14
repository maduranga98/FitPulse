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

const ComplaintAnalytics = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeRange, setTimeRange] = useState("30");
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({
    totalComplaints: 0,
    pendingComplaints: 0,
    resolvedComplaints: 0,
    inProgressComplaints: 0,
    avgResolutionTime: 0,
    resolutionRate: 0,
    thisMonthComplaints: 0,
    lastMonthComplaints: 0,
    growthRate: 0,
  });
  const [chartData, setChartData] = useState({
    statusDistribution: [],
    categoryDistribution: [],
    priorityDistribution: [],
    complaintTrend: [],
    resolutionTime: [],
    monthlyComparison: [],
  });

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "gym_admin" ||
    user?.role === "gym_manager";

  useEffect(() => {
    if (isAdmin && currentGymId) {
      fetchComplaintData();
    }
  }, [isAdmin, currentGymId, timeRange]);

  const fetchComplaintData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch complaints for this gym
      const complaintsQuery = query(
        collection(db, "complaints"),
        where("gymId", "==", currentGymId),
        orderBy("createdAt", "desc")
      );

      const complaintsSnapshot = await getDocs(complaintsQuery);
      const complaintsData = complaintsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setComplaints(complaintsData);
      calculateStats(complaintsData);
      generateChartData(complaintsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching complaint data:", error);
      setLoading(false);
    }
  };

  const calculateStats = (complaintsData) => {
    const totalComplaints = complaintsData.length;
    const pendingComplaints = complaintsData.filter(
      (c) => c.status === "Pending"
    ).length;
    const resolvedComplaints = complaintsData.filter(
      (c) => c.status === "Resolved"
    ).length;
    const inProgressComplaints = complaintsData.filter(
      (c) => c.status === "In Progress"
    ).length;

    // Calculate resolution rate
    const resolutionRate =
      totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0;

    // Calculate average resolution time (for resolved complaints)
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    complaintsData.forEach((complaint) => {
      if (complaint.status === "Resolved" && complaint.createdAt) {
        const createdDate = complaint.createdAt?.toDate
          ? complaint.createdAt.toDate()
          : new Date(complaint.createdAt);

        // Find resolution date from responses
        const resolutionResponse = complaint.responses?.find(
          (r) => r.newStatus === "Resolved"
        );

        if (resolutionResponse?.timestamp) {
          const resolvedDate = resolutionResponse.timestamp?.toDate
            ? resolutionResponse.timestamp.toDate()
            : new Date(resolutionResponse.timestamp);

          const timeDiff = resolvedDate - createdDate;
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

          totalResolutionTime += daysDiff;
          resolvedCount++;
        }
      }
    });

    const avgResolutionTime =
      resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;

    // Calculate this month vs last month
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    const thisMonthComplaints = complaintsData.filter((c) => {
      const createdDate = c.createdAt?.toDate
        ? c.createdAt.toDate()
        : new Date(c.createdAt);
      return createdDate >= firstDayThisMonth;
    }).length;

    const lastMonthComplaints = complaintsData.filter((c) => {
      const createdDate = c.createdAt?.toDate
        ? c.createdAt.toDate()
        : new Date(c.createdAt);
      return (
        createdDate >= firstDayLastMonth && createdDate < firstDayThisMonth
      );
    }).length;

    // Calculate growth rate
    const growthRate =
      lastMonthComplaints > 0
        ? ((thisMonthComplaints - lastMonthComplaints) / lastMonthComplaints) *
          100
        : thisMonthComplaints > 0
        ? 100
        : 0;

    setStats({
      totalComplaints,
      pendingComplaints,
      resolvedComplaints,
      inProgressComplaints,
      avgResolutionTime,
      resolutionRate,
      thisMonthComplaints,
      lastMonthComplaints,
      growthRate,
    });
  };

  const generateChartData = (complaintsData) => {
    // Status distribution
    const statusDistribution = [
      {
        name: "Pending",
        value: complaintsData.filter((c) => c.status === "Pending").length,
        color: "#f59e0b",
      },
      {
        name: "In Progress",
        value: complaintsData.filter((c) => c.status === "In Progress").length,
        color: "#3b82f6",
      },
      {
        name: "Resolved",
        value: complaintsData.filter((c) => c.status === "Resolved").length,
        color: "#10b981",
      },
    ].filter((item) => item.value > 0);

    // Category distribution
    const categoryCounts = complaintsData.reduce((acc, complaint) => {
      const category = complaint.category || "Other";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const categoryColors = {
      Equipment: "#3b82f6",
      Cleanliness: "#10b981",
      Staff: "#8b5cf6",
      Schedule: "#f59e0b",
      Facilities: "#ec4899",
      Other: "#6b7280",
    };

    const categoryDistribution = Object.entries(categoryCounts).map(
      ([category, count]) => ({
        name: category,
        value: count,
        color: categoryColors[category] || "#6b7280",
      })
    );

    // Priority distribution
    const priorityCounts = complaintsData.reduce((acc, complaint) => {
      const priority = complaint.priority || "Medium";
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});

    const priorityDistribution = [
      { name: "Low", value: priorityCounts.Low || 0, color: "#10b981" },
      { name: "Medium", value: priorityCounts.Medium || 0, color: "#f59e0b" },
      { name: "High", value: priorityCounts.High || 0, color: "#ef4444" },
    ].filter((item) => item.value > 0);

    // Complaint trend (last 30 days)
    const complaintTrend = {};
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      complaintTrend[dateKey] = {
        date: dateKey,
        complaints: 0,
        resolved: 0,
      };
    }

    complaintsData.forEach((complaint) => {
      const createdDate = complaint.createdAt?.toDate
        ? complaint.createdAt.toDate()
        : new Date(complaint.createdAt);

      const dateKey = createdDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      if (complaintTrend[dateKey]) {
        complaintTrend[dateKey].complaints++;
        if (complaint.status === "Resolved") {
          complaintTrend[dateKey].resolved++;
        }
      }
    });

    const complaintTrendData = Object.values(complaintTrend);

    // Resolution time distribution
    const resolutionTimeBuckets = {
      "< 1 day": 0,
      "1-3 days": 0,
      "4-7 days": 0,
      "8-14 days": 0,
      "> 14 days": 0,
    };

    complaintsData.forEach((complaint) => {
      if (complaint.status === "Resolved" && complaint.createdAt) {
        const createdDate = complaint.createdAt?.toDate
          ? complaint.createdAt.toDate()
          : new Date(complaint.createdAt);

        const resolutionResponse = complaint.responses?.find(
          (r) => r.newStatus === "Resolved"
        );

        if (resolutionResponse?.timestamp) {
          const resolvedDate = resolutionResponse.timestamp?.toDate
            ? resolutionResponse.timestamp.toDate()
            : new Date(resolutionResponse.timestamp);

          const timeDiff = resolvedDate - createdDate;
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

          if (daysDiff < 1) resolutionTimeBuckets["< 1 day"]++;
          else if (daysDiff <= 3) resolutionTimeBuckets["1-3 days"]++;
          else if (daysDiff <= 7) resolutionTimeBuckets["4-7 days"]++;
          else if (daysDiff <= 14) resolutionTimeBuckets["8-14 days"]++;
          else resolutionTimeBuckets["> 14 days"]++;
        }
      }
    });

    const resolutionTime = Object.entries(resolutionTimeBuckets).map(
      ([range, count]) => ({
        range,
        count,
      })
    );

    // Monthly comparison (last 6 months)
    const monthlyData = {};

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      monthlyData[monthKey] = {
        month: monthKey,
        total: 0,
        resolved: 0,
        pending: 0,
      };
    }

    complaintsData.forEach((complaint) => {
      const createdDate = complaint.createdAt?.toDate
        ? complaint.createdAt.toDate()
        : new Date(complaint.createdAt);

      const monthKey = createdDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      if (monthlyData[monthKey]) {
        monthlyData[monthKey].total++;
        if (complaint.status === "Resolved") {
          monthlyData[monthKey].resolved++;
        } else if (complaint.status === "Pending") {
          monthlyData[monthKey].pending++;
        }
      }
    });

    const monthlyComparison = Object.values(monthlyData);

    setChartData({
      statusDistribution,
      categoryDistribution,
      priorityDistribution,
      complaintTrend: complaintTrendData,
      resolutionTime,
      monthlyComparison,
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
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend < 0
                ? "text-green-600"
                : trend > 0
                ? "text-red-600"
                : "text-gray-400"
            }`}
          >
            {trend !== 0 && (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {trend < 0 ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                )}
              </svg>
            )}
            {trend !== 0 && `${Math.abs(trend).toFixed(1)}%`}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading complaint analytics...</p>
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
                    Complaint Analytics
                  </h1>
                </div>
                <p className="text-gray-400 text-sm hidden sm:block">
                  Track and analyze member complaints and resolutions
                </p>
              </div>
            </div>

            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600"
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
              title="Total Complaints"
              value={stats.totalComplaints}
              subtitle={`${stats.thisMonthComplaints} this month`}
              trend={parseFloat(stats.growthRate)}
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

            <StatCard
              title="Pending Complaints"
              value={stats.pendingComplaints}
              subtitle={`${stats.inProgressComplaints} in progress`}
              color="bg-orange-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              }
            />

            <StatCard
              title="Resolution Rate"
              value={`${stats.resolutionRate.toFixed(1)}%`}
              subtitle={`${stats.resolvedComplaints} resolved`}
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
              title="Avg Resolution Time"
              value={`${stats.avgResolutionTime.toFixed(1)} days`}
              subtitle="For resolved complaints"
              color="bg-blue-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              }
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Complaint Trend */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Complaint Trend (Last 30 Days)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.complaintTrend}>
                  <defs>
                    <linearGradient
                      id="colorComplaints"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="complaints"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#colorComplaints)"
                    name="Total"
                  />
                  <Area
                    type="monotone"
                    dataKey="resolved"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                    name="Resolved"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Status Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Status Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.statusDistribution}
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
                    {chartData.statusDistribution.map((entry, index) => (
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

            {/* Category Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Complaint Categories
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.categoryDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  {chartData.categoryDistribution.map((entry, index) => (
                    <Bar
                      key={`bar-${index}`}
                      dataKey="value"
                      fill={entry.color}
                      radius={[8, 8, 0, 0]}
                      data={[entry]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Priority Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Priority Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.priorityDistribution}
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
                    {chartData.priorityDistribution.map((entry, index) => (
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

          {/* Resolution Time & Monthly Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Resolution Time Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Resolution Time Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.resolutionTime}>
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

            {/* Monthly Comparison */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Monthly Comparison (Last 6 Months)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.monthlyComparison}>
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
                  <Legend />
                  <Bar
                    dataKey="total"
                    fill="#ef4444"
                    radius={[8, 8, 0, 0]}
                    name="Total"
                  />
                  <Bar
                    dataKey="resolved"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                    name="Resolved"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Insights Section */}
          <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-600/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-red-400"
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
              Complaint Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Complaint Trend</p>
                <p className="text-white font-semibold">
                  {stats.growthRate > 0
                    ? "📈 Increasing"
                    : stats.growthRate < 0
                    ? "📉 Decreasing"
                    : "➡️ Stable"}{" "}
                  ({Math.abs(stats.growthRate).toFixed(1)}%)
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Month-over-month change
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Resolution Health</p>
                <p className="text-white font-semibold">
                  {stats.resolutionRate >= 80
                    ? "✅ Excellent"
                    : stats.resolutionRate >= 60
                    ? "⚠️ Good"
                    : "❌ Needs Attention"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.resolutionRate.toFixed(1)}% resolution rate
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Response Time</p>
                <p className="text-white font-semibold">
                  {stats.avgResolutionTime < 3
                    ? "⚡ Fast"
                    : stats.avgResolutionTime < 7
                    ? "✅ Good"
                    : "⏰ Slow"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.avgResolutionTime.toFixed(1)} days average
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ComplaintAnalytics;
