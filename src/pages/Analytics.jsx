import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";

const Analytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAnalytic, setSelectedAnalytic] = useState(null);

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "gym_admin" ||
    user?.role === "gym_manager";

  const handleAnalyticClick = (analyticId) => {
    const routes = {
      "member-analytics": "/analytics/members",
      "financial-analytics": "/analytics/financial",
      "schedule-analytics": "/analytics/schedules",
      "complaint-analytics": "/analytics/complaints",
      "operational-analytics": "/analytics/operational",
      "exercise-analytics": "/analytics/exercises",
    };

    if (routes[analyticId]) {
      navigate(routes[analyticId]);
    } else {
      setSelectedAnalytic(analyticId);
    }
  };

  const analyticsCategories = [
    {
      id: "member-analytics",
      title: "Member Analytics",
      description: "Track member growth, retention, and engagement metrics",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      ),
      color: "blue",
      metrics: [
        "Total Members",
        "Active vs Inactive",
        "New Registrations",
        "Member Retention Rate",
        "Growth Trends",
      ],
    },
    {
      id: "financial-analytics",
      title: "Financial Analytics",
      description: "Monitor revenue, payments, and financial performance",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      ),
      color: "green",
      metrics: [
        "Total Revenue",
        "Payment Collection Rate",
        "Outstanding Payments",
        "Revenue Trends",
        "Payment Methods",
      ],
    },
    {
      id: "schedule-analytics",
      title: "Schedule & Workout Analytics",
      description: "Analyze workout schedules and exercise popularity",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      ),
      color: "purple",
      metrics: [
        "Active Schedules",
        "Members with Schedules",
        "Popular Exercises",
        "Day-wise Distribution",
        "Schedule Completion",
      ],
    },
    {
      id: "complaint-analytics",
      title: "Complaint Analytics",
      description: "Track and analyze member complaints and resolutions",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
        />
      ),
      color: "red",
      metrics: [
        "Total Complaints",
        "Status Breakdown",
        "Category Analysis",
        "Resolution Time",
        "Complaint Trends",
      ],
    },
    {
      id: "operational-analytics",
      title: "Operational Analytics",
      description: "Overall gym operations and engagement insights",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      ),
      color: "yellow",
      metrics: [
        "Member Engagement Score",
        "This Month Overview",
        "Quick Stats",
        "Performance Indicators",
        "Comparative Analysis",
      ],
    },
    {
      id: "exercise-analytics",
      title: "Exercise Analytics",
      description: "Track exercise usage and popularity metrics",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      ),
      color: "orange",
      metrics: [
        "Total Exercises",
        "Most Used Exercises",
        "Category Distribution",
        "Exercise Trends",
        "Usage Statistics",
      ],
    },
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: {
        bg: "bg-blue-600/10",
        border: "border-blue-600/30",
        hover: "hover:border-blue-600/60",
        icon: "bg-blue-600/20",
        iconText: "text-blue-600",
        badge: "bg-blue-600/20 text-blue-600",
      },
      green: {
        bg: "bg-green-600/10",
        border: "border-green-600/30",
        hover: "hover:border-green-600/60",
        icon: "bg-green-600/20",
        iconText: "text-green-600",
        badge: "bg-green-600/20 text-green-600",
      },
      purple: {
        bg: "bg-purple-600/10",
        border: "border-purple-600/30",
        hover: "hover:border-purple-600/60",
        icon: "bg-purple-600/20",
        iconText: "text-purple-600",
        badge: "bg-purple-600/20 text-purple-600",
      },
      red: {
        bg: "bg-red-600/10",
        border: "border-red-600/30",
        hover: "hover:border-red-600/60",
        icon: "bg-red-600/20",
        iconText: "text-red-600",
        badge: "bg-red-600/20 text-red-600",
      },
      yellow: {
        bg: "bg-yellow-600/10",
        border: "border-yellow-600/30",
        hover: "hover:border-yellow-600/60",
        icon: "bg-yellow-600/20",
        iconText: "text-yellow-600",
        badge: "bg-yellow-600/20 text-yellow-600",
      },
      orange: {
        bg: "bg-orange-600/10",
        border: "border-orange-600/30",
        hover: "hover:border-orange-600/60",
        icon: "bg-orange-600/20",
        iconText: "text-orange-600",
        badge: "bg-orange-600/20 text-orange-600",
      },
    };
    return colors[color] || colors.blue;
  };

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

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
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
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Analytics Dashboard
                </h1>
                <p className="text-gray-400 text-sm hidden sm:block">
                  Comprehensive insights and performance metrics
                </p>
              </div>
            </div>

            {/* User Info */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.name?.charAt(0) || "A"}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">
                  {user?.role?.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Page Info */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-600/30 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">
                  Welcome to Analytics Dashboard
                </h3>
                <p className="text-gray-300 text-sm">
                  Select any analytics category below to view detailed insights
                  and metrics for your gym. Each section provides comprehensive
                  data visualization and performance tracking.
                </p>
              </div>
            </div>
          </div>

          {/* Analytics Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analyticsCategories.map((category) => {
              const colorClasses = getColorClasses(category.color);
              return (
                <button
                  key={category.id}
                  onClick={() => handleAnalyticClick(category.id)}
                  className={`${colorClasses.bg} border ${colorClasses.border} ${colorClasses.hover} rounded-xl p-6 text-left transition-all duration-300 transform hover:scale-105 hover:shadow-2xl group`}
                >
                  {/* Icon */}
                  <div
                    className={`w-14 h-14 ${colorClasses.icon} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <svg
                      className={`w-7 h-7 ${colorClasses.iconText}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {category.icon}
                    </svg>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-opacity-90">
                    {category.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                    {category.description}
                  </p>

                  {/* Metrics List */}
                  <div className="space-y-2">
                    {category.metrics.slice(0, 3).map((metric, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-xs text-gray-300"
                      >
                        <div
                          className={`w-1.5 h-1.5 ${colorClasses.icon} rounded-full`}
                        ></div>
                        <span>{metric}</span>
                      </div>
                    ))}
                    {category.metrics.length > 3 && (
                      <p
                        className={`text-xs ${colorClasses.iconText} font-medium`}
                      >
                        +{category.metrics.length - 3} more metrics
                      </p>
                    )}
                  </div>

                  {/* View Button */}
                  <div className="mt-6 pt-4 border-t border-gray-700/50">
                    <div
                      className={`flex items-center justify-between ${colorClasses.iconText} text-sm font-medium`}
                    >
                      <span>View Analytics</span>
                      <svg
                        className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Coming Soon Notice */}
          {selectedAnalytic && (
            <div className="mt-8 p-6 bg-gray-800 border border-gray-700 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">
                      Analytics Selected
                    </h4>
                    <p className="text-gray-400 text-sm">
                      Detailed {selectedAnalytic.replace("-", " ")} will be
                      implemented soon
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAnalytic(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="mt-8 p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <p>
                All analytics data is calculated in real-time from your gym's
                database. Data is updated automatically.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Analytics;
