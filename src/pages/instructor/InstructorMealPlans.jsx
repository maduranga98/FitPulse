import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import {
  Utensils,
  ArrowLeft,
  Search,
  UserPlus,
  X,
  Eye,
  Calendar,
  Users,
  Plus,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const InstructorMealPlans = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentGymId = user?.gymId;

  // State management
  const [mealPlans, setMealPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAssignedMembersModal, setShowAssignedMembersModal] =
    useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [assignedMembers, setAssignedMembers] = useState([]);

  // Creation form state
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    targetCalories: "",
    duration: "7",
    notes: "",
    meals: [],
  });
  const [currentMeal, setCurrentMeal] = useState({
    name: "",
    time: "",
    items: [],
  });
  const [currentFoodItem, setCurrentFoodItem] = useState("");

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

      // Fetch meal plans for this gym
      const mealPlansSnapshot = await getDocs(
        query(
          collection(db, "mealPlans"),
          where("gymId", "==", currentGymId),
          orderBy("createdAt", "desc")
        )
      );
      const mealPlansData = mealPlansSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

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

      // Fetch assignments
      const assignmentsSnapshot = await getDocs(
        query(
          collection(db, "mealPlanAssignments"),
          where("gymId", "==", currentGymId)
        )
      );
      const assignmentsData = assignmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Count assignments per plan
      const plansWithCounts = mealPlansData.map((plan) => ({
        ...plan,
        assignedCount: assignmentsData.filter((a) => a.mealPlanId === plan.id)
          .length,
      }));

      setMealPlans(plansWithCounts);
      setMembers(membersData);
      setAssignments(assignmentsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleOpenAssignModal = (plan) => {
    setSelectedPlan(plan);
    setSelectedMembers([]);
    
    // Filter out members who already have this meal plan assigned
    const alreadyAssignedIds = assignments
      .filter((a) => a.mealPlanId === plan.id)
      .map((a) => a.memberId);
    
    // Pre-select members who don't have this plan
    const availableMembers = members.filter(
      (m) => !alreadyAssignedIds.includes(m.id)
    );

    setShowAssignModal(true);
  };

  const handleViewAssignedMembers = async (plan) => {
    setSelectedPlan(plan);
    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      const assignmentsQuery = query(
        collection(db, "mealPlanAssignments"),
        where("mealPlanId", "==", plan.id),
        where("gymId", "==", currentGymId)
      );

      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentsData = assignmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAssignedMembers(assignmentsData);
      setShowAssignedMembersModal(true);
    } catch (error) {
      console.error("Error fetching assigned members:", error);
      alert("Failed to fetch assigned members. Please try again.");
    }
  };

  const handleUnassignMember = async (assignmentId) => {
    if (!confirm("Are you sure you want to unassign this member?")) return;

    try {
      const { db } = await import("../../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "mealPlanAssignments", assignmentId));

      // Refresh the assigned members list
      if (selectedPlan) {
        handleViewAssignedMembers(selectedPlan);
      }

      // Refresh all data
      fetchData();

      alert("Member unassigned successfully! ✅");
    } catch (error) {
      console.error("Error unassigning member:", error);
      alert("Failed to unassign member. Please try again.");
    }
  };

  const handleAssignMembers = async () => {
    if (selectedMembers.length === 0) {
      alert("Please select at least one member");
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      const promises = selectedMembers.map((memberId) =>
        addDoc(collection(db, "mealPlanAssignments"), {
          mealPlanId: selectedPlan.id,
          mealPlanName: selectedPlan.name,
          memberId: memberId,
          memberName: members.find((m) => m.id === memberId)?.name,
          gymId: currentGymId,
          assignedBy: user.id,
          assignedByName: user.name,
          assignedAt: Timestamp.now(),
          progress: [],
          status: "active",
        })
      );

      await Promise.all(promises);
      alert(
        `Meal plan assigned to ${selectedMembers.length} member(s) successfully! 🎉`
      );
      setShowAssignModal(false);
      setSelectedMembers([]);
      fetchData();
    } catch (error) {
  console.error("Error assigning meal plan:", error);
      alert("Failed to assign meal plan. Please try again.");
    }
  };

  // Meal plan creation handlers
  const handleOpenCreateModal = () => {
    setNewPlan({
      name: "",
      description: "",
      targetCalories: "",
      duration: "7",
      notes: "",
      meals: [],
    });
    setCurrentMeal({ name: "", time: "", items: [] });
    setCurrentFoodItem("");
    setShowCreateModal(true);
  };

  const handleAddFoodItem = () => {
    if (!currentFoodItem.trim()) return;
    setCurrentMeal({
      ...currentMeal,
      items: [...currentMeal.items, currentFoodItem.trim()],
    });
    setCurrentFoodItem("");
  };

  const handleRemoveFoodItem = (index) => {
    setCurrentMeal({
      ...currentMeal,
      items: currentMeal.items.filter((_, i) => i !== index),
    });
  };

  const handleAddMeal = () => {
    if (!currentMeal.name.trim()) {
      alert("Please enter a meal name");
      return;
    }
    setNewPlan({
      ...newPlan,
      meals: [...newPlan.meals, currentMeal],
    });
    setCurrentMeal({ name: "", time: "", items: [] });
  };

  const handleRemoveMeal = (index) => {
    setNewPlan({
      ...newPlan,
      meals: newPlan.meals.filter((_, i) => i !== index),
    });
  };

  const handleMoveMeal = (index, direction) => {
    const newMeals = [...newPlan.meals];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newMeals.length) return;
    [newMeals[index], newMeals[targetIndex]] = [
      newMeals[targetIndex],
      newMeals[index],
    ];
    setNewPlan({ ...newPlan, meals: newMeals });
  };

  const handleSaveMealPlan = async () => {
    if (!newPlan.name.trim()) {
      alert("Please enter a meal plan name");
      return;
    }
    if (!newPlan.duration || newPlan.duration <= 0) {
      alert("Please enter a valid duration");
      return;
    }
    if (newPlan.meals.length === 0) {
      alert("Please add at least one meal");
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      await addDoc(collection(db, "mealPlans"), {
        name: newPlan.name,
        description: newPlan.description,
        targetCalories: newPlan.targetCalories
          ? parseInt(newPlan.targetCalories)
          : null,
        duration: parseInt(newPlan.duration),
        meals: newPlan.meals,
        notes: newPlan.notes,
        gymId: currentGymId,
        createdBy: user.id,
        createdByName: user.name,
        createdAt: Timestamp.now(),
      });

      alert("Meal plan created successfully! 🎉");
      setShowCreateModal(false);
      fetchData();
    } catch (error) {
      console.error("Error creating meal plan:", error);
      alert("Failed to create meal plan. Please try again.");
    }
  };

  const getFilteredMealPlans = () => {
    return mealPlans.filter(
      (plan) =>
        plan.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const isAlreadyAssigned = (memberId) => {
    return assignments.some(
      (a) => a.memberId === memberId && a.mealPlanId === selectedPlan?.id
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
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
          <button
            onClick={() => navigate("/instructor-dashboard")}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-white">Meal Plans</h1>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium transition flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Meal Plan
            </button>
          </div>
          <p className="text-gray-400">
            Create and assign meal plans to your members
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
              <p className="text-sm text-blue-100">Active Members</p>
            </div>
            <p className="text-3xl font-bold">{members.length}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-5 h-5" />
              <p className="text-sm text-purple-100">Total Assignments</p>
            </div>
            <p className="text-3xl font-bold">{assignments.length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search meal plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Meal Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {getFilteredMealPlans().length > 0 ? (
            getFilteredMealPlans().map((plan) => (
              <div
                key={plan.id}
                className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-green-500/50 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">
                      {plan.name}
                    </h3>
                    {plan.description && (
                      <p className="text-gray-400 text-sm">
                        {plan.description}
                      </p>
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
                          <span className="text-gray-500 ml-2">
                            @ {meal.time}
                          </span>
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
                      onClick={() => {
                        setSelectedPlan(plan);
                        setShowViewModal(true);
                      }}
                      className="flex-1 py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button
                      onClick={() => handleOpenAssignModal(plan)}
                      className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      Assign
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
              <Utensils className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                No Meal Plans Found
              </h3>
              <p className="text-gray-400 mb-6">
                {searchQuery
                  ? "Try adjusting your search"
                  : "No meal plans available yet"}
              </p>
            </div>
          )}
        </div>

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
                {members.length > 0 ? (
                  members.map((member) => {
                    const alreadyAssigned = isAlreadyAssigned(member.id);
                    return (
                      <label
                        key={member.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                          alreadyAssigned
                            ? "bg-gray-900/50 opacity-50 cursor-not-allowed"
                            : "bg-gray-900 hover:bg-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          disabled={alreadyAssigned}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMembers([
                                ...selectedMembers,
                                member.id,
                              ]);
                            } else {
                              setSelectedMembers(
                                selectedMembers.filter((id) => id !== member.id)
                              );
                            }
                          }}
                          className="w-5 h-5 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500 disabled:opacity-50"
                        />
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {member.name}
                          </p>
                          <p className="text-sm text-gray-400">
                            {member.email}
                          </p>
                        </div>
                        {alreadyAssigned && (
                          <span className="text-xs text-green-600 bg-green-600/20 px-2 py-1 rounded border border-green-600/50">
                            Already Assigned
                          </span>
                        )}
                      </label>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No active members found</p>
                  </div>
                )}
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
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign to {selectedMembers.length} Member(s)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Meal Plan Modal */}
        {showViewModal && selectedPlan && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {selectedPlan.name}
                </h2>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {selectedPlan.description && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Description</p>
                    <p className="text-white">{selectedPlan.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {selectedPlan.targetCalories && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">
                        Target Calories
                      </p>
                      <p className="text-white font-bold">
                        {selectedPlan.targetCalories} cal/day
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Duration</p>
                    <p className="text-white font-bold">
                      {selectedPlan.duration} days
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 text-sm mb-3">Meal Schedule</p>
                  <div className="space-y-3">
                    {selectedPlan.meals?.map((meal, index) => (
                      <div
                        key={index}
                        className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-semibold">
                            {meal.name}
                          </h4>
                          {meal.time && (
                            <span className="text-sm text-gray-400">
                              {meal.time}
                            </span>
                          )}
                        </div>
                        {meal.items && meal.items.length > 0 && (
                          <ul className="list-disc list-inside space-y-1">
                            {meal.items.map((item, itemIndex) => (
                              <li
                                key={itemIndex}
                                className="text-sm text-gray-300"
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPlan.notes && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">
                      Additional Notes
                    </p>
                    <p className="text-white">{selectedPlan.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Close
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
                  <h2 className="text-2xl font-bold text-white">
                    Assigned Members
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Meal Plan: {selectedPlan.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignedMembersModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {assignedMembers.length > 0 ? (
                  <div className="space-y-3">
                    {assignedMembers.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="bg-gray-900 rounded-lg p-4 border border-gray-700 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {assignment.memberName}
                          </p>
                          <p className="text-sm text-gray-400">
                            Assigned by: {assignment.assignedByName || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {assignment.assignedAt?.toDate().toLocaleDateString() ||
                              "Date unknown"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnassignMember(assignment.id)}
                          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 border border-red-600/50 rounded-lg transition text-sm"
                        >
                          Unassign
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">
                      No members assigned to this meal plan yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Meal Plan Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl max-w-4xl w-full p-4 sm:p-6 my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Create New Meal Plan
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Basic Information */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    value={newPlan.name}
                    onChange={(e) =>
                      setNewPlan({ ...newPlan, name: e.target.value })
                    }
                    placeholder="e.g., Weight Loss Plan, Muscle Gain Diet"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newPlan.description}
                    onChange={(e) =>
                      setNewPlan({ ...newPlan, description: e.target.value })
                    }
                    placeholder="Brief description of the meal plan"
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Target Calories (per day)
                    </label>
                    <input
                      type="number"
                      value={newPlan.targetCalories}
                      onChange={(e) =>
                        setNewPlan({
                          ...newPlan,
                          targetCalories: e.target.value,
                        })
                      }
                      placeholder="e.g., 2000"
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Duration (days) *
                    </label>
                    <input
                      type="number"
                      value={newPlan.duration}
                      onChange={(e) =>
                        setNewPlan({ ...newPlan, duration: e.target.value })
                      }
                      placeholder="e.g., 7"
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={newPlan.notes}
                    onChange={(e) =>
                      setNewPlan({ ...newPlan, notes: e.target.value })
                    }
                    placeholder="Any special instructions or notes"
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Meals Section */}
              <div className="border-t border-gray-700 pt-6 mb-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  Meals ({newPlan.meals.length})
                </h3>

                {/* Added Meals List */}
                {newPlan.meals.length > 0 && (
                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-2">
                    {newPlan.meals.map((meal, index) => (
                      <div
                        key={index}
                        className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-white font-bold">
                              {meal.name}
                            </h4>
                            {meal.time && (
                              <p className="text-sm text-gray-400">
                                @ {meal.time}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleMoveMeal(index, "up")}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleMoveMeal(index, "down")}
                              disabled={index === newPlan.meals.length - 1}
                              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleRemoveMeal(index)}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        {meal.items && meal.items.length > 0 && (
                          <ul className="list-disc list-inside space-y-1 mt-2">
                            {meal.items.map((item, itemIndex) => (
                              <li key={itemIndex} className="text-sm text-gray-300">
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Meal Form */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
                  <h4 className="text-white font-bold mb-3">Add New Meal</h4>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Meal Name *
                        </label>
                        <input
                          type="text"
                          value={currentMeal.name}
                          onChange={(e) =>
                            setCurrentMeal({
                              ...currentMeal,
                              name: e.target.value,
                            })
                          }
                          placeholder="e.g., Breakfast, Lunch"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Time (optional)
                        </label>
                        <input
                          type="text"
                          value={currentMeal.time}
                          onChange={(e) =>
                            setCurrentMeal({
                              ...currentMeal,
                              time: e.target.value,
                            })
                          }
                          placeholder="e.g., 8:00 AM"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>

                    {/* Food Items */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Food Items
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={currentFoodItem}
                          onChange={(e) => setCurrentFoodItem(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddFoodItem();
                            }
                          }}
                          placeholder="Add food item"
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <button
                          onClick={handleAddFoodItem}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {currentMeal.items.length > 0 && (
                        <div className="space-y-1">
                          {currentMeal.items.map((item, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between bg-gray-800 px-3 py-1 rounded text-sm"
                            >
                              <span className="text-gray-300">{item}</span>
                              <button
                                onClick={() => handleRemoveFoodItem(index)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleAddMeal}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Meal to Plan
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 sticky bottom-0 bg-gray-800 pt-4 -mx-4 sm:-mx-6 px-4 sm:px-6 -mb-4 sm:-mb-6 pb-4 sm:pb-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMealPlan}
                  disabled={!newPlan.name || newPlan.meals.length === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  Save Meal Plan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorMealPlans;
