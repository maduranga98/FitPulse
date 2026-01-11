import { useState, useEffect } from "react";
import MemberLayout from "../../components/MemberLayout";
import { useAuth } from "../../hooks/useAuth";
import ExerciseDetailModal from "../../components/ExerciseDetailModal";

const MemberSchedules = () => {
  const { user: currentUser } = useAuth();

  const [schedules, setSchedules] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewSchedule, setViewSchedule] = useState(null);
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);

  const daysOfWeek = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (schedules.length > 0) {
      const active = schedules.find((s) => s.status === "active");
      setActiveSchedule(active || schedules[0]);
    }
  }, [schedules]);

  const fetchData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import(
        "firebase/firestore"
      );

      const schedulesQuery = query(
        collection(db, "schedules"),
        where("memberId", "==", currentUser.id),
        orderBy("startDate", "desc")
      );

      const schedulesSnapshot = await getDocs(schedulesQuery);
      const schedulesData = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch common exercises
      const commonExercisesSnapshot = await getDocs(collection(db, "common_exercises"));
      const commonExercisesData = commonExercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch gym-specific exercises
      const gymExercisesSnapshot = await getDocs(
        query(collection(db, "gym_exercises"), where("gymId", "==", currentUser.gymId))
      );
      const gymExercisesData = gymExercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Combine all exercises
      const exercisesData = [...commonExercisesData, ...gymExercisesData];

      setSchedules(schedulesData);
      setExercises(exercisesData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const getExerciseData = (exerciseId) => {
    return exercises.find((e) => e.id === exerciseId);
  };

  const getExerciseName = (exerciseId) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    return exercise ? exercise.name : "Unknown Exercise";
  };

  const handleExerciseClick = (exerciseId) => {
    const exercise = getExerciseData(exerciseId);
    if (exercise) {
      setSelectedExercise(exercise);
      setShowExerciseDetail(true);
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

  const getTodayDay = () => {
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

  const getTodayWorkout = (schedule) => {
    const today = getTodayDay();
    return schedule?.workouts?.find((w) => w.day === today);
  };

  if (loading) {
    return (
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your schedules...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout>
      <div className="min-h-full bg-gray-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              My Workout Plans
            </h1>
            <p className="text-sm sm:text-base text-white/80">
              View and track your assigned workout schedules
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {schedules.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-6 sm:p-8 text-center border border-gray-700">
              <div className="text-5xl sm:text-6xl mb-4">📋</div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                No Workout Plans Yet
              </h2>
              <p className="text-sm sm:text-base text-gray-400">
                Your trainer hasn't assigned any workout plans to you yet. Check
                back soon or contact your gym manager.
              </p>
            </div>
          ) : (
            <>
              {/* Today's Workout Quick View */}
              {activeSchedule && getTodayWorkout(activeSchedule) && (
                <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">💪</span>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      Today's Workout
                    </h2>
                  </div>
                  <p className="text-white/90 mb-4 text-sm sm:text-base">
                    {activeSchedule.title} - {getTodayDay().toUpperCase()}
                  </p>
                  <button
                    onClick={() => {
                      setViewSchedule(activeSchedule);
                      setSelectedDay(getTodayDay());
                    }}
                    className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-white text-green-600 rounded-lg font-semibold hover:bg-green-50 transition active:scale-95"
                  >
                    View Today's Workout
                  </button>
                </div>
              )}

              {/* Schedule Tabs */}
              {schedules.length > 1 && (
                <div className="mb-4 sm:mb-6">
                  <div className="bg-gray-800 rounded-xl p-1 border border-gray-700 overflow-x-auto">
                    <div className="flex gap-1 min-w-max">
                      {schedules.map((schedule) => (
                        <button
                          key={schedule.id}
                          onClick={() => setActiveSchedule(schedule)}
                          className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition whitespace-nowrap text-sm sm:text-base active:scale-95 ${
                            activeSchedule?.id === schedule.id
                              ? "bg-blue-600 text-white"
                              : "text-gray-400 hover:text-white hover:bg-gray-700"
                          }`}
                        >
                          {schedule.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Active Schedule Details */}
              {activeSchedule && (
                <div className="space-y-4 sm:space-y-6">
                  {/* Schedule Info Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                      <div className="text-gray-400 text-xs sm:text-sm mb-1">
                        Start Date
                      </div>
                      <div className="text-white font-medium text-sm sm:text-base">
                        {formatDate(activeSchedule.startDate)}
                      </div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                      <div className="text-gray-400 text-xs sm:text-sm mb-1">
                        End Date
                      </div>
                      <div className="text-white font-medium text-sm sm:text-base">
                        {activeSchedule.endDate
                          ? formatDate(activeSchedule.endDate)
                          : "Ongoing"}
                      </div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                      <div className="text-gray-400 text-xs sm:text-sm mb-1">
                        Status
                      </div>
                      <span
                        className={`inline-block px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
                          activeSchedule.status === "active"
                            ? "bg-green-600/20 text-green-600"
                            : activeSchedule.status === "completed"
                            ? "bg-blue-600/20 text-blue-600"
                            : "bg-gray-600/20 text-gray-400"
                        }`}
                      >
                        {activeSchedule.status}
                      </span>
                    </div>
                  </div>

                  {/* Program Description */}
                  {activeSchedule.description && (
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-5">
                      <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                        About This Program
                      </h3>
                      <p className="text-gray-300 text-sm sm:text-base">
                        {activeSchedule.description}
                      </p>
                    </div>
                  )}

                  {/* Weekly Schedule Grid */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
                      Weekly Schedule
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {activeSchedule.workouts?.map((workout, index) => {
                        const isToday = workout.day === getTodayDay();
                        return (
                          <button
                            key={index}
                            onClick={() => {
                              setViewSchedule(activeSchedule);
                              setSelectedDay(workout.day);
                            }}
                            className={`bg-gray-800 border rounded-xl p-4 sm:p-5 text-left hover:border-blue-600 transition active:scale-95 ${
                              isToday
                                ? "border-blue-600 bg-blue-600/10"
                                : "border-gray-700"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-base sm:text-lg font-bold text-white capitalize">
                                {workout.day}
                              </h4>
                              {isToday && (
                                <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full font-medium">
                                  Today
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm mb-3">
                              <svg
                                className="w-4 h-4"
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
                              <span>
                                {workout.exercises?.length || 0} exercises
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                              <span>View Details</span>
                              <svg
                                className="w-4 h-4"
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
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Trainer Notes */}
                  {activeSchedule.notes && (
                    <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-xl p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <svg
                          className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5"
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
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-yellow-600 mb-2">
                            Trainer Notes
                          </h3>
                          <p className="text-yellow-600/90 text-sm sm:text-base">
                            {activeSchedule.notes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Workout Detail Modal */}
        {viewSchedule && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 sm:p-6 z-10">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                      {viewSchedule.title}
                    </h2>
                    <p className="text-gray-400 mt-1 capitalize text-sm sm:text-base">
                      {selectedDay || "Full Schedule"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setViewSchedule(null);
                      setSelectedDay(null);
                    }}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition flex-shrink-0"
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

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Cardio Section */}
                {viewSchedule.cardio &&
                  viewSchedule.cardio.length > 0 &&
                  viewSchedule.cardio[0].exerciseId && (
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
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
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        <span>Cardio Warm-up</span>
                      </h3>
                      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-5">
                        <div className="space-y-3">
                          {viewSchedule.cardio.map((cardio, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                            >
                              <button
                                onClick={() =>
                                  handleExerciseClick(cardio.exerciseId)
                                }
                                className="text-white font-medium text-sm sm:text-base hover:text-blue-600 transition text-left"
                              >
                                {getExerciseName(cardio.exerciseId)}
                              </button>
                              <span className="px-2 sm:px-3 py-1 bg-purple-600/20 text-purple-600 rounded text-xs sm:text-sm font-medium">
                                {cardio.time} min
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Warm-up Section */}
                {viewSchedule.warmUp &&
                  viewSchedule.warmUp.length > 0 &&
                  viewSchedule.warmUp[0].exerciseId && (
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-orange-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                          />
                        </svg>
                        <span>Dynamic Warm-up</span>
                      </h3>
                      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-5">
                        <div className="space-y-3">
                          {viewSchedule.warmUp.map((warmup, index) => (
                            <div
                              key={index}
                              className="bg-gray-800 rounded-lg p-3 sm:p-4"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <button
                                  onClick={() =>
                                    handleExerciseClick(warmup.exerciseId)
                                  }
                                  className="text-white font-medium text-sm sm:text-base hover:text-blue-600 transition text-left"
                                >
                                  {getExerciseName(warmup.exerciseId)}
                                </button>
                                <div className="flex gap-2">
                                  <span className="px-2 sm:px-3 py-1 bg-blue-600/20 text-blue-600 rounded text-xs sm:text-sm font-medium">
                                    {warmup.reps}
                                  </span>
                                  {warmup.rest && (
                                    <span className="px-2 sm:px-3 py-1 bg-green-600/20 text-green-600 rounded text-xs sm:text-sm font-medium">
                                      Rest: {warmup.rest} min
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Main Workouts */}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-blue-600"
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
                    <span>Main Exercises</span>
                  </h3>
                  <div className="space-y-4">
                    {viewSchedule.workouts
                      ?.filter((w) => !selectedDay || w.day === selectedDay)
                      .map((workout, index) => (
                        <div
                          key={index}
                          className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-5"
                        >
                          <h4 className="text-base sm:text-lg font-bold text-white mb-4 capitalize flex items-center gap-2">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs sm:text-sm">
                              {index + 1}
                            </div>
                            {workout.day}
                          </h4>

                          <div className="space-y-4">
                            {workout.exercises?.map((exercise, exIndex) => (
                              <div
                                key={exIndex}
                                className="bg-gray-800 rounded-lg p-4 sm:p-5"
                              >
                                <div className="flex items-start justify-between gap-3 mb-4">
                                  <button
                                    onClick={() =>
                                      handleExerciseClick(exercise.exerciseId)
                                    }
                                    className="text-white font-bold text-base sm:text-lg hover:text-blue-600 transition text-left flex-1"
                                  >
                                    {getExerciseName(exercise.exerciseId)}
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleExerciseClick(exercise.exerciseId)
                                    }
                                    className="p-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-600 rounded-lg transition flex-shrink-0"
                                    title="View exercise details"
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
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  {exercise.sets?.map((set, setIndex) => (
                                    <div
                                      key={setIndex}
                                      className="flex items-center gap-2 sm:gap-3 bg-gray-900/50 rounded-lg p-2 sm:p-3"
                                    >
                                      <span className="text-gray-400 font-medium text-xs sm:text-sm min-w-[50px] sm:min-w-[60px]">
                                        Set {setIndex + 1}
                                      </span>
                                      <div className="flex-1 flex flex-wrap items-center gap-2 sm:gap-3">
                                        <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600/20 text-blue-600 rounded font-bold text-xs sm:text-sm">
                                          {set.reps} reps
                                        </span>
                                        {set.rest && (
                                          <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600/20 text-green-600 rounded font-bold text-xs sm:text-sm">
                                            Rest: {set.rest} min
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Cool Down Section */}
                {viewSchedule.warmDown &&
                  viewSchedule.warmDown.length > 0 &&
                  viewSchedule.warmDown[0].exerciseId && (
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-cyan-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>Cool Down</span>
                      </h3>
                      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-5">
                        <div className="space-y-3">
                          {viewSchedule.warmDown.map((warmdown, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                            >
                              <button
                                onClick={() =>
                                  handleExerciseClick(warmdown.exerciseId)
                                }
                                className="text-white font-medium text-sm sm:text-base hover:text-blue-600 transition text-left"
                              >
                                {getExerciseName(warmdown.exerciseId)}
                              </button>
                              <span className="px-2 sm:px-3 py-1 bg-cyan-600/20 text-cyan-600 rounded text-xs sm:text-sm font-medium">
                                {warmdown.time} min
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                <button
                  onClick={() => {
                    setViewSchedule(null);
                    setSelectedDay(null);
                  }}
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition text-sm sm:text-base active:scale-95"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exercise Detail Modal */}
        <ExerciseDetailModal
          exercise={selectedExercise}
          isOpen={showExerciseDetail}
          onClose={() => {
            setShowExerciseDetail(false);
            setSelectedExercise(null);
          }}
        />
      </div>
    </MemberLayout>
  );
};

export default MemberSchedules;
