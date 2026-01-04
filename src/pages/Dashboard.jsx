import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import { isAdmin, validateGymId } from "../utils/authUtils";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  const userIsAdmin = isAdmin(user);
  const gymValidation = validateGymId(user);
  const currentGymId = user?.gymId;

  useEffect(() => {
    if (userIsAdmin && currentGymId) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [userIsAdmin, currentGymId]);

  const fetchDashboardData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, getDocs, where, orderBy, limit } =
        await import("firebase/firestore");

      // Fetch members stats with gymId filter
      const membersRef = collection(db, "members");
      const membersQuery = query(
        membersRef,
        where("gymId", "==", currentGymId)
      );
      const membersSnapshot = await getDocs(membersQuery);
      const totalMembers = membersSnapshot.size;

      // Fetch active members with gymId filter
      const activeMembersQuery = query(
        membersRef,
        where("gymId", "==", currentGymId),
        where("status", "==", "active")
      );
      const activeMembersSnapshot = await getDocs(activeMembersQuery);
      const activeMembers = activeMembersSnapshot.size;

      // Fetch recent members with gymId filter
      const recentMembersQuery = query(
        membersRef,
        where("gymId", "==", currentGymId),
        orderBy("joinDate", "desc"),
        limit(5)
      );
      const recentMembersSnapshot = await getDocs(recentMembersQuery);
      const recentMembersData = recentMembersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch payments data with gymId filter
      const paymentsRef = collection(db, "payments");
      const paymentsQuery = query(
        paymentsRef,
        where("gymId", "==", currentGymId)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

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

      // Fetch recent payments with gymId filter
      const recentPaymentsQuery = query(
        paymentsRef,
        where("gymId", "==", currentGymId),
        orderBy("paidAt", "desc"),
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

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Show access denied if not admin
  if (!userIsAdmin) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-4">
            You don't have permission to view this page.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show error if gymId validation fails
  if (!gymValidation.isValid) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-yellow-600/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Configuration Error
          </h2>
          <p className="text-gray-400 mb-4">
            {gymValidation.error}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
            >
              Logout
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="h-screen w-screen bg-gray-900 flex overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1 text-gray-400 hover:text-white"
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
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">
                  {user?.role?.replace("_", " ")}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 sm:px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-medium transition active:scale-95"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Total Members */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm mb-1">Total Members</p>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {stats.totalMembers}
              </p>
            </div>

            {/* Active Members */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-green-600"
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
              <p className="text-gray-400 text-xs sm:text-sm mb-1">Active Members</p>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {stats.activeMembers}
              </p>
            </div>

            {/* Total Revenue */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600"
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
              <p className="text-gray-400 text-xs sm:text-sm mb-1">Total Revenue</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                Rs. {stats.totalRevenue.toLocaleString()}
              </p>
            </div>

            {/* Pending Payments */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600"
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
              <p className="text-gray-400 text-xs sm:text-sm mb-1">Pending Payments</p>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {stats.pendingPayments}
              </p>
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Recent Members */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-white">Recent Members</h2>
                <Link
                  to="/members"
                  className="text-sm text-blue-600 hover:text-blue-500 transition"
                >
                  View All
                </Link>
              </div>

              {recentMembers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No members yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 sm:p-4 bg-gray-900 rounded-lg gap-2"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-medium text-sm sm:text-base truncate">
                            {member.name}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-400 truncate">
                            Joined {formatDate(member.joinDate)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          member.status === "active"
                            ? "bg-green-600/20 text-green-600"
                            : "bg-gray-600/20 text-gray-400"
                        }`}
                      >
                        {member.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Payments */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Recent Payments
                </h2>
                <Link
                  to="/payments"
                  className="text-sm text-blue-600 hover:text-blue-500 transition"
                >
                  View All
                </Link>
              </div>

              {recentPayments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No payments yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 sm:p-4 bg-gray-900 rounded-lg gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-sm sm:text-base truncate">
                          {payment.memberName}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-400">
                          {formatDate(payment.paidAt)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white font-bold text-sm sm:text-base">
                          Rs. {payment.amount.toLocaleString()}
                        </p>
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            payment.status === "completed"
                              ? "bg-green-600/20 text-green-600"
                              : "bg-yellow-600/20 text-yellow-600"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
