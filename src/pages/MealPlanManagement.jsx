import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import AdminLayout from "../components/AdminLayout";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Search,
  Users,
  Calendar,
  Check,
  UserPlus,
} from "lucide-react";

const MealPlanManagement = () => {
  const { user: currentUser } = useAuth();

  const [mealPlans, setMealPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMealPlanModal, setShowMealPlanModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAssignedMembersModal, setShowAssignedMembersModal] = useState(false);
  const [editingMealPlan, setEditingMealPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedMembers, setAssignedMembers] = useState([]);

  const [mealPlanForm, setMealPlanForm] = useState({
    name: "",
    description: "",
    targetCalories: "",
    meals: [
      { name: "Breakfast", items: [""], time: "08:00" },
      { name: "Lunch", items: [""], time: "12:00" },
      { name: "Dinner", items: [""], time: "19:00" },
    ],
    duration: 7,
    notes: "",
  });

  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import("firebase/firestore");

      // Fetch meal plans
      const mealPlansQuery = query(
        collection(db, "mealPlans"),
        where("gymId", "==", currentUser.gymId),
        orderBy("createdAt", "desc")
      );
      const mealPlansSnapshot = await getDocs(mealPlansQuery);
      const mealPlansData = mealPlansSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch members
      const membersQuery = query(
        collection(db, "members"),
        where("gymId", "==", currentUser.gymId),
        where("status", "==", "active")
      );
      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch assignments to count members per plan
      const assignmentsQuery = query(
        collection(db, "mealPlanAssignments"),
        where("gymId", "==", currentUser.gymId)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignments = assignmentsSnapshot.docs.map((doc) => doc.data());

      // Count assignments for each plan
      const plansWithCounts = mealPlansData.map((plan) => ({
        ...plan,
        assignedCount: assignments.filter((a) => a.mealPlanId === plan.id).length,
      }));

      setMealPlans(plansWithCounts);
      setMembers(membersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleOpenMealPlanModal = (plan = null) => {
    if (plan) {
      setEditingMealPlan(plan);
      setMealPlanForm({
        name: plan.name || "",
        description: plan.description || "",
        targetCalories: plan.targetCalories || "",
        meals: plan.meals || [
          { name: "Breakfast", items: [""], time: "08:00" },
          { name: "Lunch", items: [""], time: "12:00" },
          { name: "Dinner", items: [""], time: "19:00" },
        ],
        duration: plan.duration || 7,
        notes: plan.notes || "",
      });
    } else {
      setEditingMealPlan(null);
      setMealPlanForm({
        name: "",
        description: "",
        targetCalories: "",
        meals: [
          { name: "Breakfast", items: [""], time: "08:00" },
          { name: "Lunch", items: [""], time: "12:00" },
          { name: "Dinner", items: [""], time: "19:00" },
        ],
        duration: 7,
        notes: "",
      });
    }
    setShowMealPlanModal(true);
  };

  const handleOpenAssignModal = (plan) => {
    setSelectedPlan(plan);
    setSelectedMembers([]);
    setShowAssignModal(true);
  };

  const handleViewAssignedMembers = async (plan) => {
    setSelectedPlan(plan);
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs } = await import("firebase/firestore");

      const assignmentsQuery = query(
        collection(db, "mealPlanAssignments"),
        where("mealPlanId", "==", plan.id),
        where("gymId", "==", currentUser.gymId)
      );

      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignments = assignmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAssignedMembers(assignments);
      setShowAssignedMembersModal(true);
    } catch (error) {
      console.error("Error fetching assigned members:", error);
      alert("Failed to fetch assigned members. Please try again.");
    }
  };

  const handleUnassignMember = async (assignmentId) => {
    if (!confirm("Are you sure you want to unassign this member from the meal plan?")) return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "mealPlanAssignments", assignmentId));

      // Refresh the assigned members list
      if (selectedPlan) {
        handleViewAssignedMembers(selectedPlan);
      }

      // Refresh meal plans to update counts
      fetchData();

      alert("Member unassigned successfully! ✅");
    } catch (error) {
      console.error("Error unassigning member:", error);
      alert("Failed to unassign member. Please try again.");
    }
  };

  const handleAddMeal = () => {
    setMealPlanForm({
      ...mealPlanForm,
      meals: [
        ...mealPlanForm.meals,
        { name: "", items: [""], time: "12:00" },
      ],
    });
  };

  const handleRemoveMeal = (index) => {
    const newMeals = [...mealPlanForm.meals];
    newMeals.splice(index, 1);
    setMealPlanForm({ ...mealPlanForm, meals: newMeals });
  };

  const handleUpdateMeal = (mealIndex, field, value) => {
    const newMeals = [...mealPlanForm.meals];
    newMeals[mealIndex][field] = value;
    setMealPlanForm({ ...mealPlanForm, meals: newMeals });
  };

  const handleAddMealItem = (mealIndex) => {
    const newMeals = [...mealPlanForm.meals];
    newMeals[mealIndex].items.push("");
    setMealPlanForm({ ...mealPlanForm, meals: newMeals });
  };

  const handleRemoveMealItem = (mealIndex, itemIndex) => {
    const newMeals = [...mealPlanForm.meals];
    newMeals[mealIndex].items.splice(itemIndex, 1);
    setMealPlanForm({ ...mealPlanForm, meals: newMeals });
  };

  const handleUpdateMealItem = (mealIndex, itemIndex, value) => {
    const newMeals = [...mealPlanForm.meals];
    newMeals[mealIndex].items[itemIndex] = value;
    setMealPlanForm({ ...mealPlanForm, meals: newMeals });
  };

  const handleSaveMealPlan = async (e) => {
    e.preventDefault();

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, doc, updateDoc, Timestamp } = await import("firebase/firestore");

      const mealPlanData = {
        name: mealPlanForm.name,
        description: mealPlanForm.description,
        targetCalories: parseInt(mealPlanForm.targetCalories) || null,
        meals: mealPlanForm.meals,
        duration: parseInt(mealPlanForm.duration),
        notes: mealPlanForm.notes,
        gymId: currentUser.gymId,
      };

      if (editingMealPlan) {
        await updateDoc(doc(db, "mealPlans", editingMealPlan.id), {
          ...mealPlanData,
          updatedAt: Timestamp.now(),
        });
        alert("Meal plan updated successfully! ✓");
      } else {
        await addDoc(collection(db, "mealPlans"), {
          ...mealPlanData,
          createdAt: Timestamp.now(),
        });
        alert("Meal plan created successfully! 🎉");
      }

      setShowMealPlanModal(false);
      fetchData();
    } catch (error) {
      console.error("Error saving meal plan:", error);
      alert("Failed to save meal plan. Please try again.");
    }
  };

  const handleAssignMembers = async () => {
    if (selectedMembers.length === 0) {
      alert("Please select at least one member");
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      const promises = selectedMembers.map((memberId) =>
        addDoc(collection(db, "mealPlanAssignments"), {
          mealPlanId: selectedPlan.id,
          mealPlanName: selectedPlan.name,
          memberId: memberId,
          memberName: members.find((m) => m.id === memberId)?.name,
          gymId: currentUser.gymId,
          assignedAt: Timestamp.now(),
          progress: [],
        })
      );

      await Promise.all(promises);
      alert(`Meal plan assigned to ${selectedMembers.length} member(s) successfully! 🎉`);
      setShowAssignModal(false);
      fetchData();
    } catch (error) {
      console.error("Error assigning meal plan:", error);
      alert("Failed to assign meal plan. Please try again.");
    }
  };

  const handleDeleteMealPlan = async (id) => {
    if (!confirm("Are you sure you want to delete this meal plan?")) {
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "mealPlans", id));
      fetchData();
      alert("Meal plan deleted successfully.");
    } catch (error) {
      console.error("Error deleting meal plan:", error);
      alert("Failed to delete meal plan. Please try again.");
    }
  };

  const getFilteredMealPlans = () => {
    return mealPlans.filter((plan) =>
      plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading meal plans...</p>
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Meal Plan Management</h1>
              <p className="text-gray-400">Create and assign meal plans to members</p>
            </div>
            <button
              onClick={() => handleOpenMealPlanModal()}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Create Meal Plan
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-5 h-5" />
                <p className="text-sm text-green-100">Total Meal Plans</p>
              </div>
              <p className="text-3xl font-bold">{mealPlans.length}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5" />
                <p className="text-sm text-blue-100">Total Assignments</p>
              </div>
              <p className="text-3xl font-bold">
                {mealPlans.reduce((sum, plan) => sum + (plan.assignedCount || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search meal plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Meal Plans List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {getFilteredMealPlans().length > 0 ? (
            getFilteredMealPlans().map((plan) => (
              <div
                key={plan.id}
                className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-green-500/50 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-gray-400 text-sm">{plan.description}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {plan.targetCalories && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-gray-500">🎯 Target:</span>
                      <span>{plan.targetCalories} calories/day</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>{plan.duration} days duration</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span>{plan.assignedCount || 0} members assigned</span>
                  </div>
                </div>

                {/* Meals Preview */}
                <div className="bg-gray-900 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-2">Meals:</p>
                  <div className="space-y-1">
                    {plan.meals?.slice(0, 3).map((meal, index) => (
                      <div key={index} className="text-sm text-gray-300">
                        <span className="font-medium">{meal.name}</span>
                        {meal.time && (
                          <span className="text-gray-500 ml-2">@ {meal.time}</span>
                        )}
                      </div>
                    ))}
                    {plan.meals?.length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{plan.meals.length - 3} more
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenAssignModal(plan)}
                      className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      Assign
                    </button>
                    <button
                      onClick={() => handleOpenMealPlanModal(plan)}
                      className="py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMealPlan(plan.id)}
                      className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {plan.assignedCount > 0 && (
                    <button
                      onClick={() => handleViewAssignedMembers(plan)}
                      className="w-full py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-600 border border-blue-600/50 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Users className="w-4 h-4" />
                      View Assigned Members
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <div className="text-6xl mb-4">🍽️</div>
              <h3 className="text-xl font-bold text-white mb-2">No Meal Plans Found</h3>
              <p className="text-gray-400 mb-6">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Create your first meal plan to get started"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => handleOpenMealPlanModal()}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition"
                >
                  Create First Meal Plan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Create/Edit Meal Plan Modal */}
        {showMealPlanModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingMealPlan ? "Edit Meal Plan" : "Create Meal Plan"}
                </h2>
                <button
                  onClick={() => setShowMealPlanModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveMealPlan} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Plan Name *
                    </label>
                    <input
                      type="text"
                      value={mealPlanForm.name}
                      onChange={(e) =>
                        setMealPlanForm({ ...mealPlanForm, name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Muscle Gain Plan, Weight Loss Plan"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={mealPlanForm.description}
                      onChange={(e) =>
                        setMealPlanForm({ ...mealPlanForm, description: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Brief description of the meal plan..."
                      rows="2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Target Calories/Day
                      </label>
                      <input
                        type="number"
                        value={mealPlanForm.targetCalories}
                        onChange={(e) =>
                          setMealPlanForm({
                            ...mealPlanForm,
                            targetCalories: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="2000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Duration (days) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={mealPlanForm.duration}
                        onChange={(e) =>
                          setMealPlanForm({ ...mealPlanForm, duration: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Meals */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-300">Meals *</label>
                    <button
                      type="button"
                      onClick={handleAddMeal}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Meal
                    </button>
                  </div>

                  <div className="space-y-4">
                    {mealPlanForm.meals.map((meal, mealIndex) => (
                      <div
                        key={mealIndex}
                        className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={meal.name}
                              onChange={(e) =>
                                handleUpdateMeal(mealIndex, "name", e.target.value)
                              }
                              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              placeholder="Meal name"
                              required
                            />
                            <input
                              type="time"
                              value={meal.time}
                              onChange={(e) =>
                                handleUpdateMeal(mealIndex, "time", e.target.value)
                              }
                              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          {mealPlanForm.meals.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMeal(mealIndex)}
                              className="p-2 text-red-400 hover:text-red-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {meal.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex gap-2">
                              <input
                                type="text"
                                value={item}
                                onChange={(e) =>
                                  handleUpdateMealItem(mealIndex, itemIndex, e.target.value)
                                }
                                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Food item (e.g., 2 eggs, 1 cup oatmeal)"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveMealItem(mealIndex, itemIndex)}
                                className="p-2 text-gray-500 hover:text-gray-300"
                                disabled={meal.items.length === 1}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleAddMealItem(mealIndex)}
                            className="text-sm text-green-400 hover:text-green-300 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add item
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={mealPlanForm.notes}
                    onChange={(e) =>
                      setMealPlanForm({ ...mealPlanForm, notes: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Additional instructions, restrictions, etc."
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowMealPlanModal(false)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingMealPlan ? "Update Plan" : "Create Plan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign to Members Modal */}
        {showAssignModal && selectedPlan && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Assign "{selectedPlan.name}" to Members
                </h2>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-700 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembers([...selectedMembers, member.id]);
                        } else {
                          setSelectedMembers(
                            selectedMembers.filter((id) => id !== member.id)
                          );
                        }
                      }}
                      className="w-5 h-5 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <p className="text-white font-medium">{member.name}</p>
                      <p className="text-sm text-gray-400">{member.email}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignMembers}
                  disabled={selectedMembers.length === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  Assign to {selectedMembers.length} Member(s)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assigned Members Modal */}
        {showAssignedMembersModal && selectedPlan && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="border-b border-gray-700 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Assigned Members</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Meal Plan: {selectedPlan.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignedMembersModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
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

              <div className="p-6 overflow-y-auto flex-1">
                {assignedMembers.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No members assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignedMembers.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="bg-gray-900 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-semibold">
                              {assignment.memberName?.charAt(0).toUpperCase() || "M"}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {assignment.memberName || "Unknown Member"}
                            </p>
                            <p className="text-xs text-gray-400">
                              Assigned on{" "}
                              {assignment.assignedAt?.toDate
                                ? assignment.assignedAt.toDate().toLocaleDateString()
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnassignMember(assignment.id)}
                          className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg transition"
                          title="Unassign Member"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-700 p-6">
                <button
                  onClick={() => setShowAssignedMembersModal(false)}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default MealPlanManagement;
