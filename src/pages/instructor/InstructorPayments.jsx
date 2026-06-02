import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useGymSettings } from "../../contexts/GymSettingsContext";
import AdminLayout from "../../components/AdminLayout";

const InstructorPayments = () => {
  const { user } = useAuth();
  const { settings } = useGymSettings();
  const currentGymId = user?.gymId;

  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedMember, setExpandedMember] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    month: new Date().toISOString().slice(0, 7),
    paymentMethod: "Cash",
    notes: "",
  });

  const canCollectPayments = settings.instructorPermissions?.collectPayments !== false;
  const paymentMethods = ["Cash", "Card", "Bank Transfer", "Online", "Other"];

  useEffect(() => {
    if (canCollectPayments) fetchData();
  }, [currentGymId, canCollectPayments]);

  const fetchData = async () => {
    if (!currentGymId) { setLoading(false); return; }
    try {
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import("firebase/firestore");

      const membersSnap = await getDocs(query(
        collection(db, "members"),
        where("gymId", "==", currentGymId),
        where("status", "==", "active"),
        orderBy("name", "asc")
      ));
      setMembers(
        membersSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => !m.role || m.role === "member")
      );

      const paymentsSnap = await getDocs(query(
        collection(db, "payments"),
        where("gymId", "==", currentGymId),
        orderBy("paidAt", "desc")
      ));
      setPayments(paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

  const formatMonth = (m) =>
    new Date(m + "-01").toLocaleDateString("en-US", { year: "numeric", month: "long" });

  const formatDate = (ts) => {
    if (!ts) return "N/A";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const checkPaymentStatus = (memberId, month = getCurrentMonth()) =>
    payments.some((p) => p.memberId === memberId && p.month === month);

  const getMemberPayments = (memberId) =>
    payments.filter((p) => p.memberId === memberId);

  const handleOpenPaymentModal = (member) => {
    setSelectedMember(member);
    setPaymentForm({
      amount: member.membershipFee || "",
      month: getCurrentMonth(),
      paymentMethod: "Cash",
      notes: "",
    });
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!canCollectPayments) return;

    const alreadyPaid = checkPaymentStatus(selectedMember.id, paymentForm.month);
    if (alreadyPaid) {
      alert("Payment already recorded for this month!");
      return;
    }

    setSubmitting(true);
    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp, doc, getDoc, updateDoc } = await import("firebase/firestore");

      const paymentData = {
        memberId: selectedMember.id,
        gymId: currentGymId,
        memberName: selectedMember.name,
        amount: parseFloat(paymentForm.amount),
        month: paymentForm.month,
        paymentMethod: paymentForm.paymentMethod,
        notes: paymentForm.notes,
        status: "completed",
        paidAt: Timestamp.now(),
        recordedBy: user?.name || user?.username || "Instructor",
        recordedById: user?.id || "",
      };

      await addDoc(collection(db, "payments"), paymentData);

      // Send WhatsApp receipt if enabled
      if (settings.notifications.whatsapp !== false) {
        try {
          const memberSnap = await getDoc(doc(db, "members", selectedMember.id));
          if (memberSnap.exists()) {
            const mData = memberSnap.data();
            if (mData.mobile || mData.whatsapp) {
              const { sendPaymentReceiptWhatsApp } = await import("../../services/whatsappService");
              const gymSnap = await getDoc(doc(db, "gyms", currentGymId));
              const gymName = gymSnap.exists() ? gymSnap.data().name : "Your Gym";
              await sendPaymentReceiptWhatsApp(
                { name: mData.name, mobile: mData.mobile, whatsapp: mData.whatsapp },
                paymentData,
                gymName
              );
            }
          }
        } catch (waErr) {
          console.warn("WhatsApp receipt failed:", waErr);
        }
      }

      // Update next payment date
      try {
        const memberSnap = await getDoc(doc(db, "members", selectedMember.id));
        const mData = memberSnap.data();
        const nextDate = mData.nextPaymentDate ? new Date(mData.nextPaymentDate) : new Date();
        nextDate.setMonth(nextDate.getMonth() + (mData.packageDuration || 1));
        await updateDoc(doc(db, "members", selectedMember.id), {
          nextPaymentDate: nextDate.toISOString().slice(0, 10),
        });
      } catch (upErr) {
        console.warn("Failed to update next payment date:", upErr);
      }

      setShowPaymentModal(false);
      setSelectedMember(null);
      fetchData();
      alert("Payment recorded successfully! ✅");
    } catch (err) {
      console.error("Error recording payment:", err);
      alert("Failed to record payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchSearch =
      searchTerm === "" ||
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const isPaid = checkPaymentStatus(m.id);
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "paid" && isPaid) ||
      (filterStatus === "unpaid" && !isPaid);
    return matchSearch && matchStatus;
  });

  const totalCollected = payments
    .filter((p) => p.month === getCurrentMonth())
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const paidCount = members.filter((m) => checkPaymentStatus(m.id)).length;

  if (!canCollectPayments) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center h-full">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
            <p className="text-gray-400 text-sm">Payment collection is not enabled for instructors. Please contact your gym admin.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Payment Collection</h1>
          <p className="text-gray-400 text-sm">{formatMonth(getCurrentMonth())}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Members", value: members.length, color: "blue" },
            { label: "Paid This Month", value: paidCount, color: "green" },
            { label: "Unpaid", value: members.length - paidCount, color: "red" },
            { label: "Collected", value: `Rs. ${totalCollected.toLocaleString()}`, color: "purple" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="text-gray-400 text-xs mb-1">{label}</div>
              <div className={`text-xl font-bold text-${color}-400`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Members</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        {/* Members Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member) => {
              const isPaid = checkPaymentStatus(member.id);
              const memberPayments = getMemberPayments(member.id);
              const isExpanded = expandedMember === member.id;

              const nextDate = member.nextPaymentDate ? new Date(member.nextPaymentDate) : null;
              const today = new Date(); today.setHours(0,0,0,0);
              const diffDays = nextDate ? Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24)) : null;
              const dueDateColor = diffDays === null ? "text-gray-400" : diffDays < 0 ? "text-red-500" : diffDays <= 7 ? "text-yellow-400" : "text-green-400";

              return (
                <div key={member.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-lg flex-shrink-0">
                      {member.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold truncate">{member.name}</div>
                      <div className="text-gray-400 text-xs truncate">{member.email || member.mobile || "—"}</div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Package Fee:</span>
                      <span className="text-white font-medium">
                        {member.membershipFee ? `Rs. ${member.membershipFee}` : "N/A"}
                      </span>
                    </div>
                    {member.packageDuration && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration:</span>
                        <span className="text-white font-medium">{member.packageDuration} Month{member.packageDuration > 1 ? "s" : ""}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status:</span>
                      <span className={`font-medium ${isPaid ? "text-green-400" : "text-red-400"}`}>
                        {isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                    {nextDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Next Due:</span>
                        <span className={`font-medium ${dueDateColor}`}>
                          {nextDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Payments:</span>
                      <span className="text-white font-medium">{memberPayments.length}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => !isPaid && handleOpenPaymentModal(member)}
                      disabled={isPaid}
                      className={`w-full py-2 rounded-lg font-medium text-sm transition ${
                        isPaid
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                      }`}
                    >
                      {isPaid ? "Already Paid" : "Mark as Paid"}
                    </button>
                    {memberPayments.length > 0 && (
                      <button
                        onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                        className="w-full py-2 rounded-lg font-medium text-sm transition bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-600/30"
                      >
                        {isExpanded ? "Hide History" : "View Payment History"}
                      </button>
                    )}
                  </div>

                  {isExpanded && memberPayments.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
                      <div className="text-xs font-medium text-gray-400 mb-2">Payment History</div>
                      {memberPayments.slice(0, 6).map((p) => (
                        <div key={p.id} className="bg-gray-900 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-white text-xs font-medium">{formatMonth(p.month)}</span>
                            <span className="text-green-400 text-xs font-medium">Rs. {p.amount?.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 text-xs">{p.paymentMethod}</span>
                            <span className="text-gray-500 text-xs">{formatDate(p.paidAt)}</span>
                          </div>
                          {p.notes && <div className="text-gray-500 text-xs mt-1">{p.notes}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400">No members found.</div>
            )}
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedMember && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <div>
                  <h2 className="text-lg font-bold text-white">Record Payment</h2>
                  <p className="text-gray-400 text-sm">{selectedMember.name}</p>
                </div>
                <button onClick={() => { setShowPaymentModal(false); setSelectedMember(null); }} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Amount *</label>
                  <input
                    required type="number" step="0.01" min="0"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Month *</label>
                  <input
                    required type="month"
                    value={paymentForm.month}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, month: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Notes</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Optional notes..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowPaymentModal(false); setSelectedMember(null); }}
                    className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Recording...</>
                    ) : "Record Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorPayments;
