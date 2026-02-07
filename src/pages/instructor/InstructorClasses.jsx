import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import StarRating from "../../components/StarRating";
import AnnouncementModal from "../../components/AnnouncementModal";
import { notificationService } from "../../services/notificationService";
import * as waitlistService from "../../services/waitlistService";
import * as ratingService from "../../services/ratingService";
import {
  Calendar,
  ArrowLeft,
  Clock,
  Users,
  UserCheck,
  UserMinus,
  Info,
  Bell,
  Star,
  X,
  Edit2,
  TrendingUp,
  MessageSquare,
} from "lucide-react";

const InstructorClasses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentGymId = user?.gymId;

  // State management
  const [classes, setClasses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [newCapacity, setNewCapacity] = useState("");
  const [waitlistEntries, setWaitlistEntries] = useState([]);

  useEffect(() => {
    if (currentGymId && user?.id) {
      fetchData();
    }
  }, [currentGymId, user?.id]);

  const fetchData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch classes where this instructor is assigned
      const classesQuery = query(
        collection(db, "classes"),
        where("gymId", "==", currentGymId),
        where("instructorId", "==", user.id),
        where("isActive", "==", true),
        orderBy("schedule.day", "asc")
      );
      const classesSnapshot = await getDocs(classesQuery);
      const classesData = classesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch all bookings for these classes
      const classIds = classesData.map((c) => c.id);
      let allBookings = [];
      
      if (classIds.length > 0) {
        // Fetch bookings in batches of 10 (Firestore limit for 'in' queries)
        for (let i = 0; i < classIds.length; i += 10) {
          const batch = classIds.slice(i, i + 10);
          const bookingsQuery = query(
            collection(db, "classBookings"),
            where("classId", "in", batch),
            where("gymId", "==", currentGymId)
          );
          const bookingsSnapshot = await getDocs(bookingsQuery);
          const batchBookings = bookingsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          allBookings = [...allBookings, ...batchBookings];
        }
      }

      // Fetch ratings for these classes
      let allRatings = [];
      if (classIds.length > 0) {
        for (let i = 0; i < classIds.length; i += 10) {
          const batch = classIds.slice(i, i + 10);
          const ratingsQuery = query(
            collection(db, "ratings"),
            where("classId", "in", batch)
          );
          const ratingsSnapshot = await getDocs(ratingsQuery);
          const batchRatings = ratingsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          allRatings = [...allRatings, ...batchRatings];
        }
      }

      // Calculate stats for each class
      const classesWithStats = await Promise.all(
        classesData.map(async (classItem) => {
          const classBookings = allBookings.filter(
            (b) =>
              b.classId === classItem.id &&
              (b.status === "confirmed" || b.status === "attended")
          );
          const classRatings = allRatings.filter(
            (r) => r.classId === classItem.id
          );

          const avgRating =
            classRatings.length > 0
              ? (
                  classRatings.reduce((sum, r) => sum + r.rating, 0) /
                  classRatings.length
                ).toFixed(1)
              : null;

          const waitlistCount = await waitlistService.getWaitlistCount(
            classItem.id
          );

          return {
            ...classItem,
            currentBookings: classBookings.length,
            spotsAvailable: classItem.maxCapacity - classBookings.length,
            totalRatings: classRatings.length,
            avgRating,
            waitlistCount,
          };
        })
      );

      setClasses(classesWithStats);
      setBookings(allBookings);
      setRatings(allRatings);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleViewBookings = (classItem) => {
    setSelectedClass(classItem);
    setShowBookingsModal(true);
  };

  const handleViewWaitlist = async (classItem) => {
    setSelectedClass(classItem);
    try {
      const entries = await waitlistService.getClassWaitlist(classItem.id);
      setWaitlistEntries(entries);
      setShowWaitlistModal(true);
    } catch (error) {
      console.error("Error fetching waitlist:", error);
      alert("Failed to fetch waitlist. Please try again.");
    }
  };

  const handleViewReviews = (classItem) => {
    setSelectedClass(classItem);
    setShowReviewsModal(true);
  };

  const handleSendAnnouncement = (classItem) => {
    setSelectedClass(classItem);
    setShowAnnouncementModal(true);
  };

  const handleUpdateCapacity = (classItem) => {
    setSelectedClass(classItem);
    setNewCapacity(classItem.maxCapacity.toString());
    setShowCapacityModal(true);
  };

  const handleSaveCapacity = async () => {
    const capacity = parseInt(newCapacity);
    if (isNaN(capacity) || capacity < 1) {
      alert("Please enter a valid capacity");
      return;
    }

    if (
      capacity < selectedClass.currentBookings
    ) {
      alert(
        `Cannot set capacity below current bookings (${selectedClass.currentBookings})`
      );
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { doc, updateDoc, Timestamp } = await import("firebase/firestore");

      await updateDoc(doc(db, "classes", selectedClass.id), {
        maxCapacity: capacity,
        updatedAt: Timestamp.now(),
      });

      alert("Class capacity updated successfully! 🎉");
      setShowCapacityModal(false);
      fetchData();
    } catch (error) {
      console.error("Error updating capacity:", error);
      alert("Failed to update capacity. Please try again.");
    }
  };

  const handleSendAnnouncementSubmit = async (title, message) => {
    try {
      const classBookings = bookings.filter(
        (b) =>
          b.classId === selectedClass.id &&
          (b.status === "confirmed" || b.status === "attended")
      );

      const memberIds = classBookings.map((b) => b.memberId);

      if (memberIds.length === 0) {
        alert("No enrolled members to notify.");
        return;
      }

      await notificationService.sendCustomAnnouncement(
        selectedClass.id,
        selectedClass.className,
        memberIds,
        title,
        message
      );

      alert(`Announcement sent to ${memberIds.length} member(s)! 📢`);
      setShowAnnouncementModal(false);
    } catch (error) {
      console.error("Error sending announcement:", error);
      alert("Failed to send announcement. Please try again.");
    }
  };

  const getClassBookings = (classId) => {
    return bookings.filter(
      (b) =>
        b.classId === classId &&
        (b.status === "confirmed" || b.status === "attended")
    );
  };

  const getClassRatings = (classId) => {
    return ratings.filter((r) => r.classId === classId);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your classes...</p>
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
          <h1 className="text-3xl font-bold text-white mb-2">My Classes</h1>
          <p className="text-gray-400">
            Manage your assigned classes, view members, and track engagement
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5" />
              <p className="text-sm text-blue-100">Total Classes</p>
            </div>
            <p className="text-3xl font-bold">{classes.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5" />
              <p className="text-sm text-green-100">Total Members</p>
            </div>
            <p className="text-3xl font-bold">
              {classes.reduce((sum, c) => sum + c.currentBookings, 0)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5" />
              <p className="text-sm text-yellow-100">Waitlisted</p>
            </div>
            <p className="text-3xl font-bold">
              {classes.reduce((sum, c) => sum + (c.waitlistCount || 0), 0)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-5 h-5" />
              <p className="text-sm text-purple-100">Avg Rating</p>
            </div>
            <p className="text-3xl font-bold">
              {classes.filter((c) => c.avgRating).length > 0
                ? (
                    classes
                      .filter((c) => c.avgRating)
                      .reduce((sum, c) => sum + parseFloat(c.avgRating), 0) /
                    classes.filter((c) => c.avgRating).length
                  ).toFixed(1)
                : "N/A"}
            </p>
          </div>
        </div>

        {/* Classes List */}
        <div className="space-y-6">
          {classes.length > 0 ? (
            classes.map((classItem) => (
              <div
                key={classItem.id}
                className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-indigo-500/50 transition"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {classItem.className}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span>{classItem.schedule?.day}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>
                          {classItem.schedule?.time} (
                          {classItem.schedule?.duration} min)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span>
                          {classItem.currentBookings}/{classItem.maxCapacity}{" "}
                          members
                        </span>
                      </div>
                      {classItem.avgRating && (
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Star className="w-4 h-4 text-yellow-400" />
                          <span>
                            {classItem.avgRating} ({classItem.totalRatings}{" "}
                            reviews)
                          </span>
                        </div>
                      )}
                    </div>
                    {classItem.description && (
                      <p className="text-sm text-gray-400 mt-3">
                        {classItem.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <button
                    onClick={() => handleViewBookings(classItem)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                  >
                    <UserCheck className="w-4 h-4" />
                    Members ({classItem.currentBookings})
                  </button>

                  {classItem.waitlistCount > 0 && (
                    <button
                      onClick={() => handleViewWaitlist(classItem)}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Clock className="w-4 h-4" />
                      Waitlist ({classItem.waitlistCount})
                    </button>
                  )}

                  <button
                    onClick={() => handleViewReviews(classItem)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                  >
                    <Star className="w-4 h-4" />
                    Reviews ({classItem.totalRatings})
                  </button>

                  <button
                    onClick={() => handleSendAnnouncement(classItem)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                  >
                    <Bell className="w-4 h-4" />
                    Notify
                  </button>

                  <button
                    onClick={() => handleUpdateCapacity(classItem)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Capacity
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
              <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                No Classes Assigned
              </h3>
              <p className="text-gray-400">
                You don't have any assigned classes yet. Contact your admin to get classes assigned.
              </p>
            </div>
          )}
        </div>

        {/* Bookings Modal */}
        {showBookingsModal && selectedClass && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Enrolled Members - {selectedClass.className}
                </h2>
                <button
                  onClick={() => setShowBookingsModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3">
                {getClassBookings(selectedClass.id).length > 0 ? (
                  getClassBookings(selectedClass.id).map((booking) => (
                    <div
                      key={booking.id}
                      className={`bg-gray-900 rounded-lg border p-4 ${
                        booking.status === "attended"
                          ? "border-green-500/30 bg-green-900/10"
                          : "border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">
                            {booking.memberName}
                          </p>
                          <p className="text-sm text-gray-400">
                            {booking.status === "attended" ? (
                              <span className="text-green-400">
                                ✓ Attended
                              </span>
                            ) : (
                              <span className="text-blue-400">Confirmed</span>
                            )}
                          </p>
                        </div>
                        {booking.status === "attended" && (
                          <div className="flex items-center gap-2 text-green-400">
                            <UserCheck className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No members enrolled yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Waitlist Modal */}
        {showWaitlistModal && selectedClass && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Waitlist - {selectedClass.className}
                </h2>
                <button
                  onClick={() => setShowWaitlistModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3">
                {waitlistEntries.length > 0 ? (
                  waitlistEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="bg-gray-900 rounded-lg border border-gray-700 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {entry.memberName}
                            </p>
                            <p className="text-sm text-gray-400">
                              {entry.email}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(
                            entry.joinedAt?.toDate
                              ? entry.joinedAt.toDate()
                              : entry.joinedAt
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No one on the waitlist</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reviews Modal */}
        {showReviewsModal && selectedClass && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Reviews - {selectedClass.className}
                </h2>
                <button
                  onClick={() => setShowReviewsModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {selectedClass.avgRating && (
                <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">
                        Average Rating
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-white">
                          {selectedClass.avgRating}
                        </span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-5 h-5 ${
                                star <= Math.round(selectedClass.avgRating)
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-gray-600"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">Total Reviews</p>
                      <p className="text-2xl font-bold text-white">
                        {selectedClass.totalRatings}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {getClassRatings(selectedClass.id).length > 0 ? (
                  getClassRatings(selectedClass.id).map((rating) => (
                    <div
                      key={rating.id}
                      className="bg-gray-900 rounded-lg border border-gray-700 p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-white font-medium">
                            {rating.memberName}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= rating.rating
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-gray-600"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-400">
                          {new Date(
                            rating.createdAt?.toDate
                              ? rating.createdAt.toDate()
                              : rating.createdAt
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      {rating.review && (
                        <p className="text-gray-300 text-sm mt-2">
                          {rating.review}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No reviews yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Capacity Modal */}
        {showCapacityModal && selectedClass && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Update Capacity
                </h2>
                <button
                  onClick={() => setShowCapacityModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-400 text-sm mb-4">
                  {selectedClass.className} - Currently{" "}
                  {selectedClass.currentBookings} members enrolled
                </p>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Maximum Capacity
                </label>
                <input
                  type="number"
                  min={selectedClass.currentBookings}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter new capacity"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Minimum: {selectedClass.currentBookings} (current bookings)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCapacityModal(false)}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCapacity}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition"
                >
                  Update Capacity
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Announcement Modal */}
        <AnnouncementModal
          classData={selectedClass}
          isOpen={showAnnouncementModal}
          onClose={() => setShowAnnouncementModal(false)}
          onSend={handleSendAnnouncementSubmit}
        />
      </div>
    </AdminLayout>
  );
};

export default InstructorClasses;
