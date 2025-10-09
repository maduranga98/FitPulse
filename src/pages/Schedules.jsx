import { useState, useEffect } from "react";

const Schedules = ({ onLogout, onNavigate, currentUser }) => {
  const [schedules, setSchedules] = useState([]);
  const [members, setMembers] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [viewSchedule, setViewSchedule] = useState(null);
  const [selectedMember, setSelectedMember] = useState("all");

  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "manager";
  const isMember = currentUser?.role === "member";

  const [scheduleForm, setScheduleForm] = useState({
    memberId: "",
    title: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    days: [],
    workouts: [
      {
        day: "monday",
        exercises: [
          { exerciseId: "", sets: "", reps: "", duration: "", notes: "" },
        ],
      },
    ],
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch schedules
      let schedulesQuery;
      if (isMember) {
        // Members see only their schedules
        schedulesQuery = query(
          collection(db, "schedules"),
          where("memberId", "==", currentUser.id),
          orderBy("startDate", "desc")
        );
      } else {
        // Admins see all schedules
        schedulesQuery = query(
          collection(db, "schedules"),
          orderBy("startDate", "desc")
        );
      }

      const schedulesSnapshot = await getDocs(schedulesQuery);
      const schedulesData = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch members (admin only)
      if (isAdmin) {
        const membersSnapshot = await getDocs(collection(db, "members"));
        const membersData = membersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMembers(membersData);
      }

      // Fetch exercises
      const exercisesSnapshot = await getDocs(collection(db, "exercises"));
      const exercisesData = exercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSchedules(schedulesData);
      setExercises(exercisesData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      alert("You don't have permission to create schedules");
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      // Clean up workouts - remove empty exercises
      const cleanedWorkouts = scheduleForm.workouts
        .map((workout) => ({
          ...workout,
          exercises: workout.exercises.filter((ex) => ex.exerciseId),
        }))
        .filter((workout) => workout.exercises.length > 0);

      const scheduleData = {
        ...scheduleForm,
        workouts: cleanedWorkouts,
        startDate: Timestamp.fromDate(new Date(scheduleForm.startDate)),
        endDate: scheduleForm.endDate
          ? Timestamp.fromDate(new Date(scheduleForm.endDate))
          : null,
        createdAt: Timestamp.now(),
        createdBy: currentUser.id,
      };

      await addDoc(collection(db, "schedules"), scheduleData);

      setShowAddSchedule(false);
      setScheduleForm({
        memberId: "",
        title: "",
        description: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        days: [],
        workouts: [
          {
            day: "monday",
            exercises: [
              { exerciseId: "", sets: "", reps: "", duration: "", notes: "" },
            ],
          },
        ],
        status: "active",
        notes: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error adding schedule:", error);
      alert("Failed to add schedule");
    }
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

  const addWorkoutDay = () => {
    setScheduleForm({
      ...scheduleForm,
      workouts: [
        ...scheduleForm.workouts,
        {
          day: "monday",
          exercises: [
            { exerciseId: "", sets: "", reps: "", duration: "", notes: "" },
          ],
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
      sets: "",
      reps: "",
      duration: "",
      notes: "",
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

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("gymUser");
      window.location.reload();
    }
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
      {/* Sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 z-50 h-full w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-300 lg:translate-x-0 flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 p-6 border-b border-gray-700 flex-shrink-0">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Gym Manager</span>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button
              onClick={() =>
                onNavigate(isMember ? "member-dashboard" : "dashboard")
              }
              className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
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
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="font-medium">Dashboard</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => onNavigate("members")}
                className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
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
                <span className="font-medium">Members</span>
              </button>
            )}

            <button
              onClick={() => onNavigate("schedules")}
              className="flex items-center gap-3 px-4 py-3 w-full text-left bg-blue-600 text-white rounded-lg"
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="font-medium">Schedules</span>
            </button>

            <button
              onClick={() => onNavigate("exercises")}
              className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="font-medium">Exercises</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => onNavigate("payments")}
                className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
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
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span className="font-medium">Payments</span>
              </button>
            )}
          </nav>

          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <div className="mb-3 px-4">
              <div className="text-xs text-gray-500 mb-1">Logged in as</div>
              <div className="text-sm text-white font-medium">
                {currentUser?.name || currentUser?.username}
              </div>
              <div className="text-xs text-gray-400 capitalize">
                {currentUser?.role || "Member"}
              </div>
            </div>
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
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
                <span className="hidden sm:inline">Create Schedule</span>
                <span className="sm:hidden">New</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Filter */}
          {isAdmin && members.length > 0 && (
            <div className="mb-6">
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Members</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Schedules Grid */}
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
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                  >
                    Create First Schedule
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
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* Add Schedule Modal */}
      {showAddSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                Create Workout Schedule
              </h2>
              <button
                onClick={() => setShowAddSchedule(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
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

            <form onSubmit={handleAddSchedule} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Select Member */}
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
                    required
                  >
                    <option value="">Select a member</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} - {member.level}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Schedule Title *
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
                    required
                  />
                </div>

                {/* Description */}
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

                {/* Start Date */}
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
                    required
                  />
                </div>

                {/* End Date */}
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

                {/* Status */}
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

                      {/* Exercises for this day */}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                              {/* Exercise Selection */}
                              <div className="lg:col-span-2">
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

                              {/* Sets */}
                              <div>
                                <input
                                  type="text"
                                  value={exercise.sets}
                                  onChange={(e) =>
                                    updateExercise(
                                      dayIndex,
                                      exerciseIndex,
                                      "sets",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Sets (e.g., 3)"
                                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              {/* Reps */}
                              <div>
                                <input
                                  type="text"
                                  value={exercise.reps}
                                  onChange={(e) =>
                                    updateExercise(
                                      dayIndex,
                                      exerciseIndex,
                                      "reps",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Reps (e.g., 10-12)"
                                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              {/* Duration */}
                              <div>
                                <input
                                  type="text"
                                  value={exercise.duration}
                                  onChange={(e) =>
                                    updateExercise(
                                      dayIndex,
                                      exerciseIndex,
                                      "duration",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Duration (min)"
                                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Notes */}
                            <div className="mt-3">
                              <input
                                type="text"
                                value={exercise.notes}
                                onChange={(e) =>
                                  updateExercise(
                                    dayIndex,
                                    exerciseIndex,
                                    "notes",
                                    e.target.value
                                  )
                                }
                                placeholder="Notes (e.g., Focus on form, increase weight gradually)"
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            {/* Remove Exercise */}
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
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Create Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSchedule(false)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Schedule Modal */}
      {viewSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
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
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
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
              {/* Schedule Info */}
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

              {/* Description */}
              {viewSchedule.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">
                    Description
                  </h3>
                  <p className="text-gray-300">{viewSchedule.description}</p>
                </div>
              )}

              {/* Workout Days */}
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
                            <div className="flex items-start justify-between mb-2">
                              <h5 className="text-white font-medium">
                                {getExerciseName(exercise.exerciseId)}
                              </h5>
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
                            </div>
                            {exercise.notes && (
                              <p className="text-sm text-gray-400 mt-2">
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

              {/* General Notes */}
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
    </div>
  );
};

export default Schedules;
