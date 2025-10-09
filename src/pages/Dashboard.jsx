import { useState, useEffect } from "react";

const Dashboard = ({ onLogout }) => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  });
  const [recentMembers, setRecentMembers] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, getDocs, where, orderBy, limit } =
        await import("firebase/firestore");

      // Fetch members stats
      const membersRef = collection(db, "members");
      const membersSnapshot = await getDocs(membersRef);
      const totalMembers = membersSnapshot.size;

      const activeMembersQuery = query(
        membersRef,
        where("status", "==", "active")
      );
      const activeMembersSnapshot = await getDocs(activeMembersQuery);
      const activeMembers = activeMembersSnapshot.size;

      // Fetch recent members
      const recentMembersQuery = query(
        membersRef,
        orderBy("joinDate", "desc"),
        limit(5)
      );
      const recentMembersSnapshot = await getDocs(recentMembersQuery);
      const recentMembersData = recentMembersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch payments data
      const paymentsRef = collection(db, "payments");
      const paymentsSnapshot = await getDocs(paymentsRef);

      let totalRevenue = 0;
      let pendingPayments = 0;

      paymentsSnapshot.forEach((doc) => {
        const payment = doc.data();
        if (payment.status === "completed") {
          totalRevenue += payment.amount || 0;
        } else if (payment.status === "pending") {
          pendingPayments++;
        }
      });

      // Fetch recent payments
      const recentPaymentsQuery = query(
        paymentsRef,
        orderBy("date", "desc"),
        limit(5)
      );
      const recentPaymentsSnapshot = await getDocs(recentPaymentsQuery);
      const recentPaymentsData = recentPaymentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setStats({
        totalMembers,
        activeMembers,
        totalRevenue,
        pendingPayments,
      });
      setRecentMembers(recentMembersData);
      setRecentPayments(recentPaymentsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("gymUser");
      window.location.reload();
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 left-0 z-50 h-full w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-300 lg:translate-x-0 flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 p-6 border-b border-gray-700 flex-shrink-0">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Gym Manager</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="font-medium">Dashboard</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
            >
              <svg
                className="w-5 h-5"
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
              <span className="font-medium">Members</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="font-medium">Payments</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 6 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <span className="font-medium">Exercises</span>
            </a>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
        <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
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
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400 hidden sm:inline">
                Welcome back, Admin
              </span>
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">A</span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            {/* Total Members */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-blue-600"
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
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">
                Total Members
              </h3>
              <p className="text-3xl font-bold text-white">
                {stats.totalMembers}
              </p>
            </div>

            {/* Active Members */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">
                Active Members
              </h3>
              <p className="text-3xl font-bold text-white">
                {stats.activeMembers}
              </p>
            </div>

            {/* Total Revenue */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">
                Total Revenue
              </h3>
              <p className="text-3xl font-bold text-white">
                ${stats.totalRevenue.toLocaleString()}
              </p>
            </div>

            {/* Pending Payments */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">
                Pending Payments
              </h3>
              <p className="text-3xl font-bold text-white">
                {stats.pendingPayments}
              </p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Members */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Recent Members</h2>
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  View All
                </a>
              </div>
              <div className="space-y-4">
                {recentMembers.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    No members yet
                  </p>
                ) : (
                  recentMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 p-3 bg-gray-900 rounded-lg"
                    >
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {member.firstName?.[0]}
                          {member.lastName?.[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-gray-400 text-sm">
                          Joined {formatDate(member.joinDate)}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          member.status === "active"
                            ? "bg-green-600/20 text-green-600"
                            : "bg-gray-600/20 text-gray-400"
                        }`}
                      >
                        {member.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Payments */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  Recent Payments
                </h2>
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  View All
                </a>
              </div>
              <div className="space-y-4">
                {recentPayments.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    No payments yet
                  </p>
                ) : (
                  recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-purple-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            ${payment.amount}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {formatDate(payment.date)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          payment.status === "completed"
                            ? "bg-green-600/20 text-green-600"
                            : "bg-orange-600/20 text-orange-600"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
