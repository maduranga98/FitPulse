import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import { where } from "firebase/firestore";

const AdminPayments = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    month: "",
    paymentMethod: "Cash",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedMember, setExpandedMember] = useState(null);

  const isAdmin = user?.role === "gym_admin" || user?.role === "manager";

  const paymentMethods = ["Cash", "Card", "Bank Transfer", "Online", "Other"];

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

      // Fetch members
      const membersQuery = query(
        collection(db, "members"),
        where("gymId", "==", currentGymId),
        orderBy("name", "asc")
      );
      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch payments
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

  const getCurrentMonth = () => {
    return new Date().toISOString().slice(0, 7);
  };

  const formatMonth = (monthString) => {
    const date = new Date(monthString + "-01");
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  };

  const checkPaymentStatus = (memberId, month = getCurrentMonth()) => {
    return payments.some(
      (payment) => payment.memberId === memberId && payment.month === month
    );
  };

  const getMemberPayments = (memberId) => {
    return payments.filter((payment) => payment.memberId === memberId);
  };

  const handleOpenPaymentModal = (member) => {
    setSelectedMember(member);
    setSelectedPayment(null);
    setIsEditMode(false);
    setPaymentForm({
      amount: member.membershipFee || "",
      month: getCurrentMonth(),
      paymentMethod: "Cash",
      notes: "",
    });
    setShowPaymentModal(true);
  };

  const handleOpenEditPaymentModal = (member, payment) => {
    setSelectedMember(member);
    setSelectedPayment(payment);
    setIsEditMode(true);
    setPaymentForm({
      amount: payment.amount || "",
      month: payment.month || "",
      paymentMethod: payment.paymentMethod || "Cash",
      notes: payment.notes || "",
    });
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp, doc, getDoc, updateDoc } =
        await import("firebase/firestore");

      if (isEditMode && selectedPayment) {
        // Update existing payment
        const paymentData = {
          amount: parseFloat(paymentForm.amount),
          month: paymentForm.month,
          paymentMethod: paymentForm.paymentMethod,
          notes: paymentForm.notes,
          updatedAt: Timestamp.now(),
          updatedBy: user?.name || user?.username || user?.email || "Admin",
        };

        await updateDoc(doc(db, "payments", selectedPayment.id), paymentData);

        // Reset form and close modal
        setPaymentForm({
          amount: "",
          month: getCurrentMonth(),
          paymentMethod: "Cash",
          notes: "",
        });

        setShowPaymentModal(false);
        setSelectedMember(null);
        setSelectedPayment(null);
        setIsEditMode(false);
        fetchData();

        alert("Payment updated successfully! ✅");
        setSubmitting(false);
        return;
      }

      // Check if payment already exists for this month (only for new payments)
      const alreadyPaid = checkPaymentStatus(
        selectedMember.id,
        paymentForm.month
      );
      if (alreadyPaid) {
        alert("Payment already recorded for this month!");
        setSubmitting(false);
        return;
      }

      const paymentData = {
        memberId: selectedMember.id,
        gymId: currentGymId,
        memberName: selectedMember.name,
        amount: parseFloat(paymentForm.amount),
        month: paymentForm.month,
        paymentMethod: paymentForm.paymentMethod,
        notes: paymentForm.notes,
        paidAt: Timestamp.now(),
        recordedBy: user?.name || user?.username || user?.email || "Admin",
        recordedById: user?.id || user?.uid || "",
      };

      // Save payment to database
      await addDoc(collection(db, "payments"), paymentData);

      // ✅ SEND SMS NOTIFICATION TO MEMBER
      try {
        const { sendPaymentReceiptSMS } = await import(
          "../services/smsService"
        );

        // Get full member data including phone numbers
        const memberRef = doc(db, "members", selectedMember.id);
        const memberSnap = await getDoc(memberRef);

        if (memberSnap.exists()) {
          const memberData = memberSnap.data();

          // Check if member has phone number
          if (memberData.mobile || memberData.whatsapp) {
            await sendPaymentReceiptSMS(
              {
                name: memberData.name,
                mobile: memberData.mobile,
                whatsapp: memberData.whatsapp,
              },
              paymentData
            );

            console.log(
              "✅ Payment receipt SMS sent successfully to:",
              memberData.name
            );
          } else {
            console.warn("⚠️ Member has no phone number for SMS");
          }
        }
      } catch (smsError) {
        console.error("⚠️ SMS sending failed:", smsError);
        // Don't fail the payment recording if SMS fails
        // Just log it and continue
      }

      // Reset form and close modal
      setPaymentForm({
        amount: "",
        month: getCurrentMonth(),
        paymentMethod: "Cash",
        notes: "",
      });

      setShowPaymentModal(false);
      setSelectedMember(null);
      fetchData();

      alert("Payment recorded successfully! ✅\nSMS receipt sent to member.");
    } catch (error) {
      console.error("Error recording payment:", error);
      alert("Failed to record payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "payments", paymentId));
      fetchData();
      alert("Payment deleted successfully! ✅");
    } catch (error) {
      console.error("Error deleting payment:", error);
      alert("Failed to delete payment. Please try again.");
    }
  };

  const handleToggleMemberStatus = async (memberId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const confirmMessage = `Are you sure you want to mark this member as ${newStatus}?`;

    if (!confirm(confirmMessage)) return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      await updateDoc(doc(db, "members", memberId), {
        status: newStatus,
      });

      fetchData();
      alert(`Member marked as ${newStatus} successfully! ✅`);
    } catch (error) {
      console.error("Error updating member status:", error);
      alert("Failed to update member status. Please try again.");
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      searchTerm === "" ||
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const isPaid = checkPaymentStatus(member.id);
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "paid" && isPaid) ||
      (filterStatus === "unpaid" && !isPaid);

    return matchesSearch && matchesStatus;
  });

  const totalCollected = payments
    .filter((p) => p.month === getCurrentMonth())
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const paidMembersCount = members.filter((m) =>
    checkPaymentStatus(m.id)
  ).length;

  if (!isAdmin) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
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
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Payment Management
                </h1>
                <p className="text-gray-400 text-sm hidden sm:block">
                  Track and manage member payments for{" "}
                  {formatMonth(getCurrentMonth())}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Members</span>
                <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-purple-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
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
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">
                {paidMembersCount}
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Unpaid</span>
                <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">
                {members.length - paidMembersCount}
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Collected</span>
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
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
                Rs. {totalCollected.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Search Members
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="all">All Members</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Members List */}
          {filteredMembers.length === 0 ? (
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                No Members Found
              </h3>
              <p className="text-gray-400">
                No members match your current filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map((member) => {
                const isPaid = checkPaymentStatus(member.id);
                const memberPayments = getMemberPayments(member.id);

                return (
                  <div
                    key={member.id}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-lg">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white mb-1 truncate">
                          {member.name}
                        </h3>
                        <p className="text-sm text-gray-400 truncate">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Membership Fee:</span>
                        <span className="text-white font-medium">
                          Rs. {member.membershipFee || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Payment Status:</span>
                        <span
                          className={`font-medium ${
                            isPaid ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Member Status:</span>
                        <span
                          className={`font-medium ${
                            member.status === "active"
                              ? "text-green-600"
                              : "text-orange-600"
                          }`}
                        >
                          {member.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Total Payments:</span>
                        <span className="text-white font-medium">
                          {memberPayments.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => handleOpenPaymentModal(member)}
                        disabled={isPaid}
                        className={`w-full py-2 rounded-lg font-medium transition ${
                          isPaid
                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                            : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white active:scale-95"
                        }`}
                      >
                        {isPaid ? "Already Paid" : "Record Payment"}
                      </button>

                      {memberPayments.length > 0 && (
                        <button
                          onClick={() =>
                            setExpandedMember(
                              expandedMember === member.id ? null : member.id
                            )
                          }
                          className="w-full py-2 rounded-lg font-medium transition active:scale-95 bg-blue-600/20 text-blue-600 hover:bg-blue-600/30 border border-blue-600/50"
                        >
                          {expandedMember === member.id
                            ? "Hide Payment History"
                            : "View Payment History"}
                        </button>
                      )}

                      <button
                        onClick={() =>
                          handleToggleMemberStatus(member.id, member.status)
                        }
                        className={`w-full py-2 rounded-lg font-medium transition active:scale-95 flex items-center justify-center gap-2 ${
                          member.status === "active"
                            ? "bg-orange-600/20 text-orange-600 hover:bg-orange-600/30 border border-orange-600/50"
                            : "bg-green-600/20 text-green-600 hover:bg-green-600/30 border border-green-600/50"
                        }`}
                      >
                        {member.status === "active" ? (
                          <>
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
                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                              />
                            </svg>
                            Mark as Inactive
                          </>
                        ) : (
                          <>
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
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Mark as Active
                          </>
                        )}
                      </button>
                    </div>

                    {/* Payment History */}
                    {expandedMember === member.id && memberPayments.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">
                          Payment History
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {memberPayments.map((payment) => (
                            <div
                              key={payment.id}
                              className="bg-gray-900 rounded-lg p-3 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-white font-medium">
                                    Rs. {payment.amount}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
                                    {payment.paymentMethod}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {formatMonth(payment.month)} - {formatDate(payment.paidAt)}
                                </div>
                                {payment.notes && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {payment.notes}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    handleOpenEditPaymentModal(member, payment)
                                  }
                                  className="p-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-600 rounded-lg transition"
                                  title="Edit Payment"
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
                                  onClick={() => handleDeletePayment(payment.id)}
                                  className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg transition"
                                  title="Delete Payment"
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
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md">
            <div className="border-b border-gray-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {isEditMode ? "Edit Payment" : "Record Payment"}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {selectedMember.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedMember(null);
                }}
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

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount (Rs.) *
                </label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="Enter amount"
                  required
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Month */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Month *
                </label>
                <input
                  type="month"
                  value={paymentForm.month}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, month: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  required
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Method *
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentMethod: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  required
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, notes: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none"
                  placeholder="Additional notes..."
                  rows="3"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedMember(null);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? isEditMode
                      ? "Updating..."
                      : "Recording..."
                    : isEditMode
                    ? "Update Payment"
                    : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayments;
