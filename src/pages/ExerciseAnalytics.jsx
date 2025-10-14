import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const ExerciseAnalytics = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [categories, setCategories] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [stats, setStats] = useState({
    totalExercises: 0,
    totalCategories: 0,
    mostUsedExercise: "",
    leastUsedExercise: "",
    avgDifficulty: "",
    exercisesWithEquipment: 0,
  });
  const [chartData, setChartData] = useState({
    categoryDistribution: [],
    difficultyDistribution: [],
    topExercises: [],
    bottomExercises: [],
    equipmentUsage: [],
    targetedSections: [],
  });

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "gym_admin" ||
    user?.role === "gym_manager";

  useEffect(() => {
    if (isAdmin && currentGymId) {
      fetchExerciseData();
    }
  }, [isAdmin, currentGymId]);

  const fetchExerciseData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      // Fetch exercises
      const exercisesQuery = query(
        collection(db, "exercises"),
        where("gymId", "==", currentGymId)
      );
      const exercisesSnapshot = await getDocs(exercisesQuery);
      const exercisesData = exercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch categories
      const categoriesQuery = query(
        collection(db, "exerciseCategories"),
        where("gymId", "==", currentGymId)
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch schedules
      const schedulesQuery = query(
        collection(db, "schedules"),
        where("gymId", "==", currentGymId)
      );
      const schedulesSnapshot = await getDocs(schedulesQuery);
      const schedulesData = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch workout logs
      const workoutLogsSnapshot = await getDocs(collection(db, "workoutLogs"));
      const workoutLogsData = workoutLogsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setExercises(exercisesData);
      setCategories(categoriesData);
      setSchedules(schedulesData);
      setWorkoutLogs(workoutLogsData);
      calculateStats(
        exercisesData,
        categoriesData,
        schedulesData,
        workoutLogsData
      );
      generateChartData(
        exercisesData,
        categoriesData,
        schedulesData,
        workoutLogsData
      );
      setLoading(false);
    } catch (error) {
      console.error("Error fetching exercise data:", error);
      setLoading(false);
    }
  };

  const calculateStats = (
    exercisesData,
    categoriesData,
    schedulesData,
    workoutLogsData
  ) => {
    const totalExercises = exercisesData.length;
    const totalCategories = categoriesData.length;

    // Calculate exercise usage
    const exerciseUsage = {};
    exercisesData.forEach((ex) => {
      exerciseUsage[ex.id] = 0;
    });

    // Count from schedules
    schedulesData.forEach((schedule) => {
      schedule.workouts?.forEach((workout) => {
        workout.exercises?.forEach((ex) => {
          if (exerciseUsage[ex.exerciseId] !== undefined) {
            exerciseUsage[ex.exerciseId]++;
          }
        });
      });

      schedule.cardio?.forEach((ex) => {
        if (exerciseUsage[ex.exerciseId] !== undefined) {
          exerciseUsage[ex.exerciseId]++;
        }
      });

      schedule.warmUp?.forEach((ex) => {
        if (exerciseUsage[ex.exerciseId] !== undefined) {
          exerciseUsage[ex.exerciseId]++;
        }
      });

      schedule.warmDown?.forEach((ex) => {
        if (exerciseUsage[ex.exerciseId] !== undefined) {
          exerciseUsage[ex.exerciseId]++;
        }
      });
    });

    // Count from workout logs
    workoutLogsData.forEach((log) => {
      log.exercises?.forEach((ex) => {
        if (exerciseUsage[ex.exerciseId] !== undefined) {
          exerciseUsage[ex.exerciseId]++;
        }
      });
    });

    // Find most and least used
    let mostUsed = { id: "", count: 0 };
    let leastUsed = { id: "", count: Infinity };

    Object.entries(exerciseUsage).forEach(([id, count]) => {
      if (count > mostUsed.count) {
        mostUsed = { id, count };
      }
      if (count < leastUsed.count && count > 0) {
        leastUsed = { id, count };
      }
    });

    const mostUsedExercise =
      exercisesData.find((e) => e.id === mostUsed.id)?.name || "N/A";
    const leastUsedExercise =
      exercisesData.find((e) => e.id === leastUsed.id)?.name || "N/A";

    // Calculate average difficulty
    const difficultyMap = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };
    const totalDifficulty = exercisesData.reduce(
      (sum, ex) => sum + (difficultyMap[ex.difficulty] || 0),
      0
    );
    const avgDifficultyNum =
      exercisesData.length > 0 ? totalDifficulty / exercisesData.length : 0;
    const avgDifficulty =
      avgDifficultyNum <= 1.5
        ? "Beginner"
        : avgDifficultyNum <= 2.5
        ? "Intermediate"
        : avgDifficultyNum <= 3.5
        ? "Advanced"
        : "Expert";

    // Count exercises with equipment
    const exercisesWithEquipment = exercisesData.filter(
      (ex) => ex.equipment && ex.equipment.trim() !== ""
    ).length;

    setStats({
      totalExercises,
      totalCategories,
      mostUsedExercise,
      leastUsedExercise,
      avgDifficulty,
      exercisesWithEquipment,
    });
  };

  const generateChartData = (
    exercisesData,
    categoriesData,
    schedulesData,
    workoutLogsData
  ) => {
    // Category distribution
    const categoryCounts = {};
    categoriesData.forEach((cat) => {
      categoryCounts[cat.id] = {
        name: cat.name,
        count: 0,
      };
    });

    exercisesData.forEach((ex) => {
      if (ex.category && categoryCounts[ex.category]) {
        categoryCounts[ex.category].count++;
      }
    });

    const categoryDistribution = Object.values(categoryCounts)
      .filter((cat) => cat.count > 0)
      .map((cat, index) => ({
        ...cat,
        color: getColor(index),
      }));

    // Difficulty distribution
    const difficultyCounts = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0,
    };

    exercisesData.forEach((ex) => {
      const difficulty = ex.difficulty || "beginner";
      if (difficultyCounts[difficulty] !== undefined) {
        difficultyCounts[difficulty]++;
      }
    });

    const difficultyDistribution = [
      { name: "Beginner", value: difficultyCounts.beginner, color: "#10b981" },
      {
        name: "Intermediate",
        value: difficultyCounts.intermediate,
        color: "#3b82f6",
      },
      { name: "Advanced", value: difficultyCounts.advanced, color: "#f59e0b" },
      { name: "Expert", value: difficultyCounts.expert, color: "#ef4444" },
    ].filter((item) => item.value > 0);

    // Calculate exercise usage
    const exerciseUsage = {};
    exercisesData.forEach((ex) => {
      exerciseUsage[ex.id] = { name: ex.name, count: 0 };
    });

    schedulesData.forEach((schedule) => {
      schedule.workouts?.forEach((workout) => {
        workout.exercises?.forEach((ex) => {
          if (exerciseUsage[ex.exerciseId]) {
            exerciseUsage[ex.exerciseId].count++;
          }
        });
      });

      schedule.cardio?.forEach((ex) => {
        if (exerciseUsage[ex.exerciseId]) {
          exerciseUsage[ex.exerciseId].count++;
        }
      });

      schedule.warmUp?.forEach((ex) => {
        if (exerciseUsage[ex.exerciseId]) {
          exerciseUsage[ex.exerciseId].count++;
        }
      });

      schedule.warmDown?.forEach((ex) => {
        if (exerciseUsage[ex.exerciseId]) {
          exerciseUsage[ex.exerciseId].count++;
        }
      });
    });

    workoutLogsData.forEach((log) => {
      log.exercises?.forEach((ex) => {
        if (exerciseUsage[ex.exerciseId]) {
          exerciseUsage[ex.exerciseId].count++;
        }
      });
    });

    const sortedExercises = Object.values(exerciseUsage).sort(
      (a, b) => b.count - a.count
    );
    const topExercises = sortedExercises.slice(0, 10);
    const bottomExercises = sortedExercises
      .filter((ex) => ex.count > 0)
      .slice(-10)
      .reverse();

    // Equipment usage
    const equipmentCounts = {};
    exercisesData.forEach((ex) => {
      const equipment = ex.equipment || "Bodyweight";
      if (equipment.trim()) {
        equipmentCounts[equipment] = (equipmentCounts[equipment] || 0) + 1;
      }
    });

    const equipmentUsage = Object.entries(equipmentCounts)
      .map(([equipment, count]) => ({
        equipment,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Targeted sections
    const sectionCounts = {};
    exercisesData.forEach((ex) => {
      ex.targetedSections?.forEach((section) => {
        if (section && section.trim()) {
          sectionCounts[section] = (sectionCounts[section] || 0) + 1;
        }
      });
    });

    const targetedSections = Object.entries(sectionCounts)
      .map(([section, count]) => ({
        section,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setChartData({
      categoryDistribution,
      difficultyDistribution,
      topExercises,
      bottomExercises,
      equipmentUsage,
      targetedSections,
    });
  };

  const getColor = (index) => {
    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
      "#84cc16",
    ];
    return colors[index % colors.length];
  };

  const StatCard = ({ title, value, subtitle, icon, color }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {icon}
          </svg>
        </div>
      </div>
      <div>
        <p className="text-gray-400 text-sm mb-1">{title}</p>
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
        {subtitle && <p className="text-gray-500 text-xs">{subtitle}</p>}
      </div>
    </div>
  );

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

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading exercise analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.history.back()}
                    className="p-1 hover:bg-gray-700 rounded-lg transition"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400"
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
                  </button>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">
                    Exercise Analytics
                  </h1>
                </div>
                <p className="text-gray-400 text-sm hidden sm:block">
                  Track exercise usage and popularity metrics
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatCard
              title="Total Exercises"
              value={stats.totalExercises}
              subtitle={`${stats.totalCategories} categories`}
              color="bg-orange-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              }
            />

            <StatCard
              title="Most Popular"
              value={stats.mostUsedExercise}
              subtitle="Most used exercise"
              color="bg-green-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              }
            />

            <StatCard
              title="Average Difficulty"
              value={stats.avgDifficulty}
              subtitle={`${stats.exercisesWithEquipment} with equipment`}
              color="bg-blue-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              }
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Category Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Category Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.categoryDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {chartData.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Difficulty Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Difficulty Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.difficultyDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.difficultyDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Exercises */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Top 10 Most Used Exercises
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.topExercises} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#9ca3af"
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Equipment Usage */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Equipment Usage
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.equipmentUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="equipment"
                    stroke="#9ca3af"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Targeted Sections */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold text-white mb-4">
              Most Targeted Body Sections
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.targetedSections}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="section" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "0.5rem",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Insights Section */}
          <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-600/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              Exercise Library Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Library Size</p>
                <p className="text-white font-semibold">
                  {stats.totalExercises >= 50
                    ? "🎯 Comprehensive"
                    : stats.totalExercises >= 30
                    ? "✅ Good"
                    : "📚 Growing"}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.totalExercises} exercises available
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Most Popular</p>
                <p className="text-white font-semibold truncate">
                  {stats.mostUsedExercise}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Top exercise in schedules
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Avg Difficulty</p>
                <p className="text-white font-semibold">
                  {stats.avgDifficulty}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Overall library difficulty
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ExerciseAnalytics;
