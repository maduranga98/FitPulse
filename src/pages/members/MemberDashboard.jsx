import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import MemberLayout from "../../components/MemberLayout";

const MemberDashboard = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [memberData, setMemberData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      fetchMemberData();
    }
  }, [currentUser]);

  const fetchMemberData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { doc, getDoc, collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      // Fetch member data
      const memberRef = doc(db, "members", currentUser.id);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        setMemberData({ id: memberSnap.id, ...memberSnap.data() });
      }

      // Check payment status for current month
      const currentMonth = new Date().toISOString().slice(0, 7);
      const paymentsQuery = query(
        collection(db, "payments"),
        where("memberId", "==", currentUser.id),
        where("month", "==", currentMonth)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      setPaymentStatus(paymentsSnapshot.empty ? "unpaid" : "paid");

      setLoading(false);
    } catch (error) {
      console.error("Error fetching member data:", error);
      setLoading(false);
    }
  };

  const getMotivationalMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning! Ready to crush your goals? 🌅";
    if (hour < 18) return "Keep pushing! You're doing amazing! 💪";
    return "Evening warrior! Time to reflect on your progress! 🌙";
  };

  if (loading) {
    return (
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your dashboard...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  const member = memberData || currentUser;

  return (
    <MemberLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Welcome Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
            Welcome back, {member?.name?.split(" ")[0] || "Member"}! 💪
          </h1>
          <p className="text-sm sm:text-base text-gray-400">
            {getMotivationalMessage()}
          </p>
        </div>

        {/* Payment Alert */}
        {paymentStatus === "unpaid" && (
          <div className="mb-6 bg-red-600/10 border border-red-600/30 rounded-xl p-4 flex items-center gap-3">
            <svg
              className="w-6 h-6 text-red-600 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-red-600 font-medium text-sm sm:text-base">
                Payment Pending - Please contact admin
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => navigate("/member/workouts")}
            className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-left hover:from-blue-700 hover:to-blue-800 transition active:scale-95"
          >
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Workouts</h3>
            <p className="text-white/80 text-sm">Log exercises</p>
          </button>

          <button
            onClick={() => navigate("/member/progress")}
            className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-left hover:from-purple-700 hover:to-purple-800 transition active:scale-95"
          >
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Progress</h3>
            <p className="text-white/80 text-sm">Track stats</p>
          </button>

          <button
            onClick={() => navigate("/member-schedules")}
            className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-left hover:from-green-700 hover:to-green-800 transition active:scale-95"
          >
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Schedule</h3>
            <p className="text-white/80 text-sm">View plan</p>
          </button>

          <button
            onClick={() => navigate("/member-settings")}
            className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-left hover:from-orange-700 hover:to-orange-800 transition active:scale-95"
          >
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Settings</h3>
            <p className="text-white/80 text-sm">Profile & more</p>
          </button>
        </div>

        {/* Member Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <p className="text-white font-semibold capitalize">
                  {member?.status || "N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  paymentStatus === "paid" ? "bg-green-600" : "bg-red-600"
                }`}
              >
                <svg
                  className="w-5 h-5 text-white"
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
              </div>
              <div>
                <p className="text-gray-400 text-sm">Payment</p>
                <p
                  className={`font-semibold capitalize ${
                    paymentStatus === "paid" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {paymentStatus || "N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
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
              <div>
                <p className="text-gray-400 text-sm">Level</p>
                <p className="text-white font-semibold capitalize">
                  {member?.level || "N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
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
              <div>
                <p className="text-gray-400 text-sm">BMI</p>
                <p className="text-white font-semibold">
                  {member?.bmi || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
};

export default MemberDashboard;
//john4765
//OwUco0a4
