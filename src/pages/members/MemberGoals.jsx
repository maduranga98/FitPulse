import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import MemberLayout from "../../components/MemberLayout";
import {
  Target,
  Plus,
  Trophy,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Circle,
  X,
  Edit,
  Trash2,
  Flag,
  Award,
} from "lucide-react";

const MemberGoals = () => {
  const { user: currentUser } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const [goalForm, setGoalForm] = useState({
    goalType: "weight_loss",
    title: "",
    targetValue: "",
    currentValue: "",
    startValue: "",
    unit: "kg",
    deadline: "",
    notes: "",
  });

  const goalTypes = [
    { value: "weight_loss", label: "Weight Loss", icon: "📉", unit: "kg" },
    { value: "muscle_gain", label: "Muscle Gain", icon: "💪", unit: "kg" },
    { value: "strength", label: "Strength", icon: "🏋️", unit: "kg" },
    { value: "endurance", label: "Endurance", icon: "🏃", unit: "min" },
    { value: "body_fat", label: "Body Fat %", icon: "📊", unit: "%" },
    { value: "custom", label: "Custom Goal", icon: "🎯", unit: "" },
  ];

  const goalTemplates = {
    beginner: [
      {
        title: "Lose 5kg in 2 months",
        goalType: "weight_loss",
        targetValue: -5,
        unit: "kg",
        duration: 60,
      },
      {
        title: "Work out 3 times per week",
        goalType: "endurance",
        targetValue: 12,
        unit: "workouts",
        duration: 30,
      },
      {
        title: "Run 5K without stopping",
        goalType: "endurance",
        targetValue: 30,
        unit: "min",
        duration: 90,
      },
    ],
    intermediate: [
      {
        title: "Lose 10kg in 3 months",
        goalType: "weight_loss",
        targetValue: -10,
        unit: "kg",
        duration: 90,
      },
      {
        title: "Bench press bodyweight",
        goalType: "strength",
        targetValue: 80,
        unit: "kg",
        duration: 120,
      },
      {
        title: "Reduce body fat to 15%",
        goalType: "body_fat",
        targetValue: 15,
        unit: "%",
        duration: 120,
      },
    ],
    advanced: [
      {
        title: "Compete in bodybuilding show",
        goalType: "muscle_gain",
        targetValue: 10,
        unit: "kg",
        duration: 180,
      },
      {
        title: "Deadlift 2x bodyweight",
        goalType: "strength",
        targetValue: 160,
        unit: "kg",
        duration: 180,
      },
      {
        title: "Run marathon under 4 hours",
        goalType: "endurance",
        targetValue: 240,
        unit: "min",
        duration: 180,
      },
    ],
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      const goalsQuery = query(
        collection(db, "memberGoals"),
        where("memberId", "==", currentUser.id),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(goalsQuery);
      const goalsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        deadline: doc.data().deadline?.toDate
          ? doc.data().deadline.toDate()
          : new Date(doc.data().deadline),
        createdAt: doc.data().createdAt?.toDate
          ? doc.data().createdAt.toDate()
          : new Date(doc.data().createdAt),
      }));

      setGoals(goalsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching goals:", error);
      setLoading(false);
    }
  };

  const handleAddGoal = async (e) => {
    e.preventDefault();

    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      const goalData = {
        memberId: currentUser.id,
        gymId: currentUser.gymId,
        goalType: goalForm.goalType,
        title: goalForm.title,
        targetValue: parseFloat(goalForm.targetValue),
        currentValue: parseFloat(goalForm.currentValue),
        startValue: parseFloat(goalForm.startValue),
        unit: goalForm.unit,
        deadline: Timestamp.fromDate(new Date(goalForm.deadline)),
        status: "active",
        progress: 0,
        milestones: generateMilestones(
          parseFloat(goalForm.startValue),
          parseFloat(goalForm.targetValue)
        ),
        notes: goalForm.notes,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "memberGoals"), goalData);

      setGoalForm({
        goalType: "weight_loss",
        title: "",
        targetValue: "",
        currentValue: "",
        startValue: "",
        unit: "kg",
        deadline: "",
        notes: "",
      });
      setShowAddGoal(false);
      setShowTemplates(false);
      fetchGoals();
      alert("Goal created successfully! 🎯");
    } catch (error) {
      console.error("Error creating goal:", error);
      alert("Failed to create goal. Please try again.");
    }
  };

  const handleUpdateGoalProgress = async (goalId, newCurrentValue) => {
    try {
      const { db } = await import("../../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      const goal = goals.find((g) => g.id === goalId);
      const progress = calculateProgress(
        goal.startValue,
        newCurrentValue,
        goal.targetValue
      );

      // Update milestones
      const updatedMilestones = goal.milestones.map((milestone) => {
        if (!milestone.achieved) {
          const milestoneReached = checkMilestoneReached(
            goal.startValue,
            newCurrentValue,
            milestone.value,
            goal.goalType
          );
          if (milestoneReached) {
            return {
              ...milestone,
              achieved: true,
              achievedAt: new Date(),
            };
          }
        }
        return milestone;
      });

      // Check if goal is completed
      const goalCompleted = progress >= 100;

      await updateDoc(doc(db, "memberGoals", goalId), {
        currentValue: newCurrentValue,
        progress: progress,
        milestones: updatedMilestones,
        status: goalCompleted ? "completed" : "active",
        completedAt: goalCompleted ? new Date() : null,
      });

      fetchGoals();

      if (goalCompleted) {
        alert("🎉 Congratulations! You've achieved your goal!");
      }
    } catch (error) {
      console.error("Error updating goal:", error);
      alert("Failed to update goal. Please try again.");
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm("Are you sure you want to delete this goal?")) {
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "memberGoals", goalId));
      fetchGoals();
      alert("Goal deleted successfully!");
    } catch (error) {
      console.error("Error deleting goal:", error);
      alert("Failed to delete goal. Please try again.");
    }
  };

  const generateMilestones = (startValue, targetValue) => {
    const milestones = [];
    const diff = targetValue - startValue;
    const steps = 4; // 25%, 50%, 75%, 100%

    for (let i = 1; i <= steps; i++) {
      const milestoneValue = startValue + (diff * i) / steps;
      milestones.push({
        percentage: (i / steps) * 100,
        value: milestoneValue,
        achieved: false,
        achievedAt: null,
      });
    }

    return milestones;
  };

  const calculateProgress = (startValue, currentValue, targetValue) => {
    const totalChange = targetValue - startValue;
    const currentChange = currentValue - startValue;
    const progress = (currentChange / totalChange) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const checkMilestoneReached = (startValue, currentValue, milestoneValue, goalType) => {
    // For weight loss or body fat reduction, we're going down
    if (goalType === "weight_loss" || goalType === "body_fat") {
      return currentValue <= milestoneValue;
    }
    // For gains, we're going up
    return currentValue >= milestoneValue;
  };

  const applyTemplate = (template) => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + template.duration);

    setGoalForm({
      goalType: template.goalType,
      title: template.title,
      targetValue: template.targetValue.toString(),
      currentValue: "0",
      startValue: "0",
      unit: template.unit,
      deadline: deadline.toISOString().split("T")[0],
      notes: "",
    });
    setShowTemplates(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "text-green-400 bg-green-900/30 border-green-500";
      case "active":
        return "text-blue-400 bg-blue-900/30 border-blue-500";
      case "failed":
        return "text-red-400 bg-red-900/30 border-red-500";
      default:
        return "text-gray-400 bg-gray-900/30 border-gray-500";
    }
  };

  const getProgressColor = (progress) => {
    if (progress >= 75) return "bg-green-500";
    if (progress >= 50) return "bg-blue-500";
    if (progress >= 25) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  if (loading) {
    return (
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your goals...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout>
      <div className="min-h-full bg-gray-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center gap-2">
                  <Target className="w-8 h-8" />
                  My Goals
                </h1>
                <p className="text-sm sm:text-base text-white/80">
                  Set goals, track progress, and achieve greatness
                </p>
              </div>
              <button
                onClick={() => setShowAddGoal(true)}
                className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-white text-indigo-600 rounded-lg font-medium hover:bg-gray-100 transition flex items-center justify-center gap-2 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>New Goal</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="text-2xl sm:text-3xl mb-2">🎯</div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {activeGoals.length}
              </div>
              <div className="text-xs sm:text-sm text-blue-100">Active Goals</div>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="text-2xl sm:text-3xl mb-2">🏆</div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {completedGoals.length}
              </div>
              <div className="text-xs sm:text-sm text-green-100">Completed</div>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="text-2xl sm:text-3xl mb-2">📈</div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {activeGoals.length > 0
                  ? Math.round(
                      activeGoals.reduce((sum, g) => sum + g.progress, 0) /
                        activeGoals.length
                    )
                  : 0}
                %
              </div>
              <div className="text-xs sm:text-sm text-purple-100">
                Avg Progress
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="text-2xl sm:text-3xl mb-2">⏰</div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {activeGoals.filter((g) => {
                  const daysLeft =
                    (g.deadline - new Date()) / (1000 * 60 * 60 * 24);
                  return daysLeft < 7;
                }).length}
              </div>
              <div className="text-xs sm:text-sm text-orange-100">
                Due This Week
              </div>
            </div>
          </div>

          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Flag className="w-5 h-5 text-blue-400" />
                Active Goals
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeGoals.map((goal) => {
                  const daysLeft = Math.ceil(
                    (goal.deadline - new Date()) / (1000 * 60 * 60 * 24)
                  );
                  const goalType = goalTypes.find((t) => t.value === goal.goalType);

                  return (
                    <div
                      key={goal.id}
                      className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-indigo-500 transition"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="text-3xl">{goalType?.icon}</div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1">
                              {goal.title}
                            </h3>
                            <p className="text-sm text-gray-400">
                              {goalType?.label}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="text-gray-400 hover:text-red-400 p-2 hover:bg-red-900/20 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Progress</span>
                          <span className="text-sm font-bold text-white">
                            {goal.progress.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3">
                          <div
                            className={`${getProgressColor(
                              goal.progress
                            )} h-3 rounded-full transition-all duration-500`}
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Goal Details */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-1">Start</p>
                          <p className="text-sm font-bold text-white">
                            {goal.startValue} {goal.unit}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-1">Current</p>
                          <p className="text-sm font-bold text-blue-400">
                            {goal.currentValue} {goal.unit}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-1">Target</p>
                          <p className="text-sm font-bold text-green-400">
                            {goal.targetValue} {goal.unit}
                          </p>
                        </div>
                      </div>

                      {/* Milestones */}
                      <div className="mb-4">
                        <p className="text-xs text-gray-400 mb-2">Milestones</p>
                        <div className="flex gap-2">
                          {goal.milestones.map((milestone, index) => (
                            <div key={index} className="flex-1">
                              <div
                                className={`h-2 rounded-full ${
                                  milestone.achieved
                                    ? "bg-green-500"
                                    : "bg-gray-700"
                                }`}
                              />
                              <p className="text-xs text-gray-500 mt-1 text-center">
                                {milestone.percentage}%
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Deadline */}
                      <div className="flex items-center justify-between border-t border-gray-700 pt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {daysLeft > 0 ? `${daysLeft} days left` : "Overdue"}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedGoal(goal)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                        >
                          Update Progress
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-green-400" />
                Completed Goals
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedGoals.map((goal) => {
                  const goalType = goalTypes.find((t) => t.value === goal.goalType);

                  return (
                    <div
                      key={goal.id}
                      className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-500/30 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="text-2xl">{goalType?.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-bold text-white mb-1">{goal.title}</h3>
                          <p className="text-xs text-gray-400">{goalType?.label}</p>
                        </div>
                        <Award className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="text-sm text-gray-400">
                        Achieved: {goal.targetValue} {goal.unit}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {goals.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-white mb-2">No Goals Yet</h3>
              <p className="text-gray-400 mb-6">
                Start your fitness journey by setting your first goal!
              </p>
              <button
                onClick={() => setShowTemplates(true)}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition"
              >
                Browse Goal Templates
              </button>
            </div>
          )}
        </div>

        {/* Add Goal Modal */}
        {showAddGoal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full my-8">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Target className="w-6 h-6" />
                    Create New Goal
                  </h2>
                  <button
                    onClick={() => setShowAddGoal(false)}
                    className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddGoal} className="p-6">
                {!showTemplates && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setShowTemplates(true)}
                      className="w-full py-3 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500 text-indigo-300 rounded-lg font-medium transition"
                    >
                      Or Browse Goal Templates
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Goal Type *
                    </label>
                    <select
                      value={goalForm.goalType}
                      onChange={(e) => {
                        const type = goalTypes.find((t) => t.value === e.target.value);
                        setGoalForm({
                          ...goalForm,
                          goalType: e.target.value,
                          unit: type?.unit || "",
                        });
                      }}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      {goalTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Goal Title *
                    </label>
                    <input
                      type="text"
                      value={goalForm.title}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, title: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Lose 10kg for summer"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Start Value *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={goalForm.startValue}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, startValue: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="75"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Current Value *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={goalForm.currentValue}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, currentValue: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="75"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Target Value *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={goalForm.targetValue}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, targetValue: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="65"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Unit *
                    </label>
                    <input
                      type="text"
                      value={goalForm.unit}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, unit: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="kg"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Deadline *
                    </label>
                    <input
                      type="date"
                      value={goalForm.deadline}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, deadline: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={goalForm.notes}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, notes: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Why is this goal important to you?"
                      rows="3"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddGoal(false)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition"
                  >
                    Create Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Goal Templates Modal */}
        {showTemplates && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl max-w-4xl w-full my-8">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Goal Templates</h2>
                  <button
                    onClick={() => setShowTemplates(false)}
                    className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {Object.entries(goalTemplates).map(([level, templates]) => (
                  <div key={level} className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-3 capitalize">
                      {level} Level
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {templates.map((template, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            applyTemplate(template);
                            setShowAddGoal(true);
                          }}
                          className="bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-indigo-500 rounded-lg p-4 text-left transition"
                        >
                          <h4 className="font-bold text-white mb-2">
                            {template.title}
                          </h4>
                          <p className="text-sm text-gray-400">
                            {template.duration} days • {template.targetValue}{" "}
                            {template.unit}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Update Progress Modal */}
        {selectedGoal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-md w-full">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Update Progress</h2>
                  <button
                    onClick={() => setSelectedGoal(null)}
                    className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const newValue = parseFloat(e.target.newValue.value);
                    handleUpdateGoalProgress(selectedGoal.id, newValue);
                    setSelectedGoal(null);
                  }}
                >
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Current {selectedGoal.unit}
                    </label>
                    <input
                      type="number"
                      name="newValue"
                      step="0.1"
                      defaultValue={selectedGoal.currentValue}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4 mb-6">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>Start: {selectedGoal.startValue}</span>
                      <span>Target: {selectedGoal.targetValue}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-2xl font-bold text-white">
                        {selectedGoal.progress.toFixed(0)}%
                      </span>
                      <span className="text-sm text-gray-400 ml-2">complete</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedGoal(null)}
                      className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition"
                    >
                      Update
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </MemberLayout>
  );
};

export default MemberGoals;
