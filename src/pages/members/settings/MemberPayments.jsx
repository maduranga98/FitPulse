import { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";

const MemberPayments = () => {
  const { user: currentUser } = useAuth();

  const [payments, setPayments] = useState([]);
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState(
    new Date().getFullYear().toString()
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { db } = await import("../../../config/firebase");
      const { collection, query, where, getDocs, orderBy, doc, getDoc } =
        await import("firebase/firestore");

      // Fetch member data
      const memberRef = doc(db, "members", currentUser.id);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        setMemberData({ id: memberSnap.id, ...memberSnap.data() });
      }

      // Fetch payments
      const paymentsQuery = query(
        collection(db, "payments"),
        where("memberId", "==", currentUser.id),
        orderBy("paidAt", "desc")
      );

      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setPayments(paymentsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const getCurrentMonth = () => {
    return new Date().toISOString().slice(0, 7);
  };

  const checkPaymentStatus = (month = getCurrentMonth()) => {
    return payments.some((payment) => payment.month === month);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMonth = (monthString) => {
    const date = new Date(monthString + "-01");
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  };

  const getAvailableYears = () => {
    const years = new Set();
    payments.forEach((payment) => {
      const year = payment.month.split("-")[0];
      years.add(year);
    });
    return Array.from(years).sort().reverse();
  };

  const filteredPayments = payments.filter((payment) => {
    if (filterYear === "all") return true;
    return payment.month.startsWith(filterYear);
  });

  const currentMonthPaid = checkPaymentStatus();
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const availableYears = getAvailableYears();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Current Status Card */}
      <div
        className={`rounded-xl p-6 border-2 ${
          currentMonthPaid
            ? "bg-green-600/10 border-green-600/50"
            : "bg-red-600/10 border-red-600/50"
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">
              {formatMonth(getCurrentMonth())} Payment
            </h3>
            <p className="text-sm text-gray-400">Monthly membership fee</p>
          </div>
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              currentMonthPaid ? "bg-green-600/20" : "bg-red-600/20"
            }`}
          >
            {currentMonthPaid ? (
              <svg
                className="w-6 h-6 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-white">
              Rs. {memberData?.membershipFee || "N/A"}
            </p>
            <p
              className={`text-sm font-medium mt-1 ${
                currentMonthPaid ? "text-green-600" : "text-red-600"
              }`}
            >
              {currentMonthPaid ? "✓ Paid" : "✗ Unpaid"}
            </p>
          </div>
          {!currentMonthPaid && (
            <div className="text-right">
              <p className="text-sm text-gray-400">Contact admin to</p>
              <p className="text-sm text-gray-400">complete payment</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Payments</span>
            <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{payments.length}</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Amount</span>
            <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-purple-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            Rs. {totalPaid.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Payment History Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Payment History</h2>
          <p className="text-sm text-gray-400 mt-1">
            View all your past payments
          </p>
        </div>
        {availableYears.length > 0 && (
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            <option value="all">All Years</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Payment History List */}
      {filteredPayments.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            No Payment History
          </h3>
          <p className="text-gray-400">
            {filterYear === "all"
              ? "You haven't made any payments yet."
              : `No payments found for ${filterYear}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment) => (
            <div
              key={payment.id}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">
                      {formatMonth(payment.month)}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {formatDate(payment.paidAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">
                    Rs. {payment.amount?.toLocaleString()}
                  </p>
                  <span className="inline-block px-2 py-1 bg-green-600/20 text-green-600 text-xs font-medium rounded mt-1">
                    Paid
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Payment Method:</span>
                  <span className="text-white font-medium">
                    {payment.paymentMethod}
                  </span>
                </div>
                {payment.recordedBy && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Recorded By:</span>
                    <span className="text-white font-medium">
                      {payment.recordedBy}
                    </span>
                  </div>
                )}
                {payment.notes && (
                  <div className="text-sm">
                    <span className="text-gray-400">Notes:</span>
                    <p className="text-white mt-1">{payment.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <p className="text-blue-600 font-medium text-sm mb-1">
              Payment Information
            </p>
            <p className="text-gray-400 text-sm">
              Monthly membership fees are due at the beginning of each month.
              Contact the gym administrator if you have any payment-related
              queries or need to update your payment information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberPayments;
