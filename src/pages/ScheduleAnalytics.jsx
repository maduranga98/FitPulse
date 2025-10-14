import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
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

const ScheduleAnalytics = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeRange, setTimeRange] = useState("30");
  const [schedules, setSchedules] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({
    totalSchedules: 0,
    activeSchedules: 0,
    completedSchedules: 0,
    totalWorkouts: 0,
    membersWithSchedules: 0,
    membersWithoutSchedules: 0,
    avgWorkoutsPerMember: 0,
    totalVolume: 0,
    avgWeight: 0,
    totalReps: 0,
  });
  const [chartData, setChartData] = useState({
    scheduleStatus: [],
    dayDistribution: [],
    popularExercises: [],
    workoutTrend: [],
    exercisePerformance: [],
    memberActivity: [],
    volumeByExercise: [],
    weeklyProgress: [],
  });

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "gym_admin" ||
    user?.role === "gym_manager";

  useEffect(() => {
    if (isAdmin && currentGymId) {
      fetchScheduleData();
    }
  }, [isAdmin, currentGymId, timeRange]);

  const fetchScheduleData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch schedules
      const schedulesQuery = query(
        collection(db, "schedules"),
        where("gymId", "==", currentGymId),
        orderBy("startDate", "desc")
      );
      const schedulesSnapshot = await getDocs(schedulesQuery);
      const schedulesData = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

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

      // Fetch workout logs
      const workoutLogsQuery = query(
        collection(db, "workoutLogs"),
        orderBy("completedAt", "desc")
      );
      const workoutLogsSnapshot = await getDocs(workoutLogsQuery);
      const workoutLogsData = workoutLogsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch members
      const membersQuery = query(
        collection(db, "members"),
        where("gymId", "==", currentGymId)
      );
      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSchedules(schedulesData);
      setExercises(exercisesData);
      setWorkoutLogs(workoutLogsData);
      setMembers(membersData);
      calculateStats(
        schedulesData,
        workoutLogsData,
        membersData,
        exercisesData
      );
      generateChartData(
        schedulesData,
        workoutLogsData,
        exercisesData,
        membersData
      );
      setLoading(false);
    } catch (error) {
      console.error("Error fetching schedule data:", error);
      setLoading(false);
    }
  };

  const calculateStats = (
    schedulesData,
    workoutLogsData,
    membersData,
    exercisesData
  ) => {
    const totalSchedules = schedulesData.length;
    const activeSchedules = schedulesData.filter(
      (s) => s.status === "active"
    ).length;
    const completedSchedules = schedulesData.filter(
      (s) => s.status === "completed"
    ).length;

    const totalWorkouts = workoutLogsData.length;

    // Members with and without schedules
    const membersWithSchedulesSet = new Set(
      schedulesData.map((s) => s.memberId)
    );
    const membersWithSchedules = membersWithSchedulesSet.size;
    const membersWithoutSchedules = membersData.filter(
      (m) => m.status === "active" && !membersWithSchedulesSet.has(m.id)
    ).length;

    // Average workouts per member
    const avgWorkoutsPerMember =
      membersData.length > 0 ? totalWorkouts / membersData.length : 0;

    // Calculate total volume, weight, and reps from workout logs
    let totalVolume = 0;
    let totalWeight = 0;
    let totalReps = 0;
    let weightCount = 0;

    workoutLogsData.forEach((log) => {
      log.exercises?.forEach((ex) => {
        const weight = ex.weight || 0;
        const reps = ex.actualReps || 0;
        const volume = weight * reps;

        totalVolume += volume;
        totalReps += reps;

        if (weight > 0) {
          totalWeight += weight;
          weightCount++;
        }
      });
    });

    const avgWeight = weightCount > 0 ? totalWeight / weightCount : 0;

    setStats({
      totalSchedules,
      activeSchedules,
      completedSchedules,
      totalWorkouts,
      membersWithSchedules,
      membersWithoutSchedules,
      avgWorkoutsPerMember,
      totalVolume,
      avgWeight,
      totalReps,
    });
  };

  const generateChartData = (
    schedulesData,
    workoutLogsData,
    exercisesData,
    membersData
  ) => {
    // Schedule status distribution
    const scheduleStatus = [
      {
        name: "Active",
        value: schedulesData.filter((s) => s.status === "active").length,
        color: "#10b981",
      },
      {
        name: "Completed",
        value: schedulesData.filter((s) => s.status === "completed").length,
        color: "#3b82f6",
      },
      {
        name: "Upcoming",
        value: schedulesData.filter((s) => s.status === "upcoming").length,
        color: "#f59e0b",
      },
    ].filter((item) => item.value > 0);

    // Day distribution (which days are most scheduled)
    const dayCount = {};
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    days.forEach((day) => {
      dayCount[day] = 0;
    });

    schedulesData.forEach((schedule) => {
      schedule.days?.forEach((day) => {
        if (dayCount[day] !== undefined) {
          dayCount[day]++;
        }
      });
    });

    const dayDistribution = days.map((day) => ({
      day: day.charAt(0).toUpperCase() + day.slice(1),
      count: dayCount[day],
    }));

    // Popular exercises (most used in schedules and workouts)
    const exerciseUsage = {};

    // Count from schedules
    schedulesData.forEach((schedule) => {
      schedule.workouts?.forEach((workout) => {
        workout.exercises?.forEach((ex) => {
          const exerciseId = ex.exerciseId;
          if (exerciseId) {
            exerciseUsage[exerciseId] = (exerciseUsage[exerciseId] || 0) + 1;
          }
        });
      });

      // Count cardio
      schedule.cardio?.forEach((ex) => {
        const exerciseId = ex.exerciseId;
        if (exerciseId) {
          exerciseUsage[exerciseId] = (exerciseUsage[exerciseId] || 0) + 1;
        }
      });

      // Count warmup
      schedule.warmUp?.forEach((ex) => {
        const exerciseId = ex.exerciseId;
        if (exerciseId) {
          exerciseUsage[exerciseId] = (exerciseUsage[exerciseId] || 0) + 1;
        }
      });

      // Count warmdown
      schedule.warmDown?.forEach((ex) => {
        const exerciseId = ex.exerciseId;
        if (exerciseId) {
          exerciseUsage[exerciseId] = (exerciseUsage[exerciseId] || 0) + 1;
        }
      });
    });

    const popularExercises = Object.entries(exerciseUsage)
      .map(([exerciseId, count]) => {
        const exercise = exercisesData.find((e) => e.id === exerciseId);
        return {
          name: exercise?.name || "Unknown",
          count: count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Workout trend (last 30 days)
    const workoutTrend = {};
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      workoutTrend[dateKey] = { date: dateKey, workouts: 0 };
    }

    workoutLogsData.forEach((log) => {
      const completedDate = log.completedAt?.toDate
        ? log.completedAt.toDate()
        : new Date(log.completedAt);

      const dateKey = completedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      if (workoutTrend[dateKey]) {
        workoutTrend[dateKey].workouts++;
      }
    });

    const workoutTrendData = Object.values(workoutTrend);

    // Exercise performance (weight and volume by exercise)
    const exercisePerformance = {};

    workoutLogsData.forEach((log) => {
      log.exercises?.forEach((ex) => {
        const exerciseId = ex.exerciseId;
        const weight = ex.weight || 0;
        const reps = ex.actualReps || 0;
        const volume = weight * reps;

        if (exerciseId) {
          if (!exercisePerformance[exerciseId]) {
            exercisePerformance[exerciseId] = {
              weights: [],
              volumes: [],
              reps: [],
            };
          }
          if (weight > 0) {
            exercisePerformance[exerciseId].weights.push(weight);
          }
          if (volume > 0) {
            exercisePerformance[exerciseId].volumes.push(volume);
          }
          if (reps > 0) {
            exercisePerformance[exerciseId].reps.push(reps);
          }
        }
      });
    });

    const exercisePerformanceData = Object.entries(exercisePerformance)
      .map(([exerciseId, data]) => {
        const exercise = exercisesData.find((e) => e.id === exerciseId);
        return {
          name: exercise?.name || "Unknown",
          avgWeight:
            data.weights.length > 0
              ? (
                  data.weights.reduce((a, b) => a + b, 0) / data.weights.length
                ).toFixed(1)
              : 0,
          avgVolume:
            data.volumes.length > 0
              ? (
                  data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length
                ).toFixed(0)
              : 0,
          avgReps:
            data.reps.length > 0
              ? Math.round(
                  data.reps.reduce((a, b) => a + b, 0) / data.reps.length
                )
              : 0,
        };
      })
      .filter((item) => parseFloat(item.avgWeight) > 0)
      .sort((a, b) => parseFloat(b.avgVolume) - parseFloat(a.avgVolume))
      .slice(0, 10);

    // Member activity (top active members)
    const memberWorkoutCount = {};
    workoutLogsData.forEach((log) => {
      const memberId = log.memberId;
      if (memberId) {
        memberWorkoutCount[memberId] = (memberWorkoutCount[memberId] || 0) + 1;
      }
    });

    const memberActivity = Object.entries(memberWorkoutCount)
      .map(([memberId, count]) => {
        const member = membersData.find((m) => m.id === memberId);
        return {
          name: member?.name || "Unknown",
          workouts: count,
        };
      })
      .sort((a, b) => b.workouts - a.workouts)
      .slice(0, 10);

    // Volume by exercise (total volume lifted per exercise)
    const volumeByExercise = Object.entries(exercisePerformance)
      .map(([exerciseId, data]) => {
        const exercise = exercisesData.find((e) => e.id === exerciseId);
        const totalVolume = data.volumes.reduce((a, b) => a + b, 0);
        return {
          name: exercise?.name || "Unknown",
          volume: totalVolume,
        };
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 8);

    // Weekly progress (last 4 weeks)
    const weeklyProgress = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);

      const weekWorkouts = workoutLogsData.filter((log) => {
        const completedDate = log.completedAt?.toDate
          ? log.completedAt.toDate()
          : new Date(log.completedAt);
        return completedDate >= weekStart && completedDate <= weekEnd;
      });

      let weekVolume = 0;
      let weekReps = 0;

      weekWorkouts.forEach((log) => {
        log.exercises?.forEach((ex) => {
          const weight = ex.weight || 0;
          const reps = ex.actualReps || 0;
          weekVolume += weight * reps;
          weekReps += reps;
        });
      });

      weeklyProgress.push({
        week: `Week ${4 - i}`,
        workouts: weekWorkouts.length,
        volume: weekVolume,
        reps: weekReps,
      });
    }

    setChartData({
      scheduleStatus,
      dayDistribution,
      popularExercises,
      workoutTrend: workoutTrendData,
      exercisePerformance: exercisePerformanceData,
      memberActivity,
      volumeByExercise,
      weeklyProgress,
    });
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading schedule analytics...</p>
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
                    Schedule & Workout Analytics
                  </h1>
                </div>
                <p className="text-gray-400 text-sm hidden sm:block">
                  Analyze workout schedules and exercise performance
                </p>
              </div>
            </div>

            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </header>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Schedules"
              value={stats.totalSchedules}
              subtitle={`${stats.activeSchedules} active, ${stats.completedSchedules} completed`}
              color="bg-purple-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              }
            />

            <StatCard
              title="Total Workouts"
              value={stats.totalWorkouts}
              subtitle={`${stats.avgWorkoutsPerMember.toFixed(
                1
              )} avg per member`}
              color="bg-blue-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              }
            />

            <StatCard
              title="Total Volume"
              value={`${(stats.totalVolume / 1000).toFixed(1)}k`}
              subtitle={`${stats.totalReps.toLocaleString()} total reps`}
              color="bg-orange-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              }
            />

            <StatCard
              title="Members with Schedules"
              value={stats.membersWithSchedules}
              subtitle={`${stats.membersWithoutSchedules} without schedules`}
              color="bg-green-600"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              }
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Workout Trend */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Workout Trend (Last 30 Days)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.workoutTrend}>
                  <defs>
                    <linearGradient
                      id="colorWorkouts"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="workouts"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorWorkouts)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Schedule Status */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Schedule Status Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.scheduleStatus}
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
                    {chartData.scheduleStatus.map((entry, index) => (
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

            {/* Day Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Training Days Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.dayDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Popular Exercises */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Most Popular Exercises
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.popularExercises} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#9ca3af"
                    width={100}
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
          </div>

          {/* Exercise Performance with Weight & Reps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Exercise Performance Stats */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Exercise Performance (Avg Weight & Reps)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.exercisePerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="name"
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
                  <Legend />
                  <Bar
                    dataKey="avgWeight"
                    fill="#f59e0b"
                    name="Avg Weight (kg)"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="avgReps"
                    fill="#06b6d4"
                    name="Avg Reps"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Total Volume by Exercise */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Total Volume by Exercise
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.volumeByExercise}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="name"
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
                    formatter={(value) => `${value.toLocaleString()} kg`}
                  />
                  <Bar dataKey="volume" fill="#ec4899" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Member Activity & Weekly Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top Active Members */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Most Active Members
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.memberActivity} layout="vertical">
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
                  <Bar
                    dataKey="workouts"
                    fill="#8b5cf6"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Progress */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Weekly Progress (Last 4 Weeks)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.weeklyProgress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="week" stroke="#9ca3af" />
                  <YAxis yAxisId="left" stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="workouts"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Workouts"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="volume"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Volume"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Insights Section */}
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-600/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-purple-400"
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
              Workout Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Schedule Coverage</p>
                <p className="text-white font-semibold">
                  {(
                    (stats.membersWithSchedules /
                      (stats.membersWithSchedules +
                        stats.membersWithoutSchedules)) *
                    100
                  ).toFixed(1)}
                  % Members
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.membersWithSchedules} out of{" "}
                  {stats.membersWithSchedules + stats.membersWithoutSchedules}{" "}
                  have schedules
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Avg Weight Used</p>
                <p className="text-white font-semibold">
                  {stats.avgWeight.toFixed(1)} kg
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Across all exercises
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">
                  Total Training Volume
                </p>
                <p className="text-white font-semibold">
                  {(stats.totalVolume / 1000).toFixed(1)}k kg
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {stats.totalReps.toLocaleString()} total reps completed
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ScheduleAnalytics;
