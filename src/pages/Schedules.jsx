import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";

const Schedules = () => {
  const { user: currentUser, logout } = useAuth();
  const currentGymId = currentUser?.gymId;

  const [schedules, setSchedules] = useState([]);
  const [members, setMembers] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [categories, setCategories] = useState([]); // ✅ NEW: Add categories state
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [viewSchedule, setViewSchedule] = useState(null);
  const [selectedMember, setSelectedMember] = useState("all");
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  
  // Assignment modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [scheduleToAssign, setScheduleToAssign] = useState(null);
  const [selectedMembersToAssign, setSelectedMembersToAssign] = useState([]);
  const [assignDueDate, setAssignDueDate] = useState("");

  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "manager" || currentUser?.role === "gym_admin" || currentUser?.role === "gym_manager";
  const isMember = currentUser?.role === "member";
  console.log(currentUser?.role);

  useEffect(() => {
    if (currentGymId) {
      fetchData();
    }
  }, [currentGymId]);

  const [scheduleForm, setScheduleForm] = useState({
    memberId: "",
    title: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    days: [],
    cardio: [{ exerciseId: "", time: "" }],
    warmUp: [{ exerciseId: "", reps: "", rest: "" }],
    workouts: [
      {
        day: "monday",
        exercises: [{ exerciseId: "", sets: [{ reps: "", rest: "" }] }],
      },
    ],
    warmDown: [{ exerciseId: "", time: "" }],
    status: "active",
    notes: "",
  });

  const daysOfWeek = [
    { id: "monday", label: "Monday" },
    { id: "tuesday", label: "Tuesday" },
    { id: "wednesday", label: "Wednesday" },
    { id: "thursday", label: "Thursday" },
    { id: "friday", label: "Friday" },
    { id: "saturday", label: "Saturday" },
    { id: "sunday", label: "Sunday" },
  ];

  const fetchData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import(
        "firebase/firestore"
      );

      let schedulesQuery;
      if (isMember) {
        schedulesQuery = query(
          collection(db, "schedules"),
          where("memberId", "==", currentUser.id),
          where("gymId", "==", currentGymId),
          orderBy("startDate", "desc")
        );
      } else {
        schedulesQuery = query(
          collection(db, "schedules"),
          where("gymId", "==", currentGymId),
          orderBy("startDate", "desc")
        );
      }

      const schedulesSnapshot = await getDocs(schedulesQuery);
      const schedulesData = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (isAdmin) {
        const membersSnapshot = await getDocs(
          query(collection(db, "members"), where("gymId", "==", currentGymId))
        );
        const membersData = membersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMembers(membersData);
      }

      // ✅ NEW: Fetch gym-specific categories
      const categoriesRef = collection(db, "exerciseCategories");
      const categoriesQuery = query(
        categoriesRef,
        where("gymId", "==", currentGymId)
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const gymCategoriesData = categoriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // ✅ NEW: Fetch common categories (no gymId or empty gymId)
      const allCategoriesSnapshot = await getDocs(
        collection(db, "exerciseCategories")
      );
      const commonCategoriesData = allCategoriesSnapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return !data.gymId || data.gymId === null || data.gymId === "";
        })
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

      // ✅ NEW: Combine both gym and common categories
      const allCategories = [...gymCategoriesData, ...commonCategoriesData];

      // Fetch gym-specific exercises
      const gymExercisesSnapshot = await getDocs(
        query(
          collection(db, "gym_exercises"),
          where("gymId", "==", currentGymId)
        )
      );
      const gymExercisesData = gymExercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const selectionsSnapshot = await getDocs(
        query(
          collection(db, "gym_exercise_selections"),
          where("gymId", "==", currentGymId)
        )
      );
      const selectedExerciseIds = selectionsSnapshot.docs.map(
        (doc) => doc.data().exerciseId
      );

      // Fetch common exercises (not filtered by gymId)
      let commonExercisesData = [];
      if (selectedExerciseIds.length > 0) {
        const exercisePromises = selectedExerciseIds.map(async (exerciseId) => {
          const { doc, getDoc } = await import("firebase/firestore");
          const exerciseDocRef = doc(db, "exercises", exerciseId);
          const exerciseDoc = await getDoc(exerciseDocRef);
          if (exerciseDoc.exists()) {
            return {
              id: exerciseDoc.id,
              ...exerciseDoc.data(),
            };
          }
          return null;
        });

        const fetchedExercises = await Promise.all(exercisePromises);
        commonExercisesData = fetchedExercises.filter((ex) => ex !== null);
      }

      // Combine both gym exercises and common exercises
      const allExercises = [...gymExercisesData, ...commonExercisesData];

      console.log("Loaded data:", {
        exercises: allExercises.length,
        categories: allCategories.length,
        schedules: schedulesData.length,
      });

      setSchedules(schedulesData);
      setExercises(allExercises);
      setCategories(allCategories); // ✅ NEW: Set categories state
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleAddSchedule = async () => {
    if (!isAdmin) {
      alert("You don't have permission to create schedules");
      return;
    }

    if (!scheduleForm.memberId || !scheduleForm.title) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, updateDoc, doc, Timestamp } = await import(
        "firebase/firestore"
      );

      const cleanedCardio = scheduleForm.cardio.filter((ex) => ex.exerciseId);
      const cleanedWarmUp = scheduleForm.warmUp.filter((ex) => ex.exerciseId);
      const cleanedWarmDown = scheduleForm.warmDown.filter(
        (ex) => ex.exerciseId
      );

      const cleanedWorkouts = scheduleForm.workouts
        .map((workout) => ({
          ...workout,
          exercises: workout.exercises.filter(
            (ex) => ex.exerciseId && ex.sets.length > 0
          ),
        }))
        .filter((workout) => workout.exercises.length > 0);

      const scheduleData = {
        ...scheduleForm,
        gymId: currentGymId,
        cardio: cleanedCardio,
        warmUp: cleanedWarmUp,
        warmDown: cleanedWarmDown,
        workouts: cleanedWorkouts,
        startDate: Timestamp.fromDate(new Date(scheduleForm.startDate)),
        endDate: scheduleForm.endDate
          ? Timestamp.fromDate(new Date(scheduleForm.endDate))
          : null,
        createdAt: Timestamp.now(),
        createdBy: currentUser.id,
      };

      if (editingSchedule) {
        await updateDoc(doc(db, "schedules", editingSchedule.id), scheduleData);
        showSuccessNotification("Schedule updated successfully! 🎉");
      } else {
        await addDoc(collection(db, "schedules"), scheduleData);
        showSuccessNotification("Schedule created successfully! 🎉");
      }

      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error adding schedule:", error);
      alert("Failed to add schedule");
    }
  };

  const showSuccessNotification = (message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  const handleDeleteSchedule = async (id) => {
    if (!isAdmin) {
      alert("You don't have permission to delete schedules");
      return;
    }

    if (!confirm("Are you sure you want to delete this schedule?")) return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "schedules", id));
      fetchData();
    } catch (error) {
      console.error("Error deleting schedule:", error);
      alert("Failed to delete schedule");
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      memberId: schedule.memberId,
      title: schedule.title,
      description: schedule.description || "",
      startDate: schedule.startDate?.toDate
        ? schedule.startDate.toDate().toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      endDate: schedule.endDate?.toDate
        ? schedule.endDate.toDate().toISOString().split("T")[0]
        : "",
      days: schedule.days || [],
      cardio:
        schedule.cardio?.length > 0
          ? schedule.cardio
          : [{ exerciseId: "", time: "" }],
      warmUp:
        schedule.warmUp?.length > 0
          ? schedule.warmUp
          : [{ exerciseId: "", reps: "", rest: "" }],
      workouts:
        schedule.workouts?.length > 0
          ? schedule.workouts
          : [
              {
                day: "monday",
                exercises: [{ exerciseId: "", sets: [{ reps: "", rest: "" }] }],
              },
            ],
      warmDown:
        schedule.warmDown?.length > 0
          ? schedule.warmDown
          : [{ exerciseId: "", time: "" }],
      status: schedule.status || "active",
      notes: schedule.notes || "",
    });
    setShowAddSchedule(true);
  };

  const resetForm = () => {
    setShowAddSchedule(false);
    setEditingSchedule(null);
    setScheduleForm({
      memberId: "",
      title: "",
      description: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      days: [],
      cardio: [{ exerciseId: "", time: "" }],
      warmUp: [{ exerciseId: "", reps: "", rest: "" }],
      workouts: [
        {
          day: "monday",
          exercises: [{ exerciseId: "", sets: [{ reps: "", rest: "" }] }],
        },
      ],
      warmDown: [{ exerciseId: "", time: "" }],
      status: "active",
      notes: "",
    });
  };

  const addWorkoutDay = () => {
    setScheduleForm({
      ...scheduleForm,
      workouts: [
        ...scheduleForm.workouts,
        {
          day: "monday",
          exercises: [{ exerciseId: "", sets: [{ reps: "", rest: "" }] }],
        },
      ],
    });
  };

  const removeWorkoutDay = (index) => {
    setScheduleForm({
      ...scheduleForm,
      workouts: scheduleForm.workouts.filter((_, i) => i !== index),
    });
  };

  const addExerciseToDay = (dayIndex) => {
    const newWorkouts = [...scheduleForm.workouts];
    newWorkouts[dayIndex].exercises.push({
      exerciseId: "",
      sets: [{ reps: "", rest: "" }],
    });
    setScheduleForm({ ...scheduleForm, workouts: newWorkouts });
  };

  const removeExerciseFromDay = (dayIndex, exerciseIndex) => {
    const newWorkouts = [...scheduleForm.workouts];
    newWorkouts[dayIndex].exercises = newWorkouts[dayIndex].exercises.filter(
      (_, i) => i !== exerciseIndex
    );
    setScheduleForm({ ...scheduleForm, workouts: newWorkouts });
  };

  const updateWorkoutDay = (dayIndex, field, value) => {
    const newWorkouts = [...scheduleForm.workouts];
    newWorkouts[dayIndex][field] = value;
    setScheduleForm({ ...scheduleForm, workouts: newWorkouts });
  };

  const updateExercise = (dayIndex, exerciseIndex, field, value) => {
    const newWorkouts = [...scheduleForm.workouts];
    newWorkouts[dayIndex].exercises[exerciseIndex][field] = value;
    setScheduleForm({ ...scheduleForm, workouts: newWorkouts });
  };

  const addSetToExercise = (dayIndex, exerciseIndex) => {
    const newWorkouts = [...scheduleForm.workouts];
    newWorkouts[dayIndex].exercises[exerciseIndex].sets.push({
      reps: "",
      rest: "",
    });
    setScheduleForm({ ...scheduleForm, workouts: newWorkouts });
  };

  const removeSetFromExercise = (dayIndex, exerciseIndex, setIndex) => {
    const newWorkouts = [...scheduleForm.workouts];
    newWorkouts[dayIndex].exercises[exerciseIndex].sets = newWorkouts[
      dayIndex
    ].exercises[exerciseIndex].sets.filter((_, i) => i !== setIndex);
    setScheduleForm({ ...scheduleForm, workouts: newWorkouts });
  };

  const updateSet = (dayIndex, exerciseIndex, setIndex, field, value) => {
    const newWorkouts = [...scheduleForm.workouts];
    newWorkouts[dayIndex].exercises[exerciseIndex].sets[setIndex][field] =
      value;
    setScheduleForm({ ...scheduleForm, workouts: newWorkouts });
  };

  const addCardio = () => {
    setScheduleForm({
      ...scheduleForm,
      cardio: [...scheduleForm.cardio, { exerciseId: "", time: "" }],
    });
  };

  const removeCardio = (index) => {
    setScheduleForm({
      ...scheduleForm,
      cardio: scheduleForm.cardio.filter((_, i) => i !== index),
    });
  };

  const updateCardio = (index, field, value) => {
    const newCardio = [...scheduleForm.cardio];
    newCardio[index][field] = value;
    setScheduleForm({ ...scheduleForm, cardio: newCardio });
  };

  const addWarmUp = () => {
    setScheduleForm({
      ...scheduleForm,
      warmUp: [...scheduleForm.warmUp, { exerciseId: "", reps: "", rest: "" }],
    });
  };

  const removeWarmUp = (index) => {
    setScheduleForm({
      ...scheduleForm,
      warmUp: scheduleForm.warmUp.filter((_, i) => i !== index),
    });
  };

  const updateWarmUp = (index, field, value) => {
    const newWarmUp = [...scheduleForm.warmUp];
    newWarmUp[index][field] = value;
    setScheduleForm({ ...scheduleForm, warmUp: newWarmUp });
  };

  const addWarmDown = () => {
    setScheduleForm({
      ...scheduleForm,
      warmDown: [...scheduleForm.warmDown, { exerciseId: "", time: "" }],
    });
  };

  const removeWarmDown = (index) => {
    setScheduleForm({
      ...scheduleForm,
      warmDown: scheduleForm.warmDown.filter((_, i) => i !== index),
    });
  };

  const updateWarmDown = (index, field, value) => {
    const newWarmDown = [...scheduleForm.warmDown];
    newWarmDown[index][field] = value;
    setScheduleForm({ ...scheduleForm, warmDown: newWarmDown });
  };

  const filteredSchedules = schedules.filter((schedule) => {
    if (selectedMember === "all") return true;
    return schedule.memberId === selectedMember;
  });

  const getMemberName = (memberId) => {
    const member = members.find((m) => m.id === memberId);
    return member ? member.name : "Unknown";
  };

  const getExerciseName = (exerciseId) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    return exercise ? exercise.name : "Unknown Exercise";
  };

  // ✅ NEW: Function to get category name by ID
  const getCategoryName = (categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : "";
  };

  // ✅ NEW: Helper function to filter exercises by category name
  const getExercisesByCategory = (categoryName) => {
    return exercises.filter((ex) => {
      // Check both category ID and categoryName field
      const category = categories.find((c) => c.id === ex.category);
      return (
        category?.name?.toLowerCase() === categoryName.toLowerCase() ||
        ex.categoryName?.toLowerCase() === categoryName.toLowerCase()
      );
    });
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

  // New: Handle opening assign modal
  const handleOpenAssignModal = (schedule) => {
    setScheduleToAssign(schedule);
    setShowAssignModal(true);
    setSelectedMembersToAssign([]);
    setAssignDueDate("");
  };

  // New: Handle assigning schedule to members
  const handleAssignSchedule = async () => {
    if (selectedMembersToAssign.length === 0) {
      alert("Please select at least one member");
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      const promises = selectedMembersToAssign.map((memberId) => {
        const member = members.find((m) => m.id === memberId);
        return addDoc(collection(db, "workout_assignments"), {
          templateId: scheduleToAssign.id,
          templateName: scheduleToAssign.title,
          memberId: memberId,
          memberName: member.name,
          assignedBy: currentUser.id,
          assignedByName: currentUser.name,
          gymId: currentGymId,
          assignedAt: Timestamp.now(),
          dueDate: assignDueDate ? new Date(assignDueDate) : null,
          status: "assigned",
          progress: {
            completedExercises: 0,
            totalExercises: scheduleToAssign.workouts?.reduce((total, workout) => {
              return total + (workout.exercises?.length || 0);
            }, 0) || 0,
            lastUpdated: Timestamp.now(),
          },
        });
      });

      await Promise.all(promises);
      showSuccessNotification(
        `Schedule assigned to ${selectedMembersToAssign.length} member(s) successfully! 🎉`
      );
      setShowAssignModal(false);
      setScheduleToAssign(null);
      setSelectedMembersToAssign([]);
      setAssignDueDate("");
    } catch (error) {
      console.error("Error assigning schedule:", error);
      alert(`Error assigning schedule: ${error.message}`);
    }
  };

  // New: Toggle member selection for assignment
  const toggleMemberSelection = (memberId) => {
    setSelectedMembersToAssign((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
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
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {isMember ? "My Schedules" : "Workout Schedules"}
              </h1>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddSchedule(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-lg hover:shadow-xl"
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
                <span className="hidden sm:inline">New Schedule</span>
                <span className="sm:hidden">New</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchedules.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-gray-400 text-lg mb-4">
                  {isMember
                    ? "No schedules assigned to you yet"
                    : "No schedules created yet"}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddSchedule(true)}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
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
                    Create Your First Schedule
                  </button>
                )}
              </div>
            ) : (
              filteredSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        {schedule.title}
                      </h3>
                      {isAdmin && (
                        <p className="text-sm text-gray-400">
                          {getMemberName(schedule.memberId)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        schedule.status === "active"
                          ? "bg-green-600/20 text-green-600"
                          : schedule.status === "completed"
                          ? "bg-blue-600/20 text-blue-600"
                          : "bg-gray-600/20 text-gray-400"
                      }`}
                    >
                      {schedule.status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                    {schedule.description}
                  </p>

                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
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
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>{formatDate(schedule.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
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
                      <span>{schedule.workouts?.length || 0} days</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewSchedule(schedule)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      View Details
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleOpenAssignModal(schedule)}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-1"
                          title="Assign to Members"
                        >
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
                              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                          </svg>
                          Assign
                        </button>
                        <button
                          onClick={() => handleEditSchedule(schedule)}
                          className="px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-600 rounded-lg text-sm font-medium transition"
                        >
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg text-sm font-medium transition"
                        >
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* Floating Action Button for Mobile */}
      {isAdmin && (
        <button
          onClick={() => setShowAddSchedule(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 z-40 lg:hidden"
          title="Create New Schedule"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}

      {/* Add/Edit Schedule Modal */}
      {showAddSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-white">
                {editingSchedule
                  ? "Edit Workout Schedule"
                  : "Create Workout Schedule"}
              </h2>
              <button
                onClick={resetForm}
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

            <div className="p-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Assign to Member *
                  </label>
                  <select
                    value={scheduleForm.memberId}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        memberId: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a member</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} - {member.level}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Schedule Title
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.title}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        title: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 4-Week Strength Program"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={scheduleForm.description}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Brief description of the workout program..."
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.startDate}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.endDate}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={scheduleForm.status}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>

              {/* Cardio Section - ✅ FIXED: Filter by category name */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">
                    Cardio Exercises
                  </h3>
                  <button
                    type="button"
                    onClick={addCardio}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    + Add Cardio
                  </button>
                </div>

                <div className="space-y-3">
                  {scheduleForm.cardio.map((cardio, index) => (
                    <div
                      key={index}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Cardio Exercise
                          </label>
                          <select
                            value={cardio.exerciseId}
                            onChange={(e) =>
                              updateCardio(index, "exerciseId", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select cardio exercise</option>
                            {getExercisesByCategory("cardio").map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Time (minutes)
                          </label>
                          <input
                            type="text"
                            value={cardio.time}
                            onChange={(e) =>
                              updateCardio(index, "time", e.target.value)
                            }
                            placeholder="e.g., 10"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      {scheduleForm.cardio.length > 1 && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeCardio(index)}
                            className="text-sm text-red-600 hover:text-red-500"
                          >
                            Remove Cardio
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warm-up Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">
                    Warm-up Exercises
                  </h3>
                  <button
                    type="button"
                    onClick={addWarmUp}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    + Add Warm-up
                  </button>
                </div>

                <div className="space-y-3">
                  {scheduleForm.warmUp.map((warmup, index) => (
                    <div
                      key={index}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Warm-up Exercise
                          </label>
                          <select
                            value={warmup.exerciseId}
                            onChange={(e) =>
                              updateWarmUp(index, "exerciseId", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select warm-up exercise</option>
                            {exercises.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Reps/Duration
                          </label>
                          <input
                            type="text"
                            value={warmup.reps}
                            onChange={(e) =>
                              updateWarmUp(index, "reps", e.target.value)
                            }
                            placeholder="e.g., 10 or 5 min"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Rest (min)
                          </label>
                          <input
                            type="text"
                            value={warmup.rest}
                            onChange={(e) =>
                              updateWarmUp(index, "rest", e.target.value)
                            }
                            placeholder="e.g., 1"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      {scheduleForm.warmUp.length > 1 && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeWarmUp(index)}
                            className="text-sm text-red-600 hover:text-red-500"
                          >
                            Remove Warm-up
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Workout Days */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Workout Days</h3>
                  <button
                    type="button"
                    onClick={addWorkoutDay}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    + Add Day
                  </button>
                </div>

                <div className="space-y-6">
                  {scheduleForm.workouts.map((workout, dayIndex) => (
                    <div
                      key={dayIndex}
                      className="bg-gray-900 border border-gray-700 rounded-xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <select
                          value={workout.day}
                          onChange={(e) =>
                            updateWorkoutDay(dayIndex, "day", e.target.value)
                          }
                          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {daysOfWeek.map((day) => (
                            <option key={day.id} value={day.id}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                        {scheduleForm.workouts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeWorkoutDay(dayIndex)}
                            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg text-sm font-medium transition"
                          >
                            Remove Day
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-300">
                            Exercises
                          </h4>
                          <button
                            type="button"
                            onClick={() => addExerciseToDay(dayIndex)}
                            className="text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1"
                          >
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
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                            Add Exercise
                          </button>
                        </div>

                        {workout.exercises.map((exercise, exerciseIndex) => (
                          <div
                            key={exerciseIndex}
                            className="bg-gray-800 rounded-lg p-4"
                          >
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Exercise
                              </label>
                              <select
                                value={exercise.exerciseId}
                                onChange={(e) =>
                                  updateExercise(
                                    dayIndex,
                                    exerciseIndex,
                                    "exerciseId",
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select exercise</option>
                                {exercises.map((ex) => (
                                  <option key={ex.id} value={ex.id}>
                                    {ex.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">
                                  Sets & Reps
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    addSetToExercise(dayIndex, exerciseIndex)
                                  }
                                  className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1"
                                >
                                  <svg
                                    className="w-3 h-3"
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
                                  Add Set
                                </button>
                              </div>

                              {exercise.sets.map((set, setIndex) => (
                                <div
                                  key={setIndex}
                                  className="flex items-center gap-2"
                                >
                                  <span className="text-xs text-gray-400 w-12">
                                    Set {setIndex + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={set.reps}
                                    onChange={(e) =>
                                      updateSet(
                                        dayIndex,
                                        exerciseIndex,
                                        setIndex,
                                        "reps",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Reps (e.g., 12)"
                                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <input
                                    type="text"
                                    value={set.rest}
                                    onChange={(e) =>
                                      updateSet(
                                        dayIndex,
                                        exerciseIndex,
                                        setIndex,
                                        "rest",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Rest (min)"
                                    className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  {exercise.sets.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeSetFromExercise(
                                          dayIndex,
                                          exerciseIndex,
                                          setIndex
                                        )
                                      }
                                      className="p-2 text-red-600 hover:bg-red-600/10 rounded"
                                    >
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
                                          d="M6 18L18 6M6 6l12 12"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>

                            {workout.exercises.length > 1 && (
                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeExerciseFromDay(
                                      dayIndex,
                                      exerciseIndex
                                    )
                                  }
                                  className="text-sm text-red-600 hover:text-red-500"
                                >
                                  Remove Exercise
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warm-down Section - ✅ FIXED: Filter by category name */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">
                    Warm-down / Cooling Down
                  </h3>
                  <button
                    type="button"
                    onClick={addWarmDown}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    + Add Warm-down
                  </button>
                </div>

                <div className="space-y-3">
                  {scheduleForm.warmDown.map((warmdown, index) => (
                    <div
                      key={index}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Warm-down Exercise
                          </label>
                          <select
                            value={warmdown.exerciseId}
                            onChange={(e) =>
                              updateWarmDown(
                                index,
                                "exerciseId",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select warm-down exercise</option>
                            {[
                              ...getExercisesByCategory("cardio"),
                              ...getExercisesByCategory("stretching"),
                            ].map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Time (minutes)
                          </label>
                          <input
                            type="text"
                            value={warmdown.time}
                            onChange={(e) =>
                              updateWarmDown(index, "time", e.target.value)
                            }
                            placeholder="e.g., 5"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      {scheduleForm.warmDown.length > 1 && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeWarmDown(index)}
                            className="text-sm text-red-600 hover:text-red-500"
                          >
                            Remove Warm-down
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* General Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  General Notes
                </label>
                <textarea
                  value={scheduleForm.notes}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, notes: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Any additional notes or instructions for the member..."
                  rows="3"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddSchedule}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  {editingSchedule ? "Update Schedule" : "Create Schedule"}
                </button>
                <button
                  onClick={resetForm}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Schedule Modal */}
      {viewSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {viewSchedule.title}
                </h2>
                {isAdmin && (
                  <p className="text-gray-400 mt-1">
                    Assigned to: {getMemberName(viewSchedule.memberId)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setViewSchedule(null)}
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

            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Start Date</div>
                  <div className="text-white font-medium">
                    {formatDate(viewSchedule.startDate)}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">End Date</div>
                  <div className="text-white font-medium">
                    {viewSchedule.endDate
                      ? formatDate(viewSchedule.endDate)
                      : "Ongoing"}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Status</div>
                  <span
                    className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                      viewSchedule.status === "active"
                        ? "bg-green-600/20 text-green-600"
                        : viewSchedule.status === "completed"
                        ? "bg-blue-600/20 text-blue-600"
                        : "bg-gray-600/20 text-gray-400"
                    }`}
                  >
                    {viewSchedule.status}
                  </span>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Workout Days</div>
                  <div className="text-white font-medium">
                    {viewSchedule.workouts?.length || 0} days
                  </div>
                </div>
              </div>

              {viewSchedule.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">
                    Description
                  </h3>
                  <p className="text-gray-300">{viewSchedule.description}</p>
                </div>
              )}

              {viewSchedule.cardio &&
                viewSchedule.cardio.length > 0 &&
                viewSchedule.cardio[0].exerciseId && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-3">
                      Cardio Exercises
                    </h3>
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                      <div className="space-y-2">
                        {viewSchedule.cardio.map((cardio, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                          >
                            <span className="text-white font-medium">
                              {getExerciseName(cardio.exerciseId)}
                            </span>
                            <span className="px-3 py-1 bg-purple-600/20 text-purple-600 rounded text-sm">
                              {cardio.time} min
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {viewSchedule.warmUp &&
                viewSchedule.warmUp.length > 0 &&
                viewSchedule.warmUp[0].exerciseId && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-3">
                      Warm-up Exercises
                    </h3>
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                      <div className="space-y-3">
                        {viewSchedule.warmUp.map((warmup, index) => (
                          <div
                            key={index}
                            className="bg-gray-800 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white font-medium">
                                {getExerciseName(warmup.exerciseId)}
                              </span>
                              <div className="flex gap-2">
                                <span className="px-2 py-1 bg-blue-600/20 text-blue-600 rounded text-xs">
                                  {warmup.reps}
                                </span>
                                {warmup.rest && (
                                  <span className="px-2 py-1 bg-green-600/20 text-green-600 rounded text-xs">
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

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Workout Schedule
                </h3>
                <div className="space-y-4">
                  {viewSchedule.workouts?.map((workout, index) => (
                    <div
                      key={index}
                      className="bg-gray-900 border border-gray-700 rounded-xl p-5"
                    >
                      <h4 className="text-lg font-bold text-white mb-4 capitalize flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                          {index + 1}
                        </div>
                        {workout.day}
                      </h4>

                      <div className="space-y-3">
                        {workout.exercises?.map((exercise, exIndex) => (
                          <div
                            key={exIndex}
                            className="bg-gray-800 rounded-lg p-4"
                          >
                            <div className="mb-3">
                              <h5 className="text-white font-medium text-lg mb-2">
                                {getExerciseName(exercise.exerciseId)}
                              </h5>
                            </div>

                            <div className="space-y-2">
                              {exercise.sets && exercise.sets.length > 0 ? (
                                exercise.sets.map((set, setIndex) => (
                                  <div
                                    key={setIndex}
                                    className="flex items-center gap-3 text-sm"
                                  >
                                    <span className="text-gray-400 w-16">
                                      Set {setIndex + 1}:
                                    </span>
                                    <span className="px-3 py-1 bg-blue-600/20 text-blue-600 rounded">
                                      {set.reps} reps
                                    </span>
                                    {set.rest && (
                                      <span className="px-3 py-1 bg-green-600/20 text-green-600 rounded">
                                        Rest: {set.rest} min
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="flex gap-3 text-sm">
                                  {exercise.sets && (
                                    <span className="px-2 py-1 bg-blue-600/20 text-blue-600 rounded">
                                      {exercise.sets} sets
                                    </span>
                                  )}
                                  {exercise.reps && (
                                    <span className="px-2 py-1 bg-green-600/20 text-green-600 rounded">
                                      {exercise.reps} reps
                                    </span>
                                  )}
                                  {exercise.duration && (
                                    <span className="px-2 py-1 bg-purple-600/20 text-purple-600 rounded">
                                      {exercise.duration} min
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {exercise.notes && (
                              <p className="text-sm text-gray-400 mt-3">
                                <span className="text-yellow-600">💡</span>{" "}
                                {exercise.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {viewSchedule.warmDown &&
                viewSchedule.warmDown.length > 0 &&
                viewSchedule.warmDown[0].exerciseId && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-3">
                      Warm-down / Cooling Down
                    </h3>
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                      <div className="space-y-2">
                        {viewSchedule.warmDown.map((warmdown, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                          >
                            <span className="text-white font-medium">
                              {getExerciseName(warmdown.exerciseId)}
                            </span>
                            <span className="px-3 py-1 bg-purple-600/20 text-purple-600 rounded text-sm">
                              {warmdown.time} min
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {viewSchedule.notes && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">
                    Additional Notes
                  </h3>
                  <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-4">
                    <p className="text-yellow-600">{viewSchedule.notes}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setViewSchedule(null)}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && scheduleToAssign && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Assign Schedule to Members
                </h2>
                <p className="text-gray-400 mt-1">
                  {scheduleToAssign.title}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setScheduleToAssign(null);
                  setSelectedMembersToAssign([]);
                  setAssignDueDate("");
                }}
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

            {/* Due Date */}
            <div className="mb-6">
              <label className="block text-gray-300 mb-2">
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Members List */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white mb-3">
                Select Members ({selectedMembersToAssign.length} selected)
              </h3>
              {members.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  No members available
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {members.map((member) => (
                    <label
                      key={member.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        selectedMembersToAssign.includes(member.id)
                          ? "bg-purple-600/20 border-purple-600"
                          : "bg-gray-900 border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembersToAssign.includes(member.id)}
                        onChange={() => toggleMemberSelection(member.id)}
                        className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">{member.name}</p>
                        <p className="text-gray-400 text-sm">{member.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setScheduleToAssign(null);
                  setSelectedMembersToAssign([]);
                  setAssignDueDate("");
                }}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSchedule}
                disabled={selectedMembersToAssign.length === 0}
                className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                Assign to {selectedMembersToAssign.length} Member(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedules;
