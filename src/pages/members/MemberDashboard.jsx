import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import MemberLayout from "../../components/MemberLayout";

const MemberDashboard = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [memberData, setMemberData] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      fetchMemberData();
    }
  }, [currentUser]);

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

      // Fetch active schedules
      const schedulesQuery = query(
        collection(db, "schedules"),
        where("memberId", "==", currentUser.id),
        where("status", "==", "active")
      );
      const schedulesSnapshot = await getDocs(schedulesQuery);
      setSchedules(
        schedulesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      // Fetch recent workouts
      const workoutsQuery = query(
        collection(db, "workoutLogs"),
        where("memberId", "==", currentUser.id),
        orderBy("completedAt", "desc"),
        limit(5)
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      setRecentWorkouts(
        workoutsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      // Fetch recent weight logs
      const weightQuery = query(
        collection(db, "weightLogs"),
        where("memberId", "==", currentUser.id),
        orderBy("date", "desc"),
        limit(5)
      );
      const weightSnapshot = await getDocs(weightQuery);
      setWeightLogs(
        weightSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      setLoading(false);
    } catch (error) {
      console.error("Error fetching member data:", error);
      setLoading(false);
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

  const getMotivationalMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning! Ready to crush your goals? 🌅";
    if (hour < 18) return "Keep pushing! You're doing amazing! 💪";
    return "Evening warrior! Time to reflect on your progress! 🌙";
  };

  if (loading) {
    return (
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your dashboard...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  const member = memberData || currentUser;

  return (
    <MemberLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Welcome Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
            Welcome back, {member?.name?.split(" ")[0] || "Member"}! 💪
          </h1>
          <p className="text-sm sm:text-base text-gray-400">
            {getMotivationalMessage()}
          </p>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <button
            onClick={() => navigate("/member/workouts")}
            className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 sm:p-6 text-left hover:from-blue-700 hover:to-blue-800 transition group active:scale-95"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-white/60"
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
            <h3 className="text-white font-bold text-base sm:text-lg mb-1">
              Start Workout
            </h3>
            <p className="text-white/80 text-xs sm:text-sm">
              Log your today's exercises
            </p>
          </button>

          <button
            onClick={() => navigate("/member/progress")}
            className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-5 sm:p-6 text-left hover:from-purple-700 hover:to-purple-800 transition group active:scale-95"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
              </div>
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-white/60"
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
            <h3 className="text-white font-bold text-base sm:text-lg mb-1">
              View Progress
            </h3>
            <p className="text-white/80 text-xs sm:text-sm">
              Track your improvements
            </p>
          </button>

          <button
            onClick={() => navigate("/schedules")}
            className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 sm:p-6 text-left hover:from-green-700 hover:to-green-800 transition group active:scale-95"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-white/60"
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
            <h3 className="text-white font-bold text-base sm:text-lg mb-1">
              My Schedule
            </h3>
            <p className="text-white/80 text-xs sm:text-sm">
              View workout plan
            </p>
          </button>

          <button
            onClick={() => navigate("/exercises")}
            className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-5 sm:p-6 text-left hover:from-orange-700 hover:to-orange-800 transition group active:scale-95"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
              </div>
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-white/60"
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
            <h3 className="text-white font-bold text-base sm:text-lg mb-1">
              Exercises
            </h3>
            <p className="text-white/80 text-xs sm:text-sm">
              Browse exercise library
            </p>
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-gray-400 text-xs sm:text-sm">Status</p>
                <p className="text-white text-lg sm:text-xl font-semibold capitalize truncate">
                  {member?.status || "N/A"}
                </p>
              </div>
            </div>
            <div className="text-gray-300 text-xs sm:text-sm">
              Level:{" "}
              <span className="capitalize font-medium">
                {member?.level || "N/A"}
              </span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-gray-400 text-xs sm:text-sm">BMI</p>
                <p className="text-white text-lg sm:text-xl font-semibold truncate">
                  {member?.bmi || "N/A"}
                </p>
              </div>
            </div>
            <div className="text-gray-300 text-xs sm:text-sm truncate">
              Category:{" "}
              <span className="font-medium">
                {member?.bmiCategory || "N/A"}
              </span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
              <div className="min-w-0 flex-1">
                <p className="text-gray-400 text-xs sm:text-sm">Workouts</p>
                <p className="text-white text-lg sm:text-xl font-semibold">
                  {recentWorkouts.length}
                </p>
              </div>
            </div>
            <div className="text-gray-300 text-xs sm:text-sm">
              Last 5 sessions
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recent Workouts */}
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold text-white">
                Recent Workouts
              </h2>
              <button
                onClick={() => navigate("/member/workouts")}
                className="text-blue-500 hover:text-blue-400 text-xs sm:text-sm font-medium whitespace-nowrap"
              >
                View All →
              </button>
            </div>
            <div className="p-4 sm:p-6">
              {recentWorkouts.length > 0 ? (
                <div className="space-y-3">
                  {recentWorkouts.map((workout) => (
                    <div
                      key={workout.id}
                      className="bg-gray-900 rounded-lg p-3 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-medium capitalize text-sm sm:text-base truncate">
                            {workout.day}'s Workout
                          </p>
                          <p className="text-xs sm:text-sm text-gray-400">
                            {workout.exercises?.length || 0} exercises
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-gray-400 text-xs sm:text-sm">
                            {formatDate(workout.completedAt)}
                          </p>
                          <span className="text-green-500 text-xs flex items-center gap-1 justify-end mt-1">
                            <svg
                              className="w-3 h-3 sm:w-4 sm:h-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="hidden sm:inline">Completed</span>
                            <span className="sm:hidden">Done</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8">
                  <div className="text-4xl sm:text-5xl mb-3">🏋️</div>
                  <p className="text-gray-400 text-sm sm:text-base">
                    No workouts yet
                  </p>
                  <button
                    onClick={() => navigate("/member/workouts")}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition active:scale-95"
                  >
                    Start Your First Workout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Weight Progress */}
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold text-white">
                Weight Progress
              </h2>
              <button
                onClick={() => navigate("/member/progress")}
                className="text-blue-500 hover:text-blue-400 text-xs sm:text-sm font-medium whitespace-nowrap"
              >
                View All →
              </button>
            </div>
            <div className="p-4 sm:p-6">
              {weightLogs.length > 0 ? (
                <div className="space-y-3">
                  {weightLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-gray-900 rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-sm sm:text-base">
                          {log.weight} kg
                        </p>
                        {log.notes && (
                          <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">
                            {log.notes}
                          </p>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs sm:text-sm flex-shrink-0">
                        {formatDate(log.date)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8">
                  <div className="text-4xl sm:text-5xl mb-3">⚖️</div>
                  <p className="text-gray-400 text-sm sm:text-base">
                    No weight logs yet
                  </p>
                  <button
                    onClick={() => navigate("/member/progress")}
                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition active:scale-95"
                  >
                    Log Your Weight
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
};

export default MemberDashboard;
//madurangaparameegunasekara7598
//FN2yVKxi
