import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import MemberLayout from "../../components/MemberLayout";

const MemberWorkoutTracker = () => {
  const { user: currentUser } = useAuth();

  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(null);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [completedSets, setCompletedSets] = useState([]);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
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
    fetchData();
    setRandomQuote();
  }, []);

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

      // Fetch exercises
      const exercisesSnapshot = await getDocs(collection(db, "exercises"));
      const exercisesData = exercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

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
      setExercises(exercisesData);
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
    setCurrentWorkout({ ...workout, day });
    setCompletedSets([]);
    setShowWorkoutModal(true);
    setRandomQuote();
  };

  const logSet = async (exerciseId, setIndex, reps, weight) => {
    const setKey = `${exerciseId}-${setIndex}`;
    setCompletedSets((prev) => [...prev, setKey]);

    const currentLog = {
      exerciseId,
      setIndex,
      reps: parseInt(reps) || 0,
      weight: parseFloat(weight) || 0,
      completedAt: new Date(),
    };

    return currentLog;
  };

  const completeWorkout = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      // Collect all logged sets
      const exerciseLogs = [];
      const formData = new FormData(document.getElementById("workout-form"));

      currentWorkout.exercises.forEach((exercise, exIndex) => {
        exercise.sets.forEach((set, setIndex) => {
          const reps = formData.get(`reps-${exIndex}-${setIndex}`) || set.reps;
          const weight = formData.get(`weight-${exIndex}-${setIndex}`) || 0;

          exerciseLogs.push({
            exerciseId: exercise.exerciseId,
            exerciseName: getExerciseName(exercise.exerciseId),
            plannedReps: set.reps,
            actualReps: parseInt(reps),
            weight: parseFloat(weight),
            rest: set.rest,
          });
        });
      });

      // Save workout log
      await addDoc(collection(db, "workoutLogs"), {
        memberId: currentUser.id,
        scheduleId: selectedSchedule.id,
        day: currentWorkout.day,
        exercises: exerciseLogs,
        completedAt: Timestamp.now(),
        duration: 0,
        notes: formData.get("workout-notes") || "",
      });

      // Show success animation
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
        setShowWorkoutModal(false);
        setCurrentWorkout(null);
        setCompletedSets([]);
        fetchData();
      }, 2000);
    } catch (error) {
      console.error("Error saving workout:", error);
      alert("Failed to save workout. Please try again.");
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

        {/* Workout Modal */}
        {showWorkoutModal && currentWorkout && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 sm:p-6 z-10">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-white capitalize truncate">
                      {currentWorkout.day}'s Workout
                    </h2>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">
                      Log your sets and reps
                    </p>
                  </div>
                  <button
                    onClick={() => setShowWorkoutModal(false)}
                    className="text-gray-400 hover:text-white transition flex-shrink-0"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <form
                id="workout-form"
                className="p-4 sm:p-6 space-y-4 sm:space-y-6"
              >
                {currentWorkout.exercises.map((exercise, exIndex) => (
                  <div
                    key={exIndex}
                    className="bg-gray-900 rounded-lg p-4 sm:p-5 border border-gray-700"
                  >
                    <h3 className="text-base sm:text-lg font-bold text-white mb-4 truncate">
                      {getExerciseName(exercise.exerciseId)}
                    </h3>

                    <div className="space-y-3">
                      {exercise.sets.map((set, setIndex) => {
                        const setKey = `${exercise.exerciseId}-${setIndex}`;
                        const isCompleted = completedSets.includes(setKey);

                        return (
                          <div
                            key={setIndex}
                            className={`bg-gray-800 rounded-lg p-3 sm:p-4 border-2 transition ${
                              isCompleted
                                ? "border-green-500"
                                : "border-gray-700"
                            }`}
                          >
                            <div className="flex items-center gap-2 sm:gap-4 mb-3 flex-wrap">
                              <span className="text-white font-medium text-sm sm:text-base">
                                Set {setIndex + 1}
                              </span>
                              <span className="text-gray-400 text-xs sm:text-sm">
                                Target: {set.reps} reps
                              </span>
                              {isCompleted && (
                                <span className="ml-auto text-green-500 flex items-center gap-1 text-sm">
                                  <svg
                                    className="w-4 h-4 sm:w-5 sm:h-5"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  Done
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div>
                                <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                                  Reps Completed
                                </label>
                                <input
                                  type="number"
                                  name={`reps-${exIndex}-${setIndex}`}
                                  defaultValue={set.reps}
                                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  min="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                                  Weight (kg)
                                </label>
                                <input
                                  type="number"
                                  name={`weight-${exIndex}-${setIndex}`}
                                  step="0.5"
                                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  min="0"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const reps = document.querySelector(
                                  `input[name="reps-${exIndex}-${setIndex}"]`
                                ).value;
                                const weight = document.querySelector(
                                  `input[name="weight-${exIndex}-${setIndex}"]`
                                ).value;
                                logSet(
                                  exercise.exerciseId,
                                  setIndex,
                                  reps,
                                  weight
                                );
                              }}
                              className={`mt-3 w-full py-2 rounded-lg font-medium transition text-sm sm:text-base active:scale-95 ${
                                isCompleted
                                  ? "bg-green-600 text-white"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                              }`}
                            >
                              {isCompleted ? "✓ Logged" : "Log Set"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Workout Notes */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    Workout Notes (Optional)
                  </label>
                  <textarea
                    name="workout-notes"
                    rows="3"
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="How did you feel? Any achievements?"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setShowWorkoutModal(false)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition text-sm sm:text-base active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={completeWorkout}
                    className="flex-1 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg font-medium transition text-sm sm:text-base active:scale-95"
                  >
                    Complete Workout 🎉
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Success Animation */}
        {showSuccessAnimation && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="text-center animate-bounce">
              <div className="text-6xl sm:text-8xl mb-4">🎉</div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2">
                Awesome Work!
              </h2>
              <p className="text-lg sm:text-xl text-gray-300">
                Workout completed successfully!
              </p>
            </div>
          </div>
        )}
      </div>
    </MemberLayout>
  );
};

export default MemberWorkoutTracker;
