import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import MemberLayout from "../../components/MemberLayout";
import { Calendar, CheckCircle, Circle, TrendingUp, Target } from "lucide-react";

const MemberMealPlans = () => {
  const { user: currentUser } = useAuth();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  useEffect(() => {
    fetchMealPlans();
  }, []);

  const fetchMealPlans = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import("firebase/firestore");

      // Fetch meal plan assignments
      const assignmentsQuery = query(
        collection(db, "mealPlanAssignments"),
        where("memberId", "==", currentUser.id),
        orderBy("assignedAt", "desc")
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentsData = assignmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch full meal plan details for each assignment
      const assignmentsWithDetails = await Promise.all(
        assignmentsData.map(async (assignment) => {
          const { doc: docRef, getDoc } = await import("firebase/firestore");
          const planDoc = await getDoc(docRef(db, "mealPlans", assignment.mealPlanId));
          if (planDoc.exists()) {
            return {
              ...assignment,
              mealPlan: { id: planDoc.id, ...planDoc.data() },
            };
          }
          return assignment;
        })
      );

      setAssignments(assignmentsWithDetails.filter((a) => a.mealPlan));
      if (assignmentsWithDetails.length > 0 && assignmentsWithDetails[0].mealPlan) {
        setSelectedAssignment(assignmentsWithDetails[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching meal plans:", error);
      setLoading(false);
    }
  };

  const handleToggleMealItem = async (mealIndex, itemIndex) => {
    if (!selectedAssignment) return;

    try {
      const { db } = await import("../../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      const today = new Date().toISOString().split("T")[0];
      const progressKey = `${today}_meal${mealIndex}_item${itemIndex}`;

      // Get current progress array
      const currentProgress = selectedAssignment.progress || [];
      const progressIndex = currentProgress.findIndex((p) => p.key === progressKey);

      let newProgress;
      if (progressIndex >= 0) {
        // Toggle: remove if exists
        newProgress = currentProgress.filter((p) => p.key !== progressKey);
      } else {
        // Add new progress entry
        newProgress = [
          ...currentProgress,
          {
            key: progressKey,
            date: today,
            mealIndex,
            itemIndex,
            completedAt: new Date().toISOString(),
          },
        ];
      }

      await updateDoc(doc(db, "mealPlanAssignments", selectedAssignment.id), {
        progress: newProgress,
      });

      // Update local state
      setSelectedAssignment({
        ...selectedAssignment,
        progress: newProgress,
      });

      // Update in assignments array
      setAssignments(
        assignments.map((a) =>
          a.id === selectedAssignment.id ? { ...a, progress: newProgress } : a
        )
      );
    } catch (error) {
      console.error("Error updating progress:", error);
      alert("Failed to update progress. Please try again.");
    }
  };

  const isMealItemCompleted = (mealIndex, itemIndex) => {
    if (!selectedAssignment) return false;
    const today = new Date().toISOString().split("T")[0];
    const progressKey = `${today}_meal${mealIndex}_item${itemIndex}`;
    return (selectedAssignment.progress || []).some((p) => p.key === progressKey);
  };

  const getTodayProgress = () => {
    if (!selectedAssignment || !selectedAssignment.mealPlan) return { completed: 0, total: 0 };

    const today = new Date().toISOString().split("T")[0];
    const todayProgress = (selectedAssignment.progress || []).filter((p) => p.date === today);

    const totalItems = selectedAssignment.mealPlan.meals.reduce(
      (sum, meal) => sum + (meal.items?.length || 0),
      0
    );

    return {
      completed: todayProgress.length,
      total: totalItems,
    };
  };

  if (loading) {
    return (
      <MemberLayout>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading meal plans...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  if (assignments.length === 0) {
    return (
      <MemberLayout>
        <div className="min-h-screen bg-gray-900 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 mb-6">
              <h1 className="text-3xl font-bold text-white mb-2">My Meal Plans</h1>
              <p className="text-white/80">Track your nutrition and meal progress</p>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
              <div className="text-6xl mb-4">🍽️</div>
              <h3 className="text-xl font-bold text-white mb-2">No Meal Plans Assigned</h3>
              <p className="text-gray-400">
                Contact your gym administrator to get a personalized meal plan.
              </p>
            </div>
          </div>
        </div>
      </MemberLayout>
    );
  }

  const progress = getTodayProgress();
  const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <MemberLayout>
      <div className="min-h-screen bg-gray-900 p-6 pb-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">My Meal Plans</h1>
            <p className="text-white/80">Track your nutrition and meal progress</p>
          </div>

          {/* Today's Progress */}
          {selectedAssignment && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">Today's Progress</h2>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-green-600 to-emerald-600 h-3 rounded-full transition-all"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
                <div className="text-white font-bold">
                  {progress.completed}/{progress.total}
                </div>
              </div>
              <p className="text-sm text-gray-400">
                {progressPercentage === 100
                  ? "Great job! You've completed all meals for today! 🎉"
                  : `Keep going! ${progress.total - progress.completed} items remaining`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Meal Plans List */}
            <div className="lg:col-span-1">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <h2 className="text-lg font-bold text-white mb-4">Your Meal Plans</h2>
                <div className="space-y-2">
                  {assignments.map((assignment) => (
                    <button
                      key={assignment.id}
                      onClick={() => setSelectedAssignment(assignment)}
                      className={`w-full text-left p-4 rounded-lg transition ${
                        selectedAssignment?.id === assignment.id
                          ? "bg-green-600 text-white"
                          : "bg-gray-900 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <p className="font-medium">{assignment.mealPlan.name}</p>
                      {assignment.mealPlan.targetCalories && (
                        <p className="text-xs mt-1 opacity-80">
                          🎯 {assignment.mealPlan.targetCalories} cal/day
                        </p>
                      )}
                      <p className="text-xs mt-1 opacity-80">
                        {assignment.mealPlan.duration} days duration
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Meal Details */}
            <div className="lg:col-span-2">
              {selectedAssignment && selectedAssignment.mealPlan && (
                <div className="space-y-4">
                  {/* Plan Info */}
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {selectedAssignment.mealPlan.name}
                    </h2>
                    {selectedAssignment.mealPlan.description && (
                      <p className="text-gray-400 mb-4">
                        {selectedAssignment.mealPlan.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4">
                      {selectedAssignment.mealPlan.targetCalories && (
                        <div className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-green-400" />
                          <span className="text-gray-300">
                            {selectedAssignment.mealPlan.targetCalories} calories/day
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-green-400" />
                        <span className="text-gray-300">
                          {selectedAssignment.mealPlan.duration} days
                        </span>
                      </div>
                    </div>
                    {selectedAssignment.mealPlan.notes && (
                      <div className="mt-4 p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                        <p className="text-yellow-600/90 text-sm">
                          📝 {selectedAssignment.mealPlan.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Meals */}
                  {selectedAssignment.mealPlan.meals?.map((meal, mealIndex) => (
                    <div
                      key={mealIndex}
                      className="bg-gray-800 border border-gray-700 rounded-xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-white">{meal.name}</h3>
                          {meal.time && (
                            <p className="text-sm text-gray-400">
                              Recommended time: {meal.time}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {meal.items?.map((item, itemIndex) => {
                          const isCompleted = isMealItemCompleted(mealIndex, itemIndex);
                          return (
                            <label
                              key={itemIndex}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                                isCompleted
                                  ? "bg-green-900/30 border border-green-500/30"
                                  : "bg-gray-900 hover:bg-gray-700"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleMealItem(mealIndex, itemIndex)}
                                className="flex-shrink-0"
                              >
                                {isCompleted ? (
                                  <CheckCircle className="w-6 h-6 text-green-500" />
                                ) : (
                                  <Circle className="w-6 h-6 text-gray-500" />
                                )}
                              </button>
                              <span
                                className={`flex-1 ${
                                  isCompleted
                                    ? "text-green-400 line-through"
                                    : "text-gray-300"
                                }`}
                              >
                                {item}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
};

export default MemberMealPlans;
