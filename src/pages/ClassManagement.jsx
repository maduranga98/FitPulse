import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Layout from "../components/Layout";
import {
  Calendar,
  Clock,
  Users,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  UserCheck,
  Filter,
} from "lucide-react";

const ClassManagement = () => {
  const { user: currentUser } = useAuth();

  const [classes, setClasses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeTab, setActiveTab] = useState("classes");

  const [classForm, setClassForm] = useState({
    className: "",
    instructorId: "",
    instructorName: "",
    schedule: {
      day: "Monday",
      time: "09:00",
      duration: 60,
    },
    maxCapacity: 20,
    description: "",
    isActive: true,
  });

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import("firebase/firestore");

      // Fetch classes for this gym
      const classesQuery = query(
        collection(db, "classes"),
        where("gymId", "==", currentUser.gymId),
        orderBy("schedule.day", "asc")
      );
      const classesSnapshot = await getDocs(classesQuery);
      const classesData = classesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch instructors (trainers) for this gym
      const instructorsQuery = query(
        collection(db, "users"),
        where("gymId", "==", currentUser.gymId),
        where("role", "==", "trainer")
      );
      const instructorsSnapshot = await getDocs(instructorsQuery);
      const instructorsData = instructorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch all bookings for classes
      const bookingsQuery = query(
        collection(db, "classBookings"),
        where("gymId", "==", currentUser.gymId)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calculate booking counts for each class
      const classesWithCounts = classesData.map((classItem) => ({
        ...classItem,
        bookingCount: bookingsData.filter(
          (b) => b.classId === classItem.id && (b.status === "confirmed" || b.status === "attended")
        ).length,
      }));

      setClasses(classesWithCounts);
      setInstructors(instructorsData);
      setBookings(bookingsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleOpenModal = (classItem = null) => {
    if (classItem) {
      setEditingClass(classItem);
      setClassForm({
        className: classItem.className,
        instructorId: classItem.instructorId,
        instructorName: classItem.instructorName,
        schedule: classItem.schedule || {
          day: "Monday",
          time: "09:00",
          duration: 60,
        },
        maxCapacity: classItem.maxCapacity,
        description: classItem.description || "",
        isActive: classItem.isActive,
      });
    } else {
      setEditingClass(null);
      setClassForm({
        className: "",
        instructorId: "",
        instructorName: "",
        schedule: {
          day: "Monday",
          time: "09:00",
          duration: 60,
        },
        maxCapacity: 20,
        description: "",
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSaveClass = async (e) => {
    e.preventDefault();

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, doc, updateDoc, Timestamp } = await import("firebase/firestore");

      const selectedInstructor = instructors.find((i) => i.id === classForm.instructorId);

      const classData = {
        className: classForm.className,
        instructorId: classForm.instructorId,
        instructorName: selectedInstructor?.name || classForm.instructorName,
        schedule: classForm.schedule,
        maxCapacity: parseInt(classForm.maxCapacity),
        description: classForm.description,
        gymId: currentUser.gymId,
        isActive: classForm.isActive,
      };

      if (editingClass) {
        await updateDoc(doc(db, "classes", editingClass.id), {
          ...classData,
          updatedAt: Timestamp.now(),
        });
        alert("Class updated successfully! 🎉");
      } else {
        await addDoc(collection(db, "classes"), {
          ...classData,
          createdAt: Timestamp.now(),
        });
        alert("Class created successfully! 🎉");
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error saving class:", error);
      alert("Failed to save class. Please try again.");
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!confirm("Are you sure you want to delete this class? This action cannot be undone.")) {
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "classes", classId));
      fetchData();
      alert("Class deleted successfully.");
    } catch (error) {
      console.error("Error deleting class:", error);
      alert("Failed to delete class. Please try again.");
    }
  };

  const handleMarkAttendance = async (bookingId) => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc, Timestamp } = await import("firebase/firestore");

      await updateDoc(doc(db, "classBookings", bookingId), {
        status: "attended",
        attendedAt: Timestamp.now(),
      });

      fetchData();
      alert("Attendance marked! ✓");
    } catch (error) {
      console.error("Error marking attendance:", error);
      alert("Failed to mark attendance. Please try again.");
    }
  };

  const getClassBookings = (classId) => {
    return bookings.filter(
      (b) => b.classId === classId && (b.status === "confirmed" || b.status === "attended")
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading classes...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Class Management</h1>
              <p className="text-gray-400">Create and manage fitness classes</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Create Class
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab("classes")}
              className={`flex-1 px-6 py-4 font-medium transition ${
                activeTab === "classes"
                  ? "text-indigo-500 border-b-2 border-indigo-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              All Classes ({classes.length})
            </button>
            <button
              onClick={() => setActiveTab("bookings")}
              className={`flex-1 px-6 py-4 font-medium transition ${
                activeTab === "bookings"
                  ? "text-indigo-500 border-b-2 border-indigo-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Bookings & Attendance
            </button>
          </div>

          <div className="p-6">
            {/* Classes Tab */}
            {activeTab === "classes" && (
              <div>
                {classes.length > 0 ? (
                  <div className="space-y-4">
                    {classes.map((classItem) => (
                      <div
                        key={classItem.id}
                        className={`bg-gray-900 rounded-lg border p-6 transition ${
                          classItem.isActive
                            ? "border-gray-700 hover:border-indigo-500/50"
                            : "border-gray-700 opacity-60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-bold text-white">
                                {classItem.className}
                              </h3>
                              {!classItem.isActive && (
                                <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded">
                                  Inactive
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                              <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Calendar className="w-4 h-4 text-indigo-400" />
                                <span>{classItem.schedule?.day}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Clock className="w-4 h-4 text-indigo-400" />
                                <span>
                                  {classItem.schedule?.time} ({classItem.schedule?.duration} min)
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Users className="w-4 h-4 text-indigo-400" />
                                <span>
                                  {classItem.bookingCount}/{classItem.maxCapacity} booked
                                </span>
                              </div>
                            </div>

                            {classItem.description && (
                              <p className="text-sm text-gray-400 mb-3">
                                {classItem.description}
                              </p>
                            )}

                            <p className="text-sm text-gray-500">
                              Instructor: {classItem.instructorName}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedClass(classItem);
                                setActiveTab("bookings");
                              }}
                              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                              title="View bookings"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenModal(classItem)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                              title="Edit class"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClass(classItem.id)}
                              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                              title="Delete class"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📅</div>
                    <h3 className="text-xl font-bold text-white mb-2">No Classes Yet</h3>
                    <p className="text-gray-400 mb-6">
                      Create your first class to get started!
                    </p>
                    <button
                      onClick={() => handleOpenModal()}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition"
                    >
                      Create First Class
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bookings & Attendance Tab */}
            {activeTab === "bookings" && (
              <div>
                {selectedClass && (
                  <div className="mb-6 bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">
                          {selectedClass.className}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {selectedClass.schedule?.day} at {selectedClass.schedule?.time}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedClass(null)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition"
                      >
                        View All Classes
                      </button>
                    </div>
                  </div>
                )}

                {classes.map((classItem) => {
                  if (selectedClass && classItem.id !== selectedClass.id) return null;

                  const classBookings = getClassBookings(classItem.id);

                  if (classBookings.length === 0 && selectedClass) {
                    return (
                      <div key={classItem.id} className="text-center py-12">
                        <div className="text-6xl mb-4">📋</div>
                        <h3 className="text-xl font-bold text-white mb-2">
                          No Bookings Yet
                        </h3>
                        <p className="text-gray-400">
                          No members have booked this class yet.
                        </p>
                      </div>
                    );
                  }

                  if (classBookings.length === 0) return null;

                  return (
                    <div key={classItem.id} className="mb-8">
                      {!selectedClass && (
                        <h3 className="text-lg font-bold text-white mb-4">
                          {classItem.className} - {classItem.schedule?.day} at{" "}
                          {classItem.schedule?.time}
                        </h3>
                      )}

                      <div className="space-y-3">
                        {classBookings.map((booking) => (
                          <div
                            key={booking.id}
                            className={`bg-gray-900 rounded-lg border p-4 flex items-center justify-between ${
                              booking.status === "attended"
                                ? "border-green-500/30 bg-green-900/10"
                                : "border-gray-700"
                            }`}
                          >
                            <div>
                              <p className="text-white font-medium mb-1">
                                {booking.memberName}
                              </p>
                              <p className="text-sm text-gray-400">
                                {booking.status === "attended" ? (
                                  <span className="text-green-400">✓ Attended</span>
                                ) : (
                                  <span className="text-blue-400">Confirmed</span>
                                )}
                              </p>
                            </div>
                            {booking.status === "confirmed" && (
                              <button
                                onClick={() => handleMarkAttendance(booking.id)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                              >
                                <UserCheck className="w-4 h-4" />
                                Mark Attended
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {!selectedClass && classes.every((c) => getClassBookings(c.id).length === 0) && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      No Bookings Yet
                    </h3>
                    <p className="text-gray-400">
                      No members have booked any classes yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Class Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingClass ? "Edit Class" : "Create New Class"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveClass} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    value={classForm.className}
                    onChange={(e) =>
                      setClassForm({ ...classForm, className: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., HIIT Cardio, Yoga Basics"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Instructor *
                  </label>
                  <select
                    value={classForm.instructorId}
                    onChange={(e) =>
                      setClassForm({ ...classForm, instructorId: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select instructor...</option>
                    {instructors.map((instructor) => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Day *
                    </label>
                    <select
                      value={classForm.schedule.day}
                      onChange={(e) =>
                        setClassForm({
                          ...classForm,
                          schedule: { ...classForm.schedule, day: e.target.value },
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      {daysOfWeek.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Time *
                    </label>
                    <input
                      type="time"
                      value={classForm.schedule.time}
                      onChange={(e) =>
                        setClassForm({
                          ...classForm,
                          schedule: { ...classForm.schedule, time: e.target.value },
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Duration (min) *
                    </label>
                    <input
                      type="number"
                      min="15"
                      max="180"
                      value={classForm.schedule.duration}
                      onChange={(e) =>
                        setClassForm({
                          ...classForm,
                          schedule: {
                            ...classForm.schedule,
                            duration: parseInt(e.target.value),
                          },
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={classForm.maxCapacity}
                    onChange={(e) =>
                      setClassForm({ ...classForm, maxCapacity: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={classForm.description}
                    onChange={(e) =>
                      setClassForm({ ...classForm, description: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Brief description of the class..."
                    rows="3"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={classForm.isActive}
                    onChange={(e) =>
                      setClassForm({ ...classForm, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-700 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-300">
                    Class is active and available for booking
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingClass ? "Update Class" : "Create Class"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ClassManagement;
