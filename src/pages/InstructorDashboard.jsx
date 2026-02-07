import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import { Users, Calendar, BookOpen, Settings } from "lucide-react";

const InstructorDashboard = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [instructorData, setInstructorData] = useState(null);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      fetchInstructorData();
    }
  }, [currentUser]);

  const fetchInstructorData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, getDoc, collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      // Fetch instructor data
      const instructorRef = doc(db, "users", currentUser.id);
      const instructorSnap = await getDoc(instructorRef);

      if (instructorSnap.exists()) {
        setInstructorData({ id: instructorSnap.id, ...instructorSnap.data() });
      }

      // Fetch upcoming classes (if instructor is assigned to classes)
      const classesQuery = query(
        collection(db, "classes"),
        where("instructorId", "==", currentUser.id),
        where("gymId", "==", currentUser.gymId)
      );
      const classesSnapshot = await getDocs(classesQuery);
      const classesData = classesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setUpcomingClasses(classesData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching instructor data:", error);
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const instructor = instructorData || currentUser;

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {getGreeting()}, {instructor?.name?.split(" ")[0] || "Instructor"}! 👋
          </h1>
          <p className="text-gray-400">
            Welcome to your instructor dashboard
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-blue-100 text-sm">Upcoming Classes</p>
                <p className="text-3xl font-bold">{upcomingClasses.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-purple-100 text-sm">Your Specialty</p>
                <p className="text-xl font-bold truncate">
                  {instructor?.specialization || "N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-green-100 text-sm">Experience</p>
                <p className="text-3xl font-bold">
                  {instructor?.experience || "0"}
                  <span className="text-lg ml-1">yrs</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => navigate("/instructor/exercises")}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500/50 rounded-xl p-6 transition text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center group-hover:bg-blue-600/30 transition">
                <svg
                  className="w-6 h-6 text-blue-600"
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
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">Manage Exercises</h3>
                <p className="text-gray-400 text-sm">Create and assign exercises</p>
              </div>
              <svg
                className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>

          <button
            onClick={() => navigate("/instructor/meal-plans")}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500/50 rounded-xl p-6 transition text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center group-hover:bg-green-600/30 transition">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">Assign Meal Plans</h3>
                <p className="text-gray-400 text-sm">Manage member nutrition</p>
              </div>
              <svg
                className="w-5 h-5 text-gray-600 group-hover:text-green-600 transition"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>

          <button
            onClick={() => navigate("/instructor/analytics")}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-500/50 rounded-xl p-6 transition text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center group-hover:bg-purple-600/30 transition">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">Member Analytics</h3>
                <p className="text-gray-400 text-sm">Track member progress</p>
              </div>
              <svg
                className="w-5 h-5 text-gray-600 group-hover:text-purple-600 transition"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        </div>

        {/* Instructor Profile Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Your Profile
              </h2>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {instructor?.name?.charAt(0) || "I"}
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">
                    {instructor?.name}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {instructor?.specialization || "Instructor"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Email</p>
                  <p className="text-white">{instructor?.email}</p>
                </div>
                {instructor?.phone && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Phone</p>
                    <p className="text-white">{instructor?.phone}</p>
                  </div>
                )}
                {instructor?.certification && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Certifications</p>
                    <p className="text-white">{instructor?.certification}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Upcoming Classes
              </h2>
              
              {upcomingClasses.length > 0 ? (
                <div className="space-y-3">
                  {upcomingClasses.map((classItem) => {
                    // Handle schedule object or string
                    let scheduleText = "Time not set";
                    if (classItem.schedule) {
                      if (typeof classItem.schedule === 'object') {
                        const { day, time, duration } = classItem.schedule;
                        scheduleText = `${day || ''} ${time || ''} (${duration || 'N/A'})`.trim();
                      } else {
                        scheduleText = classItem.schedule;
                      }
                    }

                    return (
                      <div
                        key={classItem.id}
                        className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-blue-500/50 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-white font-semibold">
                              {classItem.name}
                            </h3>
                            <p className="text-gray-400 text-sm">
                              {scheduleText}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">
                              Capacity: {classItem.currentParticipants || 0}/
                              {classItem.maxCapacity || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">
                    No upcoming classes assigned yet
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Contact your gym administrator to get assigned to classes
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default InstructorDashboard;
