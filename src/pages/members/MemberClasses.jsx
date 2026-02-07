import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import MemberLayout from "../../components/MemberLayout";
import ClassDetailsModal from "../../components/ClassDetailsModal";
import CalendarView from "../../components/CalendarView";
import StarRating from "../../components/StarRating";
import { notificationService } from "../../services/notificationService";
import * as waitlistService from "../../services/waitlistService";
import * as ratingService from "../../services/ratingService";
import {
  Calendar,
  Clock,
  Users,
  UserPlus,
  UserMinus,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
  Info,
  Star,
  X,
} from "lucide-react";

const MemberClasses = () => {
  const { user: currentUser } = useAuth();

  const [classes, setClasses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("available");
  const [selectedDay, setSelectedDay] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassDetails, setSelectedClassDetails] = useState(null);
  
  // Rating modal state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingClass, setRatingClass] = useState(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import("firebase/firestore");

      // Fetch active classes for this gym
      const classesQuery = query(
        collection(db, "classes"),
        where("gymId", "==", currentUser.gymId),
        where("isActive", "==", true),
        orderBy("schedule.day", "asc")
      );
      const classesSnapshot = await getDocs(classesQuery);
      const classesData = classesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch member's bookings
      const bookingsQuery = query(
        collection(db, "classBookings"),
        where("memberId", "==", currentUser.id),
        where("gymId", "==", currentUser.gymId)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        bookingDate: doc.data().bookingDate?.toDate
          ? doc.data().bookingDate.toDate()
          : new Date(doc.data().bookingDate),
        bookedAt: doc.data().bookedAt?.toDate
          ? doc.data().bookedAt.toDate()
          : new Date(doc.data().bookedAt),
      }));

      // Fetch booking counts for each class
      const classesWithBookings = await Promise.all(
        classesData.map(async (classItem) => {
          const classBookingsQuery = query(
            collection(db, "classBookings"),
            where("classId", "==", classItem.id),
            where("status", "in", ["confirmed", "attended"])
          );
          const classBookingsSnapshot = await getDocs(classBookingsQuery);
          const currentBookings = classBookingsSnapshot.size;

          return {
            ...classItem,
            currentBookings,
            spotsAvailable: classItem.maxCapacity - currentBookings,
          };
        })
      );

      // Fetch member's waitlist entries
      const memberWaitlist = await waitlistService.getMemberWaitlist(currentUser.id);

      setClasses(classesWithBookings);
      setBookings(bookingsData);
      setWaitlistEntries(memberWaitlist);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleBookClass = async (classItem) => {
    if (classItem.spotsAvailable <= 0) {
      alert("This class is full. Would you like to join the waitlist?");
      return;
    }

    // Check if already booked
    const existingBooking = bookings.find(
      (b) => b.classId === classItem.id && b.status !== "cancelled"
    );
    if (existingBooking) {
      alert("You have already booked this class!");
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      await addDoc(collection(db, "classBookings"), {
        classId: classItem.id,
        className: classItem.className,
        memberId: currentUser.id,
        memberName: currentUser.name,
        gymId: currentUser.gymId,
        bookingDate: Timestamp.now(),
        status: "confirmed",
        bookedAt: Timestamp.now(),
      });

      // Send booking confirmation notification
      await notificationService.sendBookingConfirmation(currentUser.id, classItem);

      fetchData();
      alert("Class booked successfully! 🎉");
    } catch (error) {
      console.error("Error booking class:", error);
      alert("Failed to book class. Please try again.");
    }
  };

  const handleCancelBooking = async (booking) => {
    if (!confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { doc, updateDoc, Timestamp } = await import("firebase/firestore");

      await updateDoc(doc(db, "classBookings", booking.id), {
        status: "cancelled",
        cancelledAt: Timestamp.now(),
      });

      // Send booking cancellation notification
      const classData = classes.find((c) => c.id === booking.classId);
      if (classData) {
        await notificationService.sendBookingCancellation(currentUser.id, classData);
        
        // Try to promote someone from waitlist
        try {
          const promotionResult = await waitlistService.promoteFromWaitlist(
            booking.classId,
            classData.className,
            currentUser.gymId
          );
          
          if (promotionResult.promoted) {
            console.log(`Promoted ${promotionResult.memberName} from waitlist`);
          }
        } catch (error) {
          console.error("Error promoting from waitlist:", error);
        }
      }

      fetchData();
      alert("Booking cancelled successfully.");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Failed to cancel booking. Please try again.");
    }
  };

  const handleJoinWaitlist = async (classItem) => {
    try {
      await waitlistService.addToWaitlist(
        currentUser.id,
        currentUser.name,
        currentUser.email,
        classItem.id,
        classItem.className,
        currentUser.gymId
      );

      fetchData();
      alert("You've been added to the waitlist! We'll notify you if a spot opens. ✅");
    } catch (error) {
      console.error("Error joining waitlist:", error);
      if (error.message) {
        alert(error.message);
      } else {
        alert("Failed to join waitlist. Please try again.");
      }
    }
  };

  const handleLeaveWaitlist = async (waitlistId) => {
    if (!confirm("Are you sure you want to leave the waitlist?")) {
      return;
    }

    try {
      await waitlistService.removeFromWaitlist(waitlistId);
      fetchData();
      alert("You've been removed from the waitlist.");
    } catch (error) {
      console.error("Error leaving waitlist:", error);
      alert("Failed to leave waitlist. Please try again.");
    }
  };

  const handleOpenRatingModal = async (classData, booking) => {
    setRatingClass({ ...classData, bookingId: booking.id });
    
    // Check if member already reviewed this class
    const existingReview = await ratingService.getMemberReview(currentUser.id, classData.id);
    
    if (existingReview) {
      setRating(existingReview.rating);
      setReviewText(existingReview.review || "");
    } else {
      setRating(0);
      setReviewText("");
    }
    
    setShowRatingModal(true);
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      alert("Please select a star rating");
      return;
    }

    try {
      await ratingService.submitRating(
        currentUser.id,
        currentUser.name,
        ratingClass.id,
        ratingClass.className,
        currentUser.gymId,
        rating,
        reviewText
      );

      setShowRatingModal(false);
      setRatingClass(null);
      setRating(0);
      setReviewText("");
      
      alert("Thank you for your rating! ⭐");
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Failed to submit rating. Please try again.");
    }
  };


  const getFilteredClasses = () => {
    let filtered = classes;

    // Filter by day
    if (selectedDay !== "all") {
      filtered = filtered.filter((c) => c.schedule?.day === selectedDay);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.className?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.instructorName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by day and time
    filtered.sort((a, b) => {
      const dayIndexA = daysOfWeek.indexOf(a.schedule?.day);
      const dayIndexB = daysOfWeek.indexOf(b.schedule?.day);
      if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB;
      return (a.schedule?.time || "").localeCompare(b.schedule?.time || "");
    });

    return filtered;
  };

  const getMyBookings = () => {
    return bookings
      .filter((b) => b.status === "confirmed" || b.status === "attended")
      .sort((a, b) => b.bookedAt - a.bookedAt);
  };

  if (loading) {
    return (
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading classes...</p>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Fitness Classes
            </h1>
            <p className="text-sm sm:text-base text-white/80">
              Book and manage your class schedule
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          {/* Tabs */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setActiveTab("available")}
                className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-medium transition text-sm sm:text-base ${
                  activeTab === "available"
                    ? "text-indigo-500 border-b-2 border-indigo-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Available Classes
              </button>
              <button
                onClick={() => setActiveTab("bookings")}
                className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-medium transition text-sm sm:text-base ${
                  activeTab === "bookings"
                    ? "text-indigo-500 border-b-2 border-indigo-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                My Bookings ({getMyBookings().length})
              </button>
              <button
                onClick={() => setActiveTab("calendar")}
                className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-medium transition text-sm sm:text-base ${
                  activeTab === "calendar"
                    ? "text-indigo-500 border-b-2 border-indigo-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Calendar View
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {/* Available Classes Tab */}
              {activeTab === "available" && (
                <div>
                  {/* Filters */}
                  <div className="mb-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          placeholder="Search classes or instructor..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="sm:w-48">
                        <select
                          value={selectedDay}
                          onChange={(e) => setSelectedDay(e.target.value)}
                          className="w-full px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="all">All Days</option>
                          {daysOfWeek.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Classes List */}
                  {getFilteredClasses().length > 0 ? (
                    <div className="space-y-4">
                      {getFilteredClasses().map((classItem) => {
                        const isBooked = bookings.some(
                          (b) => b.classId === classItem.id && (b.status === "confirmed" || b.status === "attended")
                        );
                        const onWaitlist = waitlistEntries.find((w) => w.classId === classItem.id);
                        const isFull = classItem.spotsAvailable <= 0;

                        return (
                          <div
                            key={classItem.id}
                            className={`bg-gray-900 rounded-lg border p-4 sm:p-6 transition ${
                              isBooked
                                ? "border-green-500/50 bg-green-900/10"
                                : onWaitlist
                                ? "border-yellow-500/50 bg-yellow-900/10"
                                : isFull
                                ? "border-gray-700 opacity-75"
                                : "border-gray-700 hover:border-indigo-500/50"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="flex-1 w-full sm:w-auto">
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Calendar className="w-6 h-6 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                                      {classItem.className}
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                      with {classItem.instructorName}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 ml-0 sm:ml-15">
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
                                      {classItem.currentBookings}/{classItem.maxCapacity} booked
                                    </span>
                                  </div>
                                </div>

                                {classItem.description && (
                                  <p className="text-sm text-gray-400 mt-3 ml-0 sm:ml-15">
                                    {classItem.description}
                                  </p>
                                )}
                              </div>

                              <div className="w-full sm:w-auto flex-shrink-0 flex flex-col sm:flex-row gap-2">
                                <button
                                  onClick={() => setSelectedClassDetails(classItem)}
                                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                                >
                                  <Info className="w-4 h-4" />
                                  View Details
                                </button>
                                {isBooked ? (
                                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    Booked
                                  </div>
                                ) : onWaitlist ? (
                                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium">
                                      <Clock className="w-4 h-4" />
                                      On Waitlist
                                    </div>
                                    <button
                                      onClick={() => handleLeaveWaitlist(onWaitlist.id)}
                                      className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
                                    >
                                      Leave Waitlist
                                    </button>
                                  </div>
                                ) : isFull ? (
                                  <button
                                    onClick={() => handleJoinWaitlist(classItem)}
                                    className="w-full sm:w-auto px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 active:scale-95"
                                  >
                                    <Clock className="w-4 h-4" />
                                    Join Waitlist
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleBookClass(classItem)}
                                    className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 active:scale-95"
                                  >
                                    <UserPlus className="w-4 h-4" />
                                    Book Class
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📅</div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        No Classes Found
                      </h3>
                      <p className="text-gray-400">
                        {searchQuery || selectedDay !== "all"
                          ? "Try adjusting your filters"
                          : "No classes available at the moment"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* My Bookings Tab */}
              {activeTab === "bookings" && (
                <div>
                  {getMyBookings().length > 0 ? (
                    <div className="space-y-4">
                      {getMyBookings().map((booking) => {
                        const classItem = classes.find((c) => c.id === booking.classId);
                        if (!classItem) return null;

                        return (
                          <div
                            key={booking.id}
                            className="bg-gray-900 rounded-lg border border-gray-700 p-4 sm:p-6 hover:border-indigo-500/50 transition"
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="w-6 h-6 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                                      {classItem.className}
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                      with {classItem.instructorName}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-0 sm:ml-15">
                                  <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <Calendar className="w-4 h-4 text-green-400" />
                                    <span>{classItem.schedule?.day}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <Clock className="w-4 h-4 text-green-400" />
                                    <span>{classItem.schedule?.time}</span>
                                  </div>
                                </div>

                                <p className="text-xs text-gray-500 mt-3 ml-0 sm:ml-15">
                                  Booked on{" "}
                                  {booking.bookedAt.toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>

                              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                                <button
                                  onClick={() => setSelectedClassDetails(classItem)}
                                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                                >
                                  <Info className="w-4 h-4" />
                                  View Details
                                </button>
                                
                                {/* Rate Class button for attended classes */}
                                {booking.status === "attended" && (
                                  <button
                                    onClick={() => handleOpenRatingModal(classItem, booking)}
                                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                                  >
                                    <Star className="w-4 h-4" />
                                    Rate Class
                                  </button>
                                )}
                                
                                {/* Cancel button only for confirmed bookings */}
                                {booking.status === "confirmed" && (
                                  <button
                                    onClick={() => handleCancelBooking(booking)}
                                    className="w-full sm:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 active:scale-95"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                    Cancel Booking
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📋</div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        No Bookings Yet
                      </h3>
                      <p className="text-gray-400 mb-6">
                        You haven't booked any classes yet. Check out available classes!
                      </p>
                      <button
                        onClick={() => setActiveTab("available")}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition active:scale-95"
                      >
                        Browse Classes
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Calendar View Tab */}
              {activeTab === "calendar" && (
                <CalendarView
                  classes={classes}
                  bookings={bookings}
                  onBookClass={handleBookClass}
                  currentUser={currentUser}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Class Details Modal */}
      <ClassDetailsModal
        classData={selectedClassDetails}
        isOpen={!!selectedClassDetails}
        onClose={() => setSelectedClassDetails(null)}
        onBook={() => selectedClassDetails && handleBookClass(selectedClassDetails)}
        onCancel={() => {
          const booking = bookings.find(
            (b) => b.classId === selectedClassDetails?.id && (b.status === "confirmed" || b.status === "attended")
          );
          if (booking) handleCancelBooking(booking);
        }}
        currentUser={currentUser}
        isBooked={bookings.some(
          (b) => b.classId === selectedClassDetails?.id && (b.status === "confirmed" || b.status === "attended")
        )}
        isFull={selectedClassDetails && selectedClassDetails.spotsAvailable <= 0}
        isOwner={false}
      />

      {/* Rating Modal */}
      {showRatingModal && ratingClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Rate Class</h3>
              <button
                onClick={() => setShowRatingModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 font-medium mb-2">{ratingClass.className}</p>
              <p className="text-sm text-gray-400">with {ratingClass.instructorName}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Your Rating *
              </label>
              <div className="flex justify-center">
                <StarRating rating={rating} onRatingChange={setRating} size="lg" />
              </div>
              <p className="text-center text-sm text-gray-400 mt-2">
                {rating === 0 && "Tap to rate"}
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Review (Optional)
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience with this class..."
                rows={4}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                {reviewText.length}/500 characters
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRatingModal(false)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRating}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium transition active:scale-95"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </MemberLayout>
  );
};

export default MemberClasses;
