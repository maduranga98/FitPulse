import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import MemberLayout from "../../components/MemberLayout";

const MemberWorkoutTracker = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(null);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [motivationalQuote, setMotivationalQuote] = useState("");

  const motivationalQuotes = [
    "🔥 You're crushing it! Keep going!",
    "💪 Every rep brings you closer to your goal!",
    "⭐ You're stronger than you think!",
    "🎯 Focus on progress, not perfection!",
    "🏆 Champions are made in the gym!",
    "💯 One more rep, one step closer!",
    "⚡ Your only limit is you!",
    "🌟 Believe in yourself!",
  ];

  useEffect(() => {
    if (currentUser?.id) {
      fetchData();
    }
    setRandomQuote();
  }, [currentUser?.id]);

  const setRandomQuote = () => {
    const random =
      motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    setMotivationalQuote(random);
  };

  const fetchData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch member's schedules
      const schedulesQuery = query(
        collection(db, "schedules"),
        where("memberId", "==", currentUser.id),
        where("status", "==", "active"),
        orderBy("startDate", "desc")
      );
      const schedulesSnapshot = await getDocs(schedulesQuery);
      const schedulesData = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch gym-specific exercises
      const gymExercisesSnapshot = await getDocs(
        query(
          collection(db, "gym_exercises"),
          where("gymId", "==", currentUser.gymId)
        )
      );
      const gymExercisesData = gymExercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch common exercises
      const commonExercisesSnapshot = await getDocs(
        collection(db, "common_exercises")
      );
      const commonExercisesData = commonExercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Combine both exercise collections
      const allExercises = [...gymExercisesData, ...commonExercisesData];

      // Fetch workout logs
      const logsQuery = query(
        collection(db, "workoutLogs"),
        where("memberId", "==", currentUser.id),
        orderBy("completedAt", "desc")
      );
      const logsSnapshot = await getDocs(logsQuery);
      const logsData = logsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSchedules(schedulesData);
      setExercises(allExercises);
      setWorkoutLogs(logsData);

      if (schedulesData.length > 0) {
        setSelectedSchedule(schedulesData[0]);
        setActiveDay(getCurrentDay());
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const getCurrentDay = () => {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return days[new Date().getDay()];
  };

  const getExerciseName = (exerciseId) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    return exercise?.name || "Unknown Exercise";
  };

  const getTodayWorkout = () => {
    if (!selectedSchedule) return null;
    return selectedSchedule.workouts?.find((w) => w.day === activeDay);
  };

  const startWorkout = (workout, day) => {
    navigate("/member/workout-session", {
      state: {
        workout: workout,
        day: day,
        scheduleId: selectedSchedule.id,
      },
    });
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
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your workouts...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  const todayWorkout = getTodayWorkout();

  return (
    <MemberLayout>
      <div className="min-h-full bg-gray-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              My Workouts
            </h1>
            <p className="text-sm sm:text-base text-white/80">
              {motivationalQuote}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {schedules.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-6 sm:p-8 text-center border border-gray-700">
              <div className="text-5xl sm:text-6xl mb-4">🏋️</div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                No Active Schedule
              </h2>
              <p className="text-sm sm:text-base text-gray-400 mb-6">
                Contact your trainer to get a workout schedule assigned to you!
              </p>
            </div>
          ) : (
            <>
              {/* Day Selector */}
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
                  Select Workout Day
                </h2>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {[
                    "monday",
                    "tuesday",
                    "wednesday",
                    "thursday",
                    "friday",
                    "saturday",
                    "sunday",
                  ].map((day) => {
                    const hasWorkout = selectedSchedule?.workouts?.some(
                      (w) => w.day === day
                    );
                    const isToday = day === getCurrentDay();

                    return (
                      <button
                        key={day}
                        onClick={() => setActiveDay(day)}
                        disabled={!hasWorkout}
                        className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition active:scale-95 ${
                          activeDay === day
                            ? "bg-blue-600 text-white"
                            : hasWorkout
                            ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            : "bg-gray-900 text-gray-600 cursor-not-allowed"
                        } ${isToday ? "ring-2 ring-blue-400" : ""}`}
                      >
                        <div className="capitalize hidden sm:block">
                          {day.slice(0, 3)}
                        </div>
                        <div className="capitalize sm:hidden">
                          {day.charAt(0)}
                        </div>
                        {isToday && (
                          <div className="text-xs mt-1 hidden sm:block">
                            Today
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Today's Workout */}
              {todayWorkout ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-white capitalize">
                      {activeDay}'s Workout
                    </h2>
                    <button
                      onClick={() => startWorkout(todayWorkout, activeDay)}
                      className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 active:scale-95"
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
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="hidden sm:inline">Start Workout</span>
                      <span className="sm:hidden">Start</span>
                    </button>
                  </div>

                  {/* Exercise Cards */}
                  {todayWorkout.exercises.map((exercise, index) => (
                    <div
                      key={index}
                      className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-1 truncate">
                            {getExerciseName(exercise.exerciseId)}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-400">
                            {exercise.sets.length} sets
                          </p>
                        </div>
                        <span className="text-2xl sm:text-3xl flex-shrink-0 ml-2">
                          💪
                        </span>
                      </div>

                      <div className="space-y-2">
                        {exercise.sets.map((set, setIndex) => (
                          <div
                            key={setIndex}
                            className="flex items-center justify-between bg-gray-900 rounded-lg p-3 sm:p-4 gap-2"
                          >
                            <span className="text-gray-400 font-medium text-sm sm:text-base whitespace-nowrap">
                              Set {setIndex + 1}
                            </span>
                            <div className="flex items-center gap-2 sm:gap-4 text-sm sm:text-base">
                              <span className="text-white">
                                {set.reps} reps
                              </span>
                              <span className="text-gray-500 hidden sm:inline">
                                •
                              </span>
                              <span className="text-gray-400 hidden sm:inline">
                                {set.rest} rest
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-800 rounded-xl p-6 sm:p-8 text-center border border-gray-700">
                  <div className="text-4xl sm:text-5xl mb-4">😴</div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                    Rest Day
                  </h3>
                  <p className="text-sm sm:text-base text-gray-400">
                    No workout scheduled for {activeDay}. Take this time to
                    recover!
                  </p>
                </div>
              )}

              {/* Recent Workouts */}
              <div className="mt-6 sm:mt-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
                  Recent Workouts
                </h2>
                <div className="space-y-3">
                  {workoutLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium capitalize text-sm sm:text-base truncate">
                            {log.day}'s Workout
                          </p>
                          <p className="text-xs sm:text-sm text-gray-400">
                            {log.exercises?.length || 0} exercises completed
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-gray-400 text-xs sm:text-sm">
                            {formatDate(log.completedAt)}
                          </p>
                          <span className="text-green-500 text-xs sm:text-sm flex items-center gap-1 justify-end mt-1">
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

                  {workoutLogs.length === 0 && (
                    <div className="text-center py-6 sm:py-8">
                      <p className="text-gray-400 text-sm sm:text-base">
                        No workout history yet. Start your first workout!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </MemberLayout>
  );
};

export default MemberWorkoutTracker;
