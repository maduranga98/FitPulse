import { useState, useEffect } from "react";
import * as waitlistService from "../services/waitlistService";
import * as ratingService from "../services/ratingService";
import StarRating from "./StarRating";
import {
  X,
  Calendar,
  Clock,
  Users,
  MapPin,
  Award,
  UserPlus,
  UserMinus,
  CheckCircle,
  AlertCircle,
  UserCheck,
  TrendingUp,
  Target,
  Star,
} from "lucide-react";

const ClassDetailsModal = ({
  classData,
  isOpen,
  onClose,
  onBook,
  onCancel,
  currentUser,
  isBooked,
  isFull,
  isOwner = false,
}) => {
  const [members, setMembers] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState(null);

  useEffect(() => {
    if (isOpen && classData) {
      fetchClassMembers();
    }
  }, [isOpen, classData]);

  const fetchClassMembers = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, doc, getDoc } = await import("firebase/firestore");

      // Fetch all bookings for this class
      const bookingsQuery = query(
        collection(db, "classBookings"),
        where("classId", "==", classData.id),
        where("status", "in", ["confirmed", "attended"])
      );

      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch member names for bookings that don't have memberName
      const enrichedBookings = await Promise.all(
        bookingsData.map(async (booking) => {
          // If memberName exists, use it
          if (booking.memberName) {
            return booking;
          }

          // Otherwise, fetch from members collection
          try {
            const memberDoc = await getDoc(doc(db, "members", booking.memberId));
            if (memberDoc.exists()) {
              return {
                ...booking,
                memberName: memberDoc.data().name || "Member",
              };
            }
          } catch (error) {
            console.error("Error fetching member name:", error);
          }

          // Fallback if member not found
          return {
            ...booking,
            memberName: "Member",
          };
        })
      );

      // If owner, calculate attendance stats
      if (isOwner && enrichedBookings.length > 0) {
        const attendedCount = enrichedBookings.filter((b) => b.status === "attended").length;
        const confirmedCount = enrichedBookings.filter((b) => b.status === "confirmed").length;
        setAttendanceStats({
          total: enrichedBookings.length,
          attended: attendedCount,
          confirmed: confirmedCount,
          attendanceRate: ((attendedCount / enrichedBookings.length) * 100).toFixed(0),
        });
      }

      // Fetch waitlist for this class
      const waitlistData = await waitlistService.getClassWaitlist(classData.id);

      // Fetch reviews for this class
      const reviewsData = await ratingService.getClassReviews(classData.id);
      const avgRating = await ratingService.getAverageRating(classData.id);

      setMembers(enrichedBookings);
      setWaitlist(waitlistData);
      setReviews(reviewsData);
      setAverageRating(avgRating);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching class members:", error);
      setLoading(false);
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

      // Refresh members list
      fetchClassMembers();
      alert("Attendance marked! ✓");
    } catch (error) {
      console.error("Error marking attendance:", error);
      alert("Failed to mark attendance. Please try again.");
    }
  };

  if (!isOpen || !classData) return null;

  // Privacy control: show member names only to enrolled members or owners
  const canViewMembers = isOwner || isBooked;
  const spotsLeft = classData.maxCapacity - (classData.currentBookings || members.length);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl max-w-3xl w-full my-4 sm:my-8 mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {classData.className}
              </h2>
              <p className="text-white/80">with {classData.instructorName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Class Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Schedule</p>
                  <p className="text-white font-medium">{classData.schedule?.day}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Time & Duration</p>
                  <p className="text-white font-medium">
                    {classData.schedule?.time} ({classData.schedule?.duration}min)
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Capacity</p>
                  <p className="text-white font-medium">
                    {members.length}/{classData.maxCapacity} enrolled
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    spotsLeft > 5 ? "bg-green-600" : spotsLeft > 0 ? "bg-orange-600" : "bg-red-600"
                  }`}
                >
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Availability</p>
                  <p className="text-white font-medium">
                    {spotsLeft > 0 ? `${spotsLeft} spots left` : "Class Full"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {classData.description && (
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-400" />
                About This Class
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">{classData.description}</p>
            </div>
          )}

          {/* Owner Stats */}
          {isOwner && attendanceStats && (
            <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-lg p-4 border border-indigo-500/30">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                Attendance Statistics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{attendanceStats.total}</p>
                  <p className="text-xs text-gray-400">Total Enrolled</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{attendanceStats.attended}</p>
                  <p className="text-xs text-gray-400">Attended</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-400">{attendanceStats.confirmed}</p>
                  <p className="text-xs text-gray-400">Confirmed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-400">{attendanceStats.attendanceRate}%</p>
                  <p className="text-xs text-gray-400">Attendance Rate</p>
                </div>
              </div>
            </div>
          )}

          {/* Enrolled Members */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Enrolled Members ({members.length})
            </h3>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">Loading members...</p>
              </div>
            ) : members.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition ${
                      member.status === "attended"
                        ? "bg-green-900/20 border border-green-500/30"
                        : "bg-gray-800 border border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {canViewMembers ? member.memberName?.charAt(0).toUpperCase() : "?"}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {canViewMembers ? member.memberName : "Member"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {member.status === "attended" ? (
                            <span className="text-green-400">✓ Attended</span>
                          ) : (
                            <span className="text-blue-400">Confirmed</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {isOwner && member.status === "confirmed" && (
                      <button
                        onClick={() => handleMarkAttendance(member.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition flex items-center gap-1"
                      >
                        <UserCheck className="w-3 h-3" />
                        Mark Attended
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No members enrolled yet</p>
              </div>
            )}

            {!canViewMembers && members.length > 0 && (
              <div className="mt-3 bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Book this class to see who else is enrolled
                </p>
              </div>
            )}
          </div>

          {/* Waitlist Section */}
          {waitlist.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-4 border border-yellow-700">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                Waitlist ({waitlist.length})
              </h3>

              {isOwner ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {waitlist.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">#{entry.position}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">{entry.memberName}</p>
                          <p className="text-gray-400 text-xs">
                            Joined {new Date(entry.joinedAt?.seconds * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Clock className="w-12 h-12 text-yellow-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">
                    {waitlist.length} {waitlist.length === 1 ? 'person' : 'people'} waiting for this class
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Reviews Section */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Reviews ({averageRating.count})
              </h3>
              {averageRating.count > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating rating={Math.round(averageRating.average)} readonly size="sm" />
                  <span className="text-yellow-400 font-bold">{averageRating.average}</span>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 bg-gray-800 border border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{review.memberName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StarRating rating={review.rating} readonly size="sm" />
                          <span className="text-xs text-gray-400">
                            {new Date(review.createdAt?.seconds * 1000).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    {review.review && (
                      <p className="text-sm text-gray-300 mt-2">{review.review}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Star className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No reviews yet</p>
                <p className="text-gray-500 text-xs mt-1">Be the first to rate this class!</p>
              </div>
            )}
          </div>


          {/* Action Buttons (for members only) */}
          {!isOwner && (
            <div className="flex gap-3">
              {isBooked ? (
                <button
                  onClick={() => {
                    onCancel();
                    onClose();
                  }}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <UserMinus className="w-5 h-5" />
                  Cancel Booking
                </button>
              ) : isFull ? (
                <button
                  disabled
                  className="flex-1 py-3 bg-gray-700 text-gray-400 rounded-lg font-medium cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <AlertCircle className="w-5 h-5" />
                  Class Full
                </button>
              ) : (
                <button
                  onClick={() => {
                    onBook();
                    onClose();
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  Book This Class
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassDetailsModal;
