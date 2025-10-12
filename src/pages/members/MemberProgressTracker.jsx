import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import MemberLayout from "../../components/MemberLayout";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const MemberProgressTracker = () => {
  const { user: currentUser } = useAuth();

  const [weightLogs, setWeightLogs] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [activeTab, setActiveTab] = useState("weight");

  const [weightForm, setWeightForm] = useState({
    weight: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch weight logs
      const weightQuery = query(
        collection(db, "weightLogs"),
        where("memberId", "==", currentUser.id),
        orderBy("date", "asc")
      );
      const weightSnapshot = await getDocs(weightQuery);
      const weightData = weightSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate
          ? doc.data().date.toDate()
          : new Date(doc.data().date),
      }));

      // Fetch workout logs
      const workoutQuery = query(
        collection(db, "workoutLogs"),
        where("memberId", "==", currentUser.id),
        orderBy("completedAt", "asc")
      );
      const workoutSnapshot = await getDocs(workoutQuery);
      const workoutData = workoutSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate
          ? doc.data().completedAt.toDate()
          : new Date(doc.data().completedAt),
      }));

      // Fetch exercises
      const exercisesSnapshot = await getDocs(collection(db, "exercises"));
      const exercisesData = exercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setWeightLogs(weightData);
      setWorkoutLogs(workoutData);
      setExercises(exercisesData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleAddWeight = async (e) => {
    e.preventDefault();

    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      await addDoc(collection(db, "weightLogs"), {
        memberId: currentUser.id,
        weight: parseFloat(weightForm.weight),
        date: Timestamp.fromDate(new Date(weightForm.date)),
        notes: weightForm.notes,
        createdAt: Timestamp.now(),
      });

      setWeightForm({
        weight: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setShowAddWeight(false);
      fetchData();

      alert("Weight logged successfully! 🎉");
    } catch (error) {
      console.error("Error adding weight:", error);
      alert("Failed to log weight. Please try again.");
    }
  };

  const getWeightChartData = () => {
    return weightLogs.map((log) => ({
      date: log.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      weight: log.weight,
      fullDate: log.date,
    }));
  };

  const getExerciseProgressData = (exerciseId) => {
    const exerciseLogs = [];

    workoutLogs.forEach((workout) => {
      workout.exercises?.forEach((ex) => {
        if (ex.exerciseId === exerciseId) {
          exerciseLogs.push({
            date: workout.completedAt,
            weight: ex.weight || 0,
            reps: ex.actualReps || 0,
            volume: (ex.weight || 0) * (ex.actualReps || 0),
          });
        }
      });
    });

    const groupedData = {};
    exerciseLogs.forEach((log) => {
      const dateKey = log.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = {
          date: dateKey,
          weights: [],
          reps: [],
          volumes: [],
        };
      }
      groupedData[dateKey].weights.push(log.weight);
      groupedData[dateKey].reps.push(log.reps);
      groupedData[dateKey].volumes.push(log.volume);
    });

    return Object.values(groupedData).map((group) => ({
      date: group.date,
      avgWeight: (
        group.weights.reduce((a, b) => a + b, 0) / group.weights.length
      ).toFixed(1),
      avgReps: Math.round(
        group.reps.reduce((a, b) => a + b, 0) / group.reps.length
      ),
      totalVolume: group.volumes.reduce((a, b) => a + b, 0).toFixed(1),
    }));
  };

  const getWorkoutFrequencyData = () => {
    const last30Days = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const workoutsOnDate = workoutLogs.filter((log) => {
        const logDate = log.completedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        return logDate === dateKey;
      }).length;

      last30Days.push({ date: dateKey, workouts: workoutsOnDate });
    }

    return last30Days;
  };

  const getUniqueExercises = () => {
    const exerciseIds = new Set();
    workoutLogs.forEach((log) => {
      log.exercises?.forEach((ex) => {
        if (ex.exerciseId) {
          exerciseIds.add(ex.exerciseId);
        }
      });
    });
    return Array.from(exerciseIds)
      .map((id) => exercises.find((ex) => ex.id === id))
      .filter(Boolean);
  };

  const getStats = () => {
    const totalWorkouts = workoutLogs.length;
    const totalExercises = workoutLogs.reduce(
      (sum, log) => sum + (log.exercises?.length || 0),
      0
    );
    const currentWeight =
      weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : null;
    const startWeight = weightLogs.length > 0 ? weightLogs[0].weight : null;
    const weightChange =
      currentWeight && startWeight
        ? (currentWeight - startWeight).toFixed(1)
        : null;

    return {
      totalWorkouts,
      totalExercises,
      currentWeight,
      weightChange,
      daysActive: new Set(
        workoutLogs.map((log) => log.completedAt.toDateString())
      ).size,
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your progress...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout>
      <div className="min-h-full bg-gray-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 sm:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  My Progress
                </h1>
                <p className="text-sm sm:text-base text-white/80">
                  Track your fitness journey
                </p>
              </div>
              <button
                onClick={() => setShowAddWeight(true)}
                className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-white text-purple-600 rounded-lg font-medium hover:bg-gray-100 transition flex items-center justify-center gap-2 active:scale-95"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="hidden sm:inline">Log Weight</span>
                <span className="sm:hidden">Add Weight</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="text-2xl sm:text-3xl mb-2">💪</div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {stats.totalWorkouts}
              </div>
              <div className="text-xs sm:text-sm text-blue-100">
                Total Workouts
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="text-2xl sm:text-3xl mb-2">🔥</div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {stats.daysActive}
              </div>
              <div className="text-xs sm:text-sm text-purple-100">
                Days Active
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="text-2xl sm:text-3xl mb-2">⚖️</div>
              <div className="text-xl sm:text-3xl font-bold mb-1 truncate">
                {stats.currentWeight ? `${stats.currentWeight} kg` : "N/A"}
              </div>
              <div className="text-xs sm:text-sm text-green-100">
                Current Weight
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="text-2xl sm:text-3xl mb-2">
                {stats.weightChange > 0
                  ? "📈"
                  : stats.weightChange < 0
                  ? "📉"
                  : "➖"}
              </div>
              <div className="text-xl sm:text-3xl font-bold mb-1 truncate">
                {stats.weightChange
                  ? `${stats.weightChange > 0 ? "+" : ""}${
                      stats.weightChange
                    } kg`
                  : "N/A"}
              </div>
              <div className="text-xs sm:text-sm text-orange-100">
                Weight Change
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
            <div className="flex border-b border-gray-700 overflow-x-auto">
              <button
                onClick={() => setActiveTab("weight")}
                className={`flex-1 min-w-[100px] px-4 sm:px-6 py-3 sm:py-4 font-medium transition text-sm sm:text-base whitespace-nowrap ${
                  activeTab === "weight"
                    ? "text-blue-500 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                <span className="hidden sm:inline">Weight Progress</span>
                <span className="sm:hidden">Weight</span>
              </button>
              <button
                onClick={() => setActiveTab("exercises")}
                className={`flex-1 min-w-[100px] px-4 sm:px-6 py-3 sm:py-4 font-medium transition text-sm sm:text-base whitespace-nowrap ${
                  activeTab === "exercises"
                    ? "text-blue-500 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                <span className="hidden sm:inline">Exercise Progress</span>
                <span className="sm:hidden">Exercises</span>
              </button>
              <button
                onClick={() => setActiveTab("frequency")}
                className={`flex-1 min-w-[100px] px-4 sm:px-6 py-3 sm:py-4 font-medium transition text-sm sm:text-base whitespace-nowrap ${
                  activeTab === "frequency"
                    ? "text-blue-500 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                <span className="hidden sm:inline">Workout Frequency</span>
                <span className="sm:hidden">Frequency</span>
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {/* Weight Progress Tab */}
              {activeTab === "weight" && (
                <div>
                  {weightLogs.length > 0 ? (
                    <>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">
                        Weight Over Time
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={getWeightChartData()}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#374151"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#9CA3AF"
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            stroke="#9CA3AF"
                            domain={["dataMin - 5", "dataMax + 5"]}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1F2937",
                              border: "1px solid #374151",
                              borderRadius: "8px",
                              fontSize: "14px",
                            }}
                            labelStyle={{ color: "#F3F4F6" }}
                          />
                          <Legend wrapperStyle={{ fontSize: "14px" }} />
                          <Line
                            type="monotone"
                            dataKey="weight"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            dot={{ fill: "#3B82F6", r: 4 }}
                            activeDot={{ r: 6 }}
                            name="Weight (kg)"
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      {/* Weight Log History */}
                      <div className="mt-6 sm:mt-8">
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
                          Weight Log History
                        </h3>
                        <div className="space-y-3">
                          {weightLogs
                            .slice()
                            .reverse()
                            .map((log) => (
                              <div
                                key={log.id}
                                className="bg-gray-900 rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3"
                              >
                                <div className="flex-1 min-w-0">
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
                                  {log.date.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 sm:py-12">
                      <div className="text-5xl sm:text-6xl mb-4">⚖️</div>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                        No Weight Logs Yet
                      </h3>
                      <p className="text-sm sm:text-base text-gray-400 mb-6">
                        Start tracking your weight to see progress!
                      </p>
                      <button
                        onClick={() => setShowAddWeight(true)}
                        className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition text-sm sm:text-base active:scale-95"
                      >
                        Log Your First Weight
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Exercise Progress Tab */}
              {activeTab === "exercises" && (
                <div>
                  {getUniqueExercises().length > 0 ? (
                    <>
                      <div className="mb-6">
                        <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                          Select Exercise
                        </label>
                        <select
                          value={selectedExercise || ""}
                          onChange={(e) => setSelectedExercise(e.target.value)}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Choose an exercise...</option>
                          {getUniqueExercises().map((exercise) => (
                            <option key={exercise.id} value={exercise.id}>
                              {exercise.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedExercise && (
                        <div className="space-y-6 sm:space-y-8">
                          <div>
                            <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
                              Weight Progress
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart
                                data={getExerciseProgressData(selectedExercise)}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#374151"
                                />
                                <XAxis
                                  dataKey="date"
                                  stroke="#9CA3AF"
                                  tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                  stroke="#9CA3AF"
                                  tick={{ fontSize: 12 }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#1F2937",
                                    border: "1px solid #374151",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                  }}
                                  labelStyle={{ color: "#F3F4F6" }}
                                />
                                <Legend wrapperStyle={{ fontSize: "14px" }} />
                                <Line
                                  type="monotone"
                                  dataKey="avgWeight"
                                  stroke="#10B981"
                                  strokeWidth={2}
                                  dot={{ fill: "#10B981", r: 4 }}
                                  name="Avg Weight (kg)"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div>
                            <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
                              Reps Progress
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart
                                data={getExerciseProgressData(selectedExercise)}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#374151"
                                />
                                <XAxis
                                  dataKey="date"
                                  stroke="#9CA3AF"
                                  tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                  stroke="#9CA3AF"
                                  tick={{ fontSize: 12 }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#1F2937",
                                    border: "1px solid #374151",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                  }}
                                  labelStyle={{ color: "#F3F4F6" }}
                                />
                                <Legend wrapperStyle={{ fontSize: "14px" }} />
                                <Line
                                  type="monotone"
                                  dataKey="avgReps"
                                  stroke="#F59E0B"
                                  strokeWidth={2}
                                  dot={{ fill: "#F59E0B", r: 4 }}
                                  name="Avg Reps"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div>
                            <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
                              Total Volume Progress
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                              <BarChart
                                data={getExerciseProgressData(selectedExercise)}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#374151"
                                />
                                <XAxis
                                  dataKey="date"
                                  stroke="#9CA3AF"
                                  tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                  stroke="#9CA3AF"
                                  tick={{ fontSize: 12 }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#1F2937",
                                    border: "1px solid #374151",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                  }}
                                  labelStyle={{ color: "#F3F4F6" }}
                                />
                                <Legend wrapperStyle={{ fontSize: "14px" }} />
                                <Bar
                                  dataKey="totalVolume"
                                  fill="#8B5CF6"
                                  name="Total Volume (kg)"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 sm:py-12">
                      <div className="text-5xl sm:text-6xl mb-4">📊</div>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                        No Exercise Data Yet
                      </h3>
                      <p className="text-sm sm:text-base text-gray-400 mb-6">
                        Complete workouts to see your exercise progress!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Workout Frequency Tab */}
              {activeTab === "frequency" && (
                <div>
                  {workoutLogs.length > 0 ? (
                    <>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">
                        Last 30 Days Activity
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={getWorkoutFrequencyData()}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#374151"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#9CA3AF"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1F2937",
                              border: "1px solid #374151",
                              borderRadius: "8px",
                              fontSize: "14px",
                            }}
                            labelStyle={{ color: "#F3F4F6" }}
                          />
                          <Legend wrapperStyle={{ fontSize: "14px" }} />
                          <Bar
                            dataKey="workouts"
                            fill="#3B82F6"
                            name="Workouts Completed"
                          />
                        </BarChart>
                      </ResponsiveContainer>

                      <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-gray-900 rounded-lg p-4 sm:p-6 text-center">
                          <div className="text-3xl sm:text-4xl mb-2">🎯</div>
                          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                            {(
                              stats.totalWorkouts / (stats.daysActive || 1)
                            ).toFixed(1)}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400">
                            Avg Workouts/Day
                          </div>
                        </div>

                        <div className="bg-gray-900 rounded-lg p-4 sm:p-6 text-center">
                          <div className="text-3xl sm:text-4xl mb-2">📅</div>
                          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                            {stats.daysActive}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400">
                            Active Days
                          </div>
                        </div>

                        <div className="bg-gray-900 rounded-lg p-4 sm:p-6 text-center">
                          <div className="text-3xl sm:text-4xl mb-2">🏋️</div>
                          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                            {stats.totalExercises}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400">
                            Total Exercises
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 sm:py-12">
                      <div className="text-5xl sm:text-6xl mb-4">📈</div>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                        No Workout Data Yet
                      </h3>
                      <p className="text-sm sm:text-base text-gray-400 mb-6">
                        Start working out to see your frequency data!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Weight Modal */}
        {showAddWeight && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-md w-full p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Log Weight
                </h2>
                <button
                  onClick={() => setShowAddWeight(false)}
                  className="text-gray-400 hover:text-white transition"
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

              <form onSubmit={handleAddWeight} className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightForm.weight}
                    onChange={(e) =>
                      setWeightForm({ ...weightForm, weight: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-base sm:text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="75.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={weightForm.date}
                    onChange={(e) =>
                      setWeightForm({ ...weightForm, date: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={weightForm.notes}
                    onChange={(e) =>
                      setWeightForm({ ...weightForm, notes: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="How do you feel today?"
                    rows="3"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddWeight(false)}
                    className="flex-1 py-2 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition text-sm sm:text-base active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition text-sm sm:text-base active:scale-95"
                  >
                    Save Weight
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MemberLayout>
  );
};

export default MemberProgressTracker;
