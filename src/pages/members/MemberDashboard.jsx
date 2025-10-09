import { useState, useEffect } from "react";

const MemberDashboard = ({ onLogout, onNavigate, currentUser }) => {
  const [memberData, setMemberData] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchMemberData();
  }, []);

  const fetchMemberData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { doc, getDoc, collection, query, where, getDocs, orderBy, limit } =
        await import("firebase/firestore");

      // Fetch member's full data
      const memberRef = doc(db, "members", currentUser.id);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        setMemberData({ id: memberSnap.id, ...memberSnap.data() });
      }

      // Fetch member's workouts/attendance (if you have this collection)
      // const workoutsRef = collection(db, "workouts");
      // const workoutsQuery = query(workoutsRef, where("memberId", "==", currentUser.id), orderBy("date", "desc"), limit(10));
      // const workoutsSnapshot = await getDocs(workoutsQuery);
      // setWorkouts(workoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch member's payment history
      const paymentsRef = collection(db, "payments");
      const paymentsQuery = query(
        paymentsRef,
        where("memberId", "==", currentUser.id),
        orderBy("date", "desc"),
        limit(5)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      setPayments(
        paymentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      setLoading(false);
    } catch (error) {
      console.error("Error fetching member data:", error);
      setLoading(false);
    }
  };

  const handleLogoutClick = () => {
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
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const member = memberData || currentUser;

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg transition ${
                activeTab === "overview"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
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
              <span className="font-medium">My Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg transition ${
                activeTab === "profile"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="font-medium">My Profile</span>
            </button>

            <button
              onClick={() => setActiveTab("progress")}
              className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg transition ${
                activeTab === "progress"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <span className="font-medium">My Progress</span>
            </button>

            <button
              onClick={() => setActiveTab("workouts")}
              className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg transition ${
                activeTab === "workouts"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">My Workouts</span>
            </button>

            <button
              onClick={() => setActiveTab("payments")}
              className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg transition ${
                activeTab === "payments"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
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
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <span className="font-medium">Payment History</span>
            </button>

            <button
              onClick={() => onNavigate("exercises")}
              className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="font-medium">Exercise Library</span>
            </button>
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <div className="mb-3 px-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {member.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm text-white font-medium">
                    {member.name}
                  </div>
                  <div className="text-xs text-gray-400">Member</div>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogoutClick}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
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
                {activeTab === "overview" && "My Dashboard"}
                {activeTab === "profile" && "My Profile"}
                {activeTab === "progress" && "My Progress"}
                {activeTab === "workouts" && "My Workouts"}
                {activeTab === "payments" && "Payment History"}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  member.status === "active"
                    ? "bg-green-600/20 text-green-600"
                    : "bg-red-600/20 text-red-600"
                }`}
              >
                {member.status}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Welcome back, {member.name}! 💪
                </h2>
                <p className="text-blue-100">
                  Keep up the great work! Your fitness journey continues here.
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">
                    Fitness Level
                  </div>
                  <div className="text-2xl font-bold text-white capitalize">
                    {member.level}
                  </div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">BMI</div>
                  <div className="text-2xl font-bold text-white">
                    {member.bmi || "N/A"}
                  </div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">Weight</div>
                  <div className="text-2xl font-bold text-white">
                    {member.weight} kg
                  </div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">Member Since</div>
                  <div className="text-lg font-bold text-white">
                    {formatDate(member.joinDate)}
                  </div>
                </div>
              </div>

              {/* Health Alerts */}
              {(member.allergies || member.diseases) && (
                <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-yellow-600 mb-3 flex items-center gap-2">
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
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    Health Information
                  </h3>
                  <div className="space-y-2">
                    {member.allergies && (
                      <div>
                        <span className="text-yellow-600 font-medium text-sm">
                          Allergies:{" "}
                        </span>
                        <span className="text-yellow-600 text-sm">
                          {member.allergies}
                        </span>
                      </div>
                    )}
                    {member.diseases && (
                      <div>
                        <span className="text-yellow-600 font-medium text-sm">
                          Medical Conditions:{" "}
                        </span>
                        <span className="text-yellow-600 text-sm">
                          {member.diseases}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Payments */}
              {payments.length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Recent Payments
                  </h3>
                  <div className="space-y-3">
                    {payments.slice(0, 3).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0"
                      >
                        <div>
                          <div className="text-white font-medium">
                            ${payment.amount}
                          </div>
                          <div className="text-sm text-gray-400">
                            {formatDate(payment.date)}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            payment.status === "completed"
                              ? "bg-green-600/20 text-green-600"
                              : "bg-yellow-600/20 text-yellow-600"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="max-w-4xl space-y-6">
              {/* Personal Information */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Full Name</div>
                    <div className="text-white font-medium">{member.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Age</div>
                    <div className="text-white font-medium">
                      {member.age} years
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Mobile</div>
                    <div className="text-white font-medium">
                      {member.mobile}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">WhatsApp</div>
                    <div className="text-white font-medium">
                      {member.whatsapp}
                    </div>
                  </div>
                  {member.email && (
                    <div className="md:col-span-2">
                      <div className="text-sm text-gray-400 mb-1">Email</div>
                      <div className="text-white font-medium">
                        {member.email}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Physical Stats */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Physical Stats
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Weight</div>
                    <div className="text-xl font-bold text-white">
                      {member.weight} kg
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Height</div>
                    <div className="text-xl font-bold text-white">
                      {member.height} cm
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">BMI</div>
                    <div className="text-xl font-bold text-white">
                      {member.bmi || "N/A"}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Category</div>
                    <div className="text-sm font-bold text-white">
                      {member.bmiCategory || "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              {(member.emergencyName || member.emergencyContact) && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {member.emergencyName && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">
                          Contact Name
                        </div>
                        <div className="text-white font-medium">
                          {member.emergencyName}
                        </div>
                      </div>
                    )}
                    {member.emergencyContact && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">
                          Contact Number
                        </div>
                        <div className="text-white font-medium">
                          {member.emergencyContact}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress Tab */}
          {activeTab === "progress" && (
            <div className="max-w-4xl">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <h3 className="text-xl font-bold text-white mb-2">
                  Progress Tracking Coming Soon!
                </h3>
                <p className="text-gray-400">
                  We're working on adding detailed progress tracking features.
                </p>
              </div>
            </div>
          )}

          {/* Workouts Tab */}
          {activeTab === "workouts" && (
            <div className="max-w-4xl">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
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
                <h3 className="text-xl font-bold text-white mb-2">
                  Workout Schedule Coming Soon!
                </h3>
                <p className="text-gray-400 mb-4">
                  Your personalized workout schedule will appear here.
                </p>
                <button
                  onClick={() => onNavigate("exercises")}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Browse Exercise Library
                </button>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div className="max-w-4xl">
              <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                {payments.length === 0 ? (
                  <div className="p-6 text-center">
                    <svg
                      className="w-16 h-16 text-gray-600 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                    <h3 className="text-xl font-bold text-white mb-2">
                      No Payment History
                    </h3>
                    <p className="text-gray-400">
                      Your payment history will appear here once you make your
                      first payment.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-6 py-4 text-sm text-white">
                              {formatDate(payment.date)}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-white">
                              ${payment.amount}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  payment.status === "completed"
                                    ? "bg-green-600/20 text-green-600"
                                    : payment.status === "pending"
                                    ? "bg-yellow-600/20 text-yellow-600"
                                    : "bg-red-600/20 text-red-600"
                                }`}
                              >
                                {payment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400">
                              {payment.notes || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MemberDashboard;
