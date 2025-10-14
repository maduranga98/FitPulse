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

const FinancialAnalytics = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeRange, setTimeRange] = useState("30");
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    thisMonthRevenue: 0,
    lastMonthRevenue: 0,
    avgRevenuePerMember: 0,
    totalPaidMembers: 0,
    totalUnpaidMembers: 0,
    collectionRate: 0,
    outstandingAmount: 0,
    growthRate: 0,
    totalTransactions: 0,
  });
  const [chartData, setChartData] = useState({
    monthlyRevenue: [],
    paymentMethods: [],
    revenueVsTarget: [],
    dailyRevenue: [],
    memberPaymentStatus: [],
  });

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "gym_admin" ||
    user?.role === "gym_manager";

  useEffect(() => {
    if (isAdmin && currentGymId) {
      fetchFinancialData();
    }
  }, [isAdmin, currentGymId, timeRange]);

  const fetchFinancialData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch all payments for this gym
      const paymentsQuery = query(
        collection(db, "payments"),
        where("gymId", "==", currentGymId),
        orderBy("paidAt", "desc")
      );

      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch all members for this gym
      const membersQuery = query(
        collection(db, "members"),
        where("gymId", "==", currentGymId)
      );

      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setPayments(paymentsData);
      setMembers(membersData);
      calculateStats(paymentsData, membersData);
      generateChartData(paymentsData, membersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching financial data:", error);
      setLoading(false);
    }
  };

  const calculateStats = (paymentsData, membersData) => {
    // Calculate total revenue
    const totalRevenue = paymentsData.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );

    // Calculate this month and last month revenue
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    const thisMonthRevenue = paymentsData
      .filter((p) => {
        const paidDate = p.paidAt?.toDate
          ? p.paidAt.toDate()
          : new Date(p.paidAt);
        return paidDate >= firstDayThisMonth;
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const lastMonthRevenue = paymentsData
      .filter((p) => {
        const paidDate = p.paidAt?.toDate
          ? p.paidAt.toDate()
          : new Date(p.paidAt);
        return paidDate >= firstDayLastMonth && paidDate < firstDayThisMonth;
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Calculate average revenue per member
    const avgRevenuePerMember =
      membersData.length > 0 ? totalRevenue / membersData.length : 0;

    // Calculate paid vs unpaid members for current month
    const currentMonth = now.toISOString().slice(0, 7);
    const paidMemberIds = new Set(
      paymentsData
        .filter((p) => p.month === currentMonth)
        .map((p) => p.memberId)
    );

    const activeMembers = membersData.filter((m) => m.status === "active");
    const totalPaidMembers = activeMembers.filter((m) =>
      paidMemberIds.has(m.id)
    ).length;
    const totalUnpaidMembers = activeMembers.length - totalPaidMembers;

    // Calculate collection rate
    const collectionRate =
      activeMembers.length > 0
        ? (totalPaidMembers / activeMembers.length) * 100
        : 0;

    // Calculate outstanding amount (assuming avg membership fee)
    const avgMembershipFee =
      membersData.length > 0
        ? membersData.reduce(
            (sum, m) => sum + (parseFloat(m.membershipFee) || 0),
            0
          ) / membersData.length
        : 0;
    const outstandingAmount = totalUnpaidMembers * avgMembershipFee;

    // Calculate growth rate
    const growthRate =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : thisMonthRevenue > 0
        ? 100
        : 0;

    setStats({
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      avgRevenuePerMember,
      totalPaidMembers,
      totalUnpaidMembers,
      collectionRate,
      outstandingAmount,
      growthRate,
      totalTransactions: paymentsData.length,
    });
  };

  const generateChartData = (paymentsData, membersData) => {
    // Monthly revenue for last 6 months
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
        revenue: 0,
        transactions: 0,
        target: 100000, // You can make this dynamic
      };
    }

    // Calculate revenue per month
    paymentsData.forEach((payment) => {
      const paidDate = payment.paidAt?.toDate
        ? payment.paidAt.toDate()
        : new Date(payment.paidAt);

      const monthKey = paidDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      if (monthlyData[monthKey]) {
        monthlyData[monthKey].revenue += payment.amount || 0;
        monthlyData[monthKey].transactions += 1;
      }
    });

    const monthlyRevenue = Object.values(monthlyData);

    // Payment methods distribution
    const paymentMethodCounts = paymentsData.reduce((acc, payment) => {
      const method = payment.paymentMethod || "Other";
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});

    const paymentMethods = Object.entries(paymentMethodCounts).map(
      ([method, count]) => ({
        name: method,
        value: count,
        color: getPaymentMethodColor(method),
      })
    );

    // Daily revenue for last 30 days
    const dailyData = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      dailyData[dateKey] = { date: dateKey, revenue: 0 };
    }

    paymentsData.forEach((payment) => {
      const paidDate = payment.paidAt?.toDate
        ? payment.paidAt.toDate()
        : new Date(payment.paidAt);

      const dateKey = paidDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      if (dailyData[dateKey]) {
        dailyData[dateKey].revenue += payment.amount || 0;
      }
    });

    const dailyRevenue = Object.values(dailyData);

    // Member payment status
    const currentMonth = now.toISOString().slice(0, 7);
    const paidMemberIds = new Set(
      paymentsData
        .filter((p) => p.month === currentMonth)
        .map((p) => p.memberId)
    );

    const activeMembers = membersData.filter((m) => m.status === "active");
    const memberPaymentStatus = [
      {
        name: "Paid",
        value: activeMembers.filter((m) => paidMemberIds.has(m.id)).length,
        color: "#10b981",
      },
      {
        name: "Unpaid",
        value: activeMembers.filter((m) => !paidMemberIds.has(m.id)).length,
        color: "#ef4444",
      },
    ];

    setChartData({
      monthlyRevenue,
      paymentMethods,
      revenueVsTarget: monthlyRevenue,
      dailyRevenue,
      memberPaymentStatus,
    });
  };

  const getPaymentMethodColor = (method) => {
    const colors = {
      Cash: "#10b981",
      Card: "#3b82f6",
      "Bank Transfer": "#8b5cf6",
      Online: "#f59e0b",
      Other: "#6b7280",
    };
    return colors[method] || "#6b7280";
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
              trend > 0
                ? "text-green-600"
                : trend < 0
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading financial analytics...</p>
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
                    Financial Analytics
                  </h1>
                </div>
                <p className="text-gray-400 text-sm hidden sm:block">
                  Monitor revenue, payments, and financial performance
                </p>
              </div>
            </div>

            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-600"
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
              title="Total Revenue"
              value={formatCurrency(stats.totalRevenue)}
              subtitle={`${stats.totalTransactions} transactions`}
              color="bg-green-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              }
            />

            <StatCard
              title="This Month Revenue"
              value={formatCurrency(stats.thisMonthRevenue)}
              subtitle={`Last month: ${formatCurrency(stats.lastMonthRevenue)}`}
              trend={parseFloat(stats.growthRate)}
              color="bg-blue-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              }
            />

            <StatCard
              title="Collection Rate"
              value={`${stats.collectionRate.toFixed(1)}%`}
              subtitle={`${stats.totalPaidMembers} paid, ${stats.totalUnpaidMembers} unpaid`}
              color="bg-purple-600"
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
              title="Outstanding Amount"
              value={formatCurrency(stats.outstandingAmount)}
              subtitle={`From ${stats.totalUnpaidMembers} members`}
              color="bg-red-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              }
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Monthly Revenue Trend */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Monthly Revenue Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.monthlyRevenue}>
                  <defs>
                    <linearGradient
                      id="colorRevenue"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue vs Target */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Revenue vs Target
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.revenueVsTarget}>
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
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar
                    dataKey="revenue"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                    name="Actual"
                  />
                  <Bar
                    dataKey="target"
                    fill="#6b7280"
                    radius={[8, 8, 0, 0]}
                    name="Target"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Payment Methods Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Payment Methods Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.paymentMethods}
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
                    {chartData.paymentMethods.map((entry, index) => (
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

            {/* Member Payment Status */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Current Month Payment Status
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.memberPaymentStatus}
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
                    {chartData.memberPaymentStatus.map((entry, index) => (
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

          {/* Daily Revenue Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold text-white mb-4">
              Daily Revenue (Last 30 Days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.dailyRevenue}>
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
                  formatter={(value) => formatCurrency(value)}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Financial Insights Section */}
          <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-600/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-green-400"
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
              Financial Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Revenue Growth</p>
                <p className="text-white font-semibold">
                  {stats.growthRate > 0
                    ? "📈 Growing"
                    : stats.growthRate < 0
                    ? "📉 Declining"
                    : "➡️ Stable"}{" "}
                  ({stats.growthRate.toFixed(1)}%)
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Month-over-month comparison
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Collection Health</p>
                <p className="text-white font-semibold">
                  {stats.collectionRate >= 80
                    ? "✅ Excellent"
                    : stats.collectionRate >= 60
                    ? "⚠️ Good"
                    : "❌ Needs Attention"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.collectionRate.toFixed(1)}% collection rate
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Avg Revenue/Member</p>
                <p className="text-white font-semibold">
                  {formatCurrency(stats.avgRevenuePerMember)}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Total revenue per member
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default FinancialAnalytics;
