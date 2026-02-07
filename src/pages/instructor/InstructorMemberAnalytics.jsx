import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import {
  TrendingUp,
  ArrowLeft,
  Users,
  Activity,
  Target,
  Award,
  ChevronDown,
} from "lucide-react";
import {
  LineChart,
  Line,
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
} from "recharts";

const InstructorMemberAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentGymId = user?.gymId;

  // State management
  const [members, setMembers] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [bodyMetrics, setBodyMetrics] = useState([]);
  const [exerciseAssignments, setExerciseAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState("all");
  const [timeRange, setTimeRange] = useState("30"); // days

  useEffect(() => {
    if (currentGymId) {
      fetchData();
    }
  }, [currentGymId]);

  const fetchData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch active members
      const membersSnapshot = await getDocs(
        query(
          collection(db, "members"),
          where("gymId", "==", currentGymId),
          where("status", "==", "active")
        )
      );
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch workout logs
      const workoutLogsSnapshot = await getDocs(
        query(
          collection(db, "workout_logs"),
          orderBy("date", "desc")
        )
      );
      const workoutLogsData = workoutLogsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((log) => {
          const member = membersData.find((m) => m.id === log.memberId);
          return member !== undefined;
        });

      // Fetch body metrics
      const bodyMetricsSnapshot = await getDocs(
        query(
          collection(db, "member_body_metrics"),
          orderBy("date", "desc")
        )
      );
      const bodyMetricsData = bodyMetricsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((metric) => {
          const member = membersData.find((m) => m.id === metric.memberId);
          return member !== undefined;
        });

      // Fetch exercise assignments
      const assignmentsSnapshot = await getDocs(
        query(
          collection(db, "exercise_assignments"),
          where("gymId", "==", currentGymId)
        )
      );
      const assignmentsData = assignmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setMembers(membersData);
      setWorkoutLogs(workoutLogsData);
      setBodyMetrics(bodyMetricsData);
      setExerciseAssignments(assignmentsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      setLoading(false);
    }
  };

  const getFilteredData = () => {
    if (selectedMember === "all") {
      return {
        members,
        workoutLogs,
        bodyMetrics,
        assignments: exerciseAssignments,
      };
    }

    return {
      members: members.filter((m) => m.id === selectedMember),
      workoutLogs: workoutLogs.filter((w) => w.memberId === selectedMember),
      bodyMetrics: bodyMetrics.filter((b) => b.memberId === selectedMember),
      assignments: exerciseAssignments.filter(
        (a) => a.memberId === selectedMember
      ),
    };
  };

  const calculateStats = () => {
    const filtered = getFilteredData();

    // Calculate attendance rate (workout logs in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentWorkouts = filtered.workoutLogs.filter((log) => {
      const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
      return logDate >= thirtyDaysAgo;
    });

    const uniqueMembers = new Set(recentWorkouts.map((w) => w.memberId)).size;
    const totalMembers = filtered.members.length;
    const attendanceRate =
      totalMembers > 0 ? Math.round((uniqueMembers / totalMembers) * 100) : 0;

    // Calculate average BMI
    const latestBMIs = {};
    filtered.bodyMetrics.forEach((metric) => {
      if (
        metric.bmi &&
        (!latestBMIs[metric.memberId] ||
          metric.date?.toDate() > latestBMIs[metric.memberId].date?.toDate())
      ) {
        latestBMIs[metric.memberId] = metric;
      }
    });

    const bmiValues = Object.values(latestBMIs).map((m) => m.bmi);
    const avgBMI =
      bmiValues.length > 0
        ? (bmiValues.reduce((a, b) => a + b, 0) / bmiValues.length).toFixed(1)
        : "N/A";

    // Calculate completion rate
    const completedAssignments = filtered.assignments.filter(
      (a) => a.status === "completed"
    ).length;
    const totalAssignments = filtered.assignments.length;
    const completionRate =
      totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0;

    return {
      totalMembers,
      attendanceRate,
      avgBMI,
      completionRate,
    };
  };

  const getWeightProgressData = () => {
    const filtered = getFilteredData();
    const weightByMember = {};

    filtered.bodyMetrics.forEach((metric) => {
      if (metric.weight && metric.date) {
        if (!weightByMember[metric.memberId]) {
          weightByMember[metric.memberId] = [];
        }
        weightByMember[metric.memberId].push({
          date: metric.date.toDate
            ? metric.date.toDate()
            : new Date(metric.date),
          weight: metric.weight,
          memberName:
            members.find((m) => m.id === metric.memberId)?.name || "Unknown",
        });
      }
    });

    // Sort by date and get last 10 entries
    const allWeightData = [];
    Object.entries(weightByMember).forEach(([memberId, data]) => {
      const sorted = data.sort((a, b) => a.date - b.date).slice(-10);
      allWeightData.push(...sorted);
    });

    // Group by date and average
    const dateMap = {};
    allWeightData.forEach((item) => {
      const dateKey = item.date.toLocaleDateString();
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { date: dateKey, weights: [], count: 0 };
      }
      dateMap[dateKey].weights.push(item.weight);
      dateMap[dateKey].count++;
    });

    return Object.values(dateMap)
      .map((item) => ({
        date: item.date,
        weight:
          item.weights.reduce((a, b) => a + b, 0) / item.weights.length,
      }))
      .slice(-7);
  };

  const getBMIProgressData = () => {
    const filtered = getFilteredData();
    const bmiByDate = {};

    filtered.bodyMetrics.forEach((metric) => {
      if (metric.bmi && metric.date) {
        const dateKey = (
          metric.date.toDate ? metric.date.toDate() : new Date(metric.date)
        ).toLocaleDateString();
        if (!bmiByDate[dateKey]) {
          bmiByDate[dateKey] = { date: dateKey, bmis: [] };
        }
        bmiByDate[dateKey].bmis.push(metric.bmi);
      }
    });

    return Object.values(bmiByDate)
      .map((item) => ({
        date: item.date,
        bmi: (item.bmis.reduce((a, b) => a + b, 0) / item.bmis.length).toFixed(
          1
        ),
      }))
      .slice(-7);
  };

  const getWorkoutDistribution = () => {
    const filtered = getFilteredData();

    const statusCount = {
      Completed: filtered.assignments.filter((a) => a.status === "completed")
        .length,
      "In Progress": filtered.assignments.filter(
        (a) => a.status === "in_progress"
      ).length,
      Pending: filtered.assignments.filter((a) => a.status === "pending")
        .length,
    };

    return Object.entries(statusCount).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const getWorkoutFrequencyData = () => {
    const filtered = getFilteredData();
    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString();

      const workoutsOnDate = filtered.workoutLogs.filter((log) => {
        const logDate = log.date?.toDate
          ? log.date.toDate()
          : new Date(log.date);
        return logDate.toLocaleDateString() === dateKey;
      }).length;

      last7Days.push({
        date: dateKey.split("/").slice(0, 2).join("/"),
        workouts: workoutsOnDate,
      });
    }

    return last7Days;
  };

  const stats = calculateStats();
  const COLORS = ["#10b981", "#3b82f6", "#6366f1", "#8b5cf6"];

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/instructor-dashboard")}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">
            Member Analytics
          </h1>
          <p className="text-gray-400">
            Track member progress, BMI, weight, and workout performance
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative">
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
            >
              <option value="all">All Members</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-blue-100 text-sm">Total Members</p>
                <p className="text-3xl font-bold">{stats.totalMembers}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-green-100 text-sm">Attendance Rate</p>
                <p className="text-3xl font-bold">{stats.attendanceRate}%</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-purple-100 text-sm">Average BMI</p>
                <p className="text-3xl font-bold">{stats.avgBMI}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-orange-100 text-sm">Completion Rate</p>
                <p className="text-3xl font-bold">{stats.completionRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* BMI Progress Chart */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-white font-bold text-lg mb-4">
              BMI Progress (Last 7 Days)
            </h3>
            {getBMIProgressData().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getBMIProgressData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="bmi"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="BMI"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-gray-400">No BMI data available</p>
              </div>
            )}
          </div>

          {/* Weight Progress Chart */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-white font-bold text-lg mb-4">
              Weight Progress (Last 7 Days)
            </h3>
            {getWeightProgressData().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getWeightProgressData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Weight (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-gray-400">No weight data available</p>
              </div>
            )}
          </div>

          {/* Workout Frequency Chart */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-white font-bold text-lg mb-4">
              Workout Frequency (Last 7 Days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getWorkoutFrequencyData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="workouts" fill="#3b82f6" name="Workouts" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Exercise Completion Distribution */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-white font-bold text-lg mb-4">
              Exercise Assignment Status
            </h3>
            {getWorkoutDistribution().some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={getWorkoutDistribution()}
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
                    {getWorkoutDistribution().map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-gray-400">
                  No exercise assignments yet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Member List */}
        {selectedMember === "all" && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-white font-bold text-lg mb-4">
              Member Overview
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 font-medium pb-3">
                      Member
                    </th>
                    <th className="text-left text-gray-400 font-medium pb-3">
                      Latest BMI
                    </th>
                    <th className="text-left text-gray-400 font-medium pb-3">
                      Latest Weight
                    </th>
                    <th className="text-left text-gray-400 font-medium pb-3">
                      Workouts (30d)
                    </th>
                    <th className="text-left text-gray-400 font-medium pb-3">
                      Assignments
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const memberMetrics = bodyMetrics.filter(
                      (m) => m.memberId === member.id
                    );
                    const latestMetric = memberMetrics.sort(
                      (a, b) =>
                        (b.date?.toDate?.() || new Date(b.date)) -
                        (a.date?.toDate?.() || new Date(a.date))
                    )[0];

                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    const recentWorkouts = workoutLogs.filter((w) => {
                      if (w.memberId !== member.id) return false;
                      const logDate = w.date?.toDate
                        ? w.date.toDate()
                        : new Date(w.date);
                      return logDate >= thirtyDaysAgo;
                    }).length;

                    const memberAssignments = exerciseAssignments.filter(
                      (a) => a.memberId === member.id
                    );
                    const completed = memberAssignments.filter(
                      (a) => a.status === "completed"
                    ).length;

                    return (
                      <tr
                        key={member.id}
                        className="border-b border-gray-700 last:border-0 hover:bg-gray-700/50 transition"
                      >
                        <td className="py-3 text-white">{member.name}</td>
                        <td className="py-3 text-white">
                          {latestMetric?.bmi?.toFixed(1) || "N/A"}
                        </td>
                        <td className="py-3 text-white">
                          {latestMetric?.weight
                            ? `${latestMetric.weight} kg`
                            : "N/A"}
                        </td>
                        <td className="py-3 text-white">{recentWorkouts}</td>
                        <td className="py-3 text-white">
                          {completed}/{memberAssignments.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorMemberAnalytics;
