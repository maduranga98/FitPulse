import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import AdminLayout from "../components/AdminLayout";
import { where } from "firebase/firestore";

const PaymentAnalytics = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("unpaid");

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "gym_admin" ||
    user?.role === "gym_manager";

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, orderBy, query } = await import(
        "firebase/firestore"
      );

      const membersQuery = query(
        collection(db, "members"),
        where("gymId", "==", currentGymId),
        where("status", "==", "active"),
        orderBy("name", "asc")
      );
      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const paymentsQuery = query(
        collection(db, "payments"),
        where("gymId", "==", currentGymId),
        orderBy("paidAt", "desc")
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setMembers(membersData);
      setPayments(paymentsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const currentMonth = getCurrentMonth();

  const paidThisMonth = members.filter((m) =>
    payments.some((p) => p.memberId === m.id && p.month === currentMonth)
  );

  const unpaidThisMonth = members.filter(
    (m) => !payments.some((p) => p.memberId === m.id && p.month === currentMonth)
  );

  const totalOutstanding = unpaidThisMonth.reduce(
    (sum, m) => sum + (parseFloat(m.membershipFee) || 0),
    0
  );

  const collectionRate =
    members.length > 0
      ? ((paidThisMonth.length / members.length) * 100).toFixed(1)
      : 0;

  // Get last 6 months for revenue chart
  const getLast6Months = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    return months;
  };

  const last6Months = getLast6Months();
  const monthlyRevenue = last6Months.map((month) => {
    const total = payments
      .filter((p) => p.month === month)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    return { month, total };
  });

  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.total), 1);

  // Get last 12 months for timeline dots
  const getLast12Months = () => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    return months;
  };

  const last12Months = getLast12Months();

  // Member timeline data
  const getMemberTimeline = (member) => {
    const memberPayments = payments.filter((p) => p.memberId === member.id);
    const joinMonth = member.joinDate
      ? (member.joinDate.toDate
          ? member.joinDate.toDate()
          : new Date(member.joinDate)
        )
          .toISOString()
          .slice(0, 7)
      : "2000-01";

    const dots = last12Months.map((month) => {
      if (month < joinMonth) return "gray";
      const paid = memberPayments.some((p) => p.month === month);
      return paid ? "green" : "red";
    });

    // Calculate average days to pay
    const payDays = memberPayments
      .map((p) => {
        if (!p.paidAt) return null;
        const paidDate = p.paidAt.toDate ? p.paidAt.toDate() : new Date(p.paidAt);
        const monthStart = new Date(p.month + "-01");
        return Math.ceil((paidDate - monthStart) / (1000 * 60 * 60 * 24));
      })
      .filter((d) => d !== null);

    const avgDays =
      payDays.length > 0
        ? Math.round(payDays.reduce((a, b) => a + b, 0) / payDays.length)
        : null;

    // Calculate streak (consecutive months paid, most recent first)
    let streak = 0;
    for (let i = last12Months.length - 1; i >= 0; i--) {
      const month = last12Months[i];
      if (month < joinMonth) break;
      if (memberPayments.some((p) => p.month === month)) {
        streak++;
      } else {
        break;
      }
    }

    const lastPayment = memberPayments[0];

    return { dots, avgDays, streak, lastPayment };
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">
              You don't have permission to view this page.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Payment Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Overview for{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            })}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Active Members</span>
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{members.length}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Paid This Month</span>
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{paidThisMonth.length}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Unpaid This Month</span>
              <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{unpaidThisMonth.length}</p>
            <p className="text-sm text-gray-400 mt-1">
              Rs. {totalOutstanding.toLocaleString()} outstanding
            </p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Collection Rate</span>
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{collectionRate}%</p>
          </div>
        </div>

        {/* Section A: Paid vs Unpaid Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab("paid")}
              className={`flex-1 px-6 py-4 font-medium transition ${
                activeTab === "paid"
                  ? "text-green-500 border-b-2 border-green-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Paid ({paidThisMonth.length})
            </button>
            <button
              onClick={() => setActiveTab("unpaid")}
              className={`flex-1 px-6 py-4 font-medium transition ${
                activeTab === "unpaid"
                  ? "text-red-500 border-b-2 border-red-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Unpaid ({unpaidThisMonth.length})
            </button>
          </div>

          <div className="p-4 overflow-x-auto">
            {activeTab === "paid" && (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 text-sm border-b border-gray-700">
                    <th className="pb-3 pr-4">Member Name</th>
                    <th className="pb-3 pr-4">Package Fee</th>
                    <th className="pb-3 pr-4">Month Paid</th>
                    <th className="pb-3 pr-4">Paid On</th>
                    <th className="pb-3 pr-4">Days Early/Late</th>
                    <th className="pb-3">Payment Method</th>
                  </tr>
                </thead>
                <tbody>
                  {paidThisMonth.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-gray-500 py-8">
                        No payments recorded this month yet.
                      </td>
                    </tr>
                  ) : (
                    paidThisMonth.map((member) => {
                      const payment = payments.find(
                        (p) => p.memberId === member.id && p.month === currentMonth
                      );
                      if (!payment) return null;

                      const paidDate = payment.paidAt?.toDate
                        ? payment.paidAt.toDate()
                        : new Date(payment.paidAt);

                      // Days early/late: compare paidAt to nextPaymentDate (before this payment)
                      // We estimate: nextPaymentDate was paidAt + packageDuration shifted back
                      // Simpler: compare to 1st of the month
                      let daysEarlyLate = null;
                      if (member.nextPaymentDate) {
                        // nextPaymentDate was already updated after payment, so we estimate the old one
                        const duration = member.packageDuration || 1;
                        const currentNext = new Date(member.nextPaymentDate);
                        const prevNext = new Date(currentNext);
                        prevNext.setMonth(prevNext.getMonth() - duration);
                        daysEarlyLate = Math.ceil(
                          (prevNext - paidDate) / (1000 * 60 * 60 * 24)
                        );
                      }

                      return (
                        <tr
                          key={member.id}
                          className="border-b border-gray-700/50 text-sm"
                        >
                          <td className="py-3 pr-4 text-white font-medium">
                            {member.name}
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            Rs. {member.membershipFee || "N/A"}
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            {new Date(currentMonth + "-01").toLocaleDateString(
                              "en-US",
                              { year: "numeric", month: "long" }
                            )}
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            {formatDate(payment.paidAt)}
                          </td>
                          <td className="py-3 pr-4">
                            {daysEarlyLate !== null ? (
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  daysEarlyLate >= 0
                                    ? "bg-green-600/20 text-green-400"
                                    : "bg-red-600/20 text-red-400"
                                }`}
                              >
                                {daysEarlyLate >= 0
                                  ? `${daysEarlyLate}d early`
                                  : `${Math.abs(daysEarlyLate)}d late`}
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-3 text-gray-300">
                            <span className="px-2 py-1 bg-gray-700 rounded text-xs">
                              {payment.paymentMethod}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "unpaid" && (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 text-sm border-b border-gray-700">
                    <th className="pb-3 pr-4">Member Name</th>
                    <th className="pb-3 pr-4">Package Fee</th>
                    <th className="pb-3 pr-4">Next Payment Due</th>
                    <th className="pb-3 pr-4">Days Overdue</th>
                    <th className="pb-3">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidThisMonth.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-gray-500 py-8">
                        All members have paid this month!
                      </td>
                    </tr>
                  ) : (
                    unpaidThisMonth.map((member) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const nextDate = member.nextPaymentDate
                        ? new Date(member.nextPaymentDate)
                        : null;
                      let diffDays = null;
                      if (nextDate) {
                        diffDays = Math.ceil(
                          (today - nextDate) / (1000 * 60 * 60 * 24)
                        );
                      }

                      return (
                        <tr
                          key={member.id}
                          className="border-b border-gray-700/50 text-sm"
                        >
                          <td className="py-3 pr-4 text-white font-medium">
                            {member.name}
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            Rs. {member.membershipFee || "N/A"}
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            {nextDate
                              ? nextDate.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "Not set"}
                          </td>
                          <td className="py-3 pr-4">
                            {diffDays !== null ? (
                              diffDays > 0 ? (
                                <span className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs font-medium">
                                  {diffDays}d overdue
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs font-medium">
                                  Due in {Math.abs(diffDays)}d
                                </span>
                              )
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-3 text-gray-300">
                            {member.mobile || member.whatsapp || "N/A"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Section B: Member Payment Timeline */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Member Payment Timeline
          </h2>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {members.map((member) => {
              const timeline = getMemberTimeline(member);
              return (
                <div
                  key={member.id}
                  className="bg-gray-900 rounded-lg border border-gray-700 p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">
                        {member.name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {timeline.avgDays !== null && (
                          <span>Avg: {timeline.avgDays}d to pay</span>
                        )}
                        <span>Streak: {timeline.streak} mo</span>
                        <span>
                          Last:{" "}
                          {timeline.lastPayment
                            ? formatDate(timeline.lastPayment.paidAt)
                            : "Never"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {timeline.dots.map((color, idx) => (
                      <div key={idx} className="flex flex-col items-center flex-1">
                        <div
                          className={`w-full h-3 rounded-sm ${
                            color === "green"
                              ? "bg-green-600"
                              : color === "red"
                              ? "bg-red-600"
                              : "bg-gray-700"
                          }`}
                          title={`${last12Months[idx]}: ${
                            color === "green"
                              ? "Paid"
                              : color === "red"
                              ? "Missed"
                              : "N/A"
                          }`}
                        />
                        <span className="text-[9px] text-gray-500 mt-1">
                          {last12Months[idx].slice(5)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {members.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No active members found.
              </p>
            )}
          </div>
        </div>

        {/* Section C: Revenue Chart */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Monthly Revenue (Last 6 Months)
          </h2>
          <div className="flex items-end gap-4 h-64">
            {monthlyRevenue.map((item) => {
              const heightPercent = maxRevenue > 0 ? (item.total / maxRevenue) * 100 : 0;
              return (
                <div
                  key={item.month}
                  className="flex-1 flex flex-col items-center justify-end h-full"
                >
                  <span className="text-sm font-medium text-white mb-2">
                    Rs. {item.total.toLocaleString()}
                  </span>
                  <div
                    className="w-full bg-gradient-to-t from-purple-600 to-pink-600 rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${Math.max(heightPercent, 2)}%`,
                      minHeight: "8px",
                    }}
                  />
                  <span className="text-xs text-gray-400 mt-2">
                    {new Date(item.month + "-01").toLocaleDateString("en-US", {
                      month: "short",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default PaymentAnalytics;
