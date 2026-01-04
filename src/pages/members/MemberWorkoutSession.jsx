import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import MemberLayout from "../../components/MemberLayout";
import { Trophy, RefreshCw, Download } from "lucide-react";

const MemberWorkoutSession = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { workout, day, scheduleId } = location.state || {};

  const [exercises, setExercises] = useState([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseLogs, setExerciseLogs] = useState([]);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [personalRecords, setPersonalRecords] = useState({});
  const [showExerciseSwap, setShowExerciseSwap] = useState(false);
  const [previousWorkouts, setPreviousWorkouts] = useState([]);

  useEffect(() => {
    if (!workout || !day || !scheduleId) {
      navigate("/member/workouts");
      return;
    }
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, query, where, orderBy, limit } = await import("firebase/firestore");

      const exercisesSnapshot = await getDocs(collection(db, "exercises"));
      const exercisesData = exercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setExercises(exercisesData);

      // Fetch previous workout logs to calculate PRs
      const workoutLogsQuery = query(
        collection(db, "workoutLogs"),
        where("memberId", "==", currentUser.id),
        orderBy("completedAt", "desc"),
        limit(50)
      );
      const workoutLogsSnapshot = await getDocs(workoutLogsQuery);
      const workoutLogsData = workoutLogsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setPreviousWorkouts(workoutLogsData);

      // Calculate personal records for each exercise
      const prs = {};
      workout.exercises.forEach((exercise) => {
        const exerciseHistory = [];
        workoutLogsData.forEach((log) => {
          const exerciseInLog = log.exercises?.find(
            (e) => e.exerciseId === exercise.exerciseId
          );
          if (exerciseInLog) {
            exerciseInLog.sets?.forEach((set) => {
              const volume = (set.weight || 0) * (set.actualReps || 0);
              exerciseHistory.push({
                weight: set.weight || 0,
                reps: set.actualReps || 0,
                volume: volume,
              });
            });
          }
        });

        if (exerciseHistory.length > 0) {
          prs[exercise.exerciseId] = {
            maxWeight: Math.max(...exerciseHistory.map((h) => h.weight)),
            maxVolume: Math.max(...exerciseHistory.map((h) => h.volume)),
            maxReps: Math.max(...exerciseHistory.map((h) => h.reps)),
          };
        }
      });

      setPersonalRecords(prs);

      // Initialize exercise logs
      const initialLogs = workout.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: exercise.sets.map((set) => ({
          plannedReps: set.reps,
          actualReps: set.reps,
          weight: 0,
          rest: set.rest,
          completed: false,
          isPR: false,
        })),
      }));

      setExerciseLogs(initialLogs);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching exercises:", error);
      setLoading(false);
    }
  };

  const getExerciseName = (exerciseId) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    return exercise?.name || "Unknown Exercise";
  };

  const updateSetData = (exerciseIndex, setIndex, field, value) => {
    setExerciseLogs((prev) => {
      const updated = [...prev];
      updated[exerciseIndex].sets[setIndex][field] = value;
      return updated;
    });
  };

  const checkIfPR = (exerciseId, weight, reps) => {
    const pr = personalRecords[exerciseId];
    if (!pr) return true; // First time doing this exercise

    const currentVolume = weight * reps;
    return (
      weight > pr.maxWeight ||
      currentVolume > pr.maxVolume ||
      (weight === pr.maxWeight && reps > pr.maxReps)
    );
  };

  const markSetComplete = (exerciseIndex, setIndex) => {
    setExerciseLogs((prev) => {
      const updated = [...prev];
      const set = updated[exerciseIndex].sets[setIndex];
      const exerciseId = updated[exerciseIndex].exerciseId;

      // Check if this is a PR
      const isPR = checkIfPR(exerciseId, parseFloat(set.weight) || 0, parseInt(set.actualReps) || 0);

      updated[exerciseIndex].sets[setIndex].completed = true;
      updated[exerciseIndex].sets[setIndex].isPR = isPR;

      // Show celebration for PR
      if (isPR) {
        setTimeout(() => {
          alert("🎉 New Personal Record! Amazing work!");
        }, 100);
      }

      return updated;
    });
  };

  const handleSwapExercise = (newExerciseId) => {
    // Update the current exercise in the workout
    const updatedExercises = [...workout.exercises];
    updatedExercises[currentExerciseIndex] = {
      ...updatedExercises[currentExerciseIndex],
      exerciseId: newExerciseId,
    };

    // Update exercise logs
    const updatedLogs = [...exerciseLogs];
    updatedLogs[currentExerciseIndex] = {
      ...updatedLogs[currentExerciseIndex],
      exerciseId: newExerciseId,
      sets: updatedLogs[currentExerciseIndex].sets.map((set) => ({
        ...set,
        completed: false,
        actualReps: set.plannedReps,
        weight: 0,
      })),
    };

    setExerciseLogs(updatedLogs);
    setShowExerciseSwap(false);
  };

  const getCurrentExercise = () => {
    if (!workout || currentExerciseIndex >= workout.exercises.length) return null;
    return workout.exercises[currentExerciseIndex];
  };

  const getCurrentExerciseLog = () => {
    return exerciseLogs[currentExerciseIndex];
  };

  const goToNextExercise = () => {
    if (currentExerciseIndex < workout.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      window.scrollTo(0, 0);
    }
  };

  const goToPreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(currentExerciseIndex - 1);
      window.scrollTo(0, 0);
    }
  };

  const isLastExercise = () => {
    return currentExerciseIndex === workout.exercises.length - 1;
  };

  const isFirstExercise = () => {
    return currentExerciseIndex === 0;
  };

  const allSetsCompleted = () => {
    const currentLog = getCurrentExerciseLog();
    if (!currentLog) return false;
    return currentLog.sets.every((set) => set.completed);
  };

  const completeWorkout = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      // Calculate completion rate
      let totalPlannedSets = 0;
      let completedSets = 0;
      let totalPRs = 0;

      exerciseLogs.forEach((log) => {
        log.sets.forEach((set) => {
          totalPlannedSets++;
          if (set.completed) {
            completedSets++;
          }
          if (set.isPR) {
            totalPRs++;
          }
        });
      });

      const completionRate = totalPlannedSets > 0
        ? Math.round((completedSets / totalPlannedSets) * 100)
        : 0;

      // Prepare exercise logs for saving
      const finalLogs = exerciseLogs.map((log, index) => ({
        exerciseId: log.exerciseId,
        exerciseName: getExerciseName(log.exerciseId),
        sets: log.sets.map((set) => ({
          plannedReps: set.plannedReps,
          actualReps: parseInt(set.actualReps) || 0,
          weight: parseFloat(set.weight) || 0,
          rest: set.rest,
          isPR: set.isPR || false,
        })),
        personalRecords: log.sets.filter((s) => s.isPR).length,
      }));

      // Save workout log
      await addDoc(collection(db, "workoutLogs"), {
        memberId: currentUser.id,
        gymId: currentUser.gymId,
        scheduleId: scheduleId,
        day: day,
        exercises: finalLogs,
        completedAt: Timestamp.now(),
        duration: 0,
        notes: workoutNotes,
        completionRate: completionRate,
        totalPRs: totalPRs,
        overallFeeling: completionRate >= 90 ? "hard" : completionRate >= 70 ? "moderate" : "easy",
      });

      // Show success animation
      setShowSuccessAnimation(true);
      setTimeout(() => {
        navigate("/member/workouts");
      }, 2000);
    } catch (error) {
      console.error("Error saving workout:", error);
      alert("Failed to save workout. Please try again.");
    }
  };

  if (loading) {
    return (
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading workout...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  const currentExercise = getCurrentExercise();
  const currentLog = getCurrentExerciseLog();

  if (!currentExercise || !currentLog) {
    return (
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-400">No exercise data available</p>
            <button
              onClick={() => navigate("/member/workouts")}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg"
            >
              Go Back
            </button>
          </div>
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout>
      <div className="min-h-full bg-gray-900">
        {/* Header with Progress */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to exit? Your progress will be lost.")) {
                    navigate("/member/workouts");
                  }
                }}
                className="text-white/80 hover:text-white transition flex items-center gap-2"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="text-sm sm:text-base">Exit Workout</span>
              </button>
              <div className="text-white/90 text-sm sm:text-base font-medium capitalize">
                {day}'s Workout
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 text-xs sm:text-sm">
                  Exercise {currentExerciseIndex + 1} of {workout.exercises.length}
                </span>
                <span className="text-white/80 text-xs sm:text-sm">
                  {Math.round(((currentExerciseIndex + 1) / workout.exercises.length) * 100)}%
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentExerciseIndex + 1) / workout.exercises.length) * 100}%`,
                  }}
                ></div>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {getExerciseName(currentExercise.exerciseId)}
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {/* Personal Record Info */}
          {personalRecords[currentExercise.exerciseId] && (
            <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-xl p-4 mb-4 border border-yellow-600/30">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-yellow-200">Your Personal Records</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Max Weight</p>
                  <p className="text-lg font-bold text-yellow-300">
                    {personalRecords[currentExercise.exerciseId].maxWeight} kg
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Max Reps</p>
                  <p className="text-lg font-bold text-yellow-300">
                    {personalRecords[currentExercise.exerciseId].maxReps}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Max Volume</p>
                  <p className="text-lg font-bold text-yellow-300">
                    {personalRecords[currentExercise.exerciseId].maxVolume} kg
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Exercise Info */}
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 mb-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Sets to Complete
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExerciseSwap(true)}
                  className="text-blue-400 hover:text-blue-300 transition flex items-center gap-1 text-sm"
                  title="Swap exercise"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Swap</span>
                </button>
                <span className="text-3xl">💪</span>
              </div>
            </div>

            {/* Sets */}
            <div className="space-y-4">
              {currentExercise.sets.map((set, setIndex) => {
                const setLog = currentLog.sets[setIndex];
                const isCompleted = setLog.completed;

                return (
                  <div
                    key={setIndex}
                    className={`bg-gray-900 rounded-lg p-4 sm:p-5 border-2 transition ${
                      isCompleted ? "border-green-500" : "border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-white font-semibold text-base sm:text-lg">
                          Set {setIndex + 1}
                        </h3>
                        <p className="text-gray-400 text-sm">
                          Target: {set.reps} reps • Rest: {set.rest}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {setLog.isPR && (
                          <div className="flex items-center gap-1 bg-yellow-900/30 border border-yellow-600 rounded-lg px-2 py-1">
                            <Trophy className="w-4 h-4 text-yellow-400" />
                            <span className="text-xs font-bold text-yellow-300">PR!</span>
                          </div>
                        )}
                        {isCompleted && (
                          <div className="flex items-center gap-2 text-green-500">
                            <svg
                              className="w-6 h-6"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="font-medium hidden sm:inline">Done</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Reps Completed
                        </label>
                        <input
                          type="number"
                          value={setLog.actualReps}
                          onChange={(e) =>
                            updateSetData(
                              currentExerciseIndex,
                              setIndex,
                              "actualReps",
                              e.target.value
                            )
                          }
                          disabled={isCompleted}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          value={setLog.weight}
                          onChange={(e) =>
                            updateSetData(
                              currentExerciseIndex,
                              setIndex,
                              "weight",
                              e.target.value
                            )
                          }
                          disabled={isCompleted}
                          step="0.5"
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          min="0"
                        />
                      </div>
                    </div>

                    {!isCompleted && (
                      <button
                        onClick={() =>
                          markSetComplete(currentExerciseIndex, setIndex)
                        }
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition active:scale-95"
                      >
                        Mark as Complete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workout Notes - Only show on last exercise */}
          {isLastExercise() && (
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6 mb-4 border border-gray-700">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Workout Notes (Optional)
              </label>
              <textarea
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                rows="3"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="How did you feel? Any achievements or challenges?"
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            <button
              onClick={goToPreviousExercise}
              disabled={isFirstExercise()}
              className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition flex items-center justify-center gap-2 active:scale-95"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>

            {!isLastExercise() ? (
              <button
                onClick={goToNextExercise}
                disabled={!allSetsCompleted()}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition flex items-center justify-center gap-2 active:scale-95"
              >
                <span className="hidden sm:inline">Next Exercise</span>
                <span className="sm:hidden">Next</span>
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ) : (
              <button
                onClick={completeWorkout}
                disabled={!allSetsCompleted()}
                className="flex-1 py-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition flex items-center justify-center gap-2 active:scale-95"
              >
                Complete Workout 🎉
              </button>
            )}
          </div>

          {/* Helper Text */}
          {!allSetsCompleted() && (
            <p className="text-center text-gray-400 text-sm mt-4">
              Complete all sets to continue
            </p>
          )}
        </div>

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

        {/* Exercise Swap Modal */}
        {showExerciseSwap && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-xl sticky top-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <RefreshCw className="w-6 h-6" />
                      Swap Exercise
                    </h2>
                    <p className="text-blue-100 text-sm mt-1">
                      Replace {getExerciseName(currentExercise.exerciseId)} with another exercise
                    </p>
                  </div>
                  <button
                    onClick={() => setShowExerciseSwap(false)}
                    className="text-white hover:bg-white/20 rounded-lg p-2 transition"
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

              <div className="p-6">
                <p className="text-gray-300 mb-4">
                  Select an exercise to replace the current one. Your progress will be reset for this exercise.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {exercises
                    .filter((ex) => ex.id !== currentExercise.exerciseId)
                    .map((exercise) => (
                      <button
                        key={exercise.id}
                        onClick={() => handleSwapExercise(exercise.id)}
                        className="bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-blue-500 rounded-lg p-4 text-left transition"
                      >
                        <h3 className="font-bold text-white mb-1">{exercise.name}</h3>
                        {exercise.category && (
                          <p className="text-sm text-gray-400 capitalize">
                            {exercise.category}
                          </p>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MemberLayout>
  );
};

export default MemberWorkoutSession;
