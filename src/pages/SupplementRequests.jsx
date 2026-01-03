import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";

const SupplementRequests = () => {
  const { user: currentUser } = useAuth();
  const currentGymId = currentUser?.gymId;

  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");

  useEffect(() => {
    if (currentGymId) {
      fetchData();
    }
  }, [currentGymId]);

  const fetchData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch requests
      const requestsQuery = query(
        collection(db, "supplementRequests"),
        where("gymId", "==", currentGymId),
        orderBy("createdAt", "desc")
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      const requestsData = requestsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch members
      const membersQuery = query(
        collection(db, "members"),
        where("gymId", "==", currentGymId)
      );
      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch supplements
      const supplementsQuery = query(
        collection(db, "supplements"),
        where("gymId", "==", currentGymId)
      );
      const supplementsSnapshot = await getDocs(supplementsQuery);
      const supplementsData = supplementsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setRequests(requestsData);
      setMembers(membersData);
      setSupplements(supplementsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleApprove = (request) => {
    setSelectedRequest(request);
    setAdminNotes("");
    setShowApprovalModal(true);
  };

  const confirmApproval = async () => {
    try {
      const { db } = await import("../config/firebase");
      const {
        doc,
        updateDoc,
        addDoc,
        collection,
        Timestamp,
        increment,
      } = await import("firebase/firestore");

      // Update request status
      await updateDoc(doc(db, "supplementRequests", selectedRequest.id), {
        status: "approved",
        adminNotes: adminNotes,
        approvedAt: Timestamp.now(),
        approvedBy: currentUser.id,
      });

      // Update supplement quantity
      const supplement = supplements.find(
        (s) => s.id === selectedRequest.supplementId
      );
      if (supplement) {
        const quantityToDeduct =
          selectedRequest.requestType === "full"
            ? selectedRequest.quantity
            : 0; // For scoops, we don't deduct full containers

        if (quantityToDeduct > 0) {
          await updateDoc(doc(db, "supplements", selectedRequest.supplementId), {
            availableQuantity: increment(-quantityToDeduct),
          });
        }
      }

      // Add revenue record
      await addDoc(collection(db, "supplementRevenue"), {
        gymId: currentGymId,
        memberId: selectedRequest.memberId,
        supplementId: selectedRequest.supplementId,
        requestId: selectedRequest.id,
        amount: selectedRequest.totalPrice,
        quantity: selectedRequest.quantity,
        requestType: selectedRequest.requestType,
        createdAt: Timestamp.now(),
        createdBy: currentUser.id,
      });

      showSuccessNotification("Request approved and revenue recorded!");
      setShowApprovalModal(false);
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Failed to approve request");
    }
  };

  const handleReject = async (requestId) => {
    const notes = prompt("Reason for rejection (optional):");
    if (notes === null) return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc, Timestamp } = await import("firebase/firestore");

      await updateDoc(doc(db, "supplementRequests", requestId), {
        status: "rejected",
        adminNotes: notes,
        rejectedAt: Timestamp.now(),
        rejectedBy: currentUser.id,
      });

      showSuccessNotification("Request rejected");
      fetchData();
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("Failed to reject request");
    }
  };

  const showSuccessNotification = (message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  const getMemberName = (memberId) => {
    const member = members.find((m) => m.id === memberId);
    return member ? member.name : "Unknown Member";
  };

  const getSupplementName = (supplementId) => {
    const supplement = supplements.find((s) => s.id === supplementId);
    return supplement ? supplement.name : "Unknown Supplement";
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredRequests = requests.filter((request) => {
    if (filterStatus === "all") return true;
    return request.status === filterStatus;
  });

  const statusCounts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const totalRevenue = requests
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
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
                  Supplement Requests
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Manage member supplement requests
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Total Requests</div>
              <div className="text-2xl font-bold text-white">
                {statusCounts.all}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">
                {statusCounts.pending}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Approved</div>
              <div className="text-2xl font-bold text-green-600">
                {statusCounts.approved}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-blue-600">
                ${totalRevenue.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mb-6 flex gap-2 overflow-x-auto">
            {[
              { id: "all", label: "All" },
              { id: "pending", label: "Pending" },
              { id: "approved", label: "Approved" },
              { id: "rejected", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  filterStatus === tab.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {tab.label} ({statusCounts[tab.id]})
              </button>
            ))}
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-xl">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
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
                <p className="text-gray-400 text-lg">No requests found</p>
              </div>
            ) : (
              filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {request.supplementName ||
                              getSupplementName(request.supplementId)}
                          </h3>
                          <p className="text-sm text-gray-400 mb-2">
                            Requested by: {getMemberName(request.memberId)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(request.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap ${
                            request.status === "approved"
                              ? "bg-green-600/20 text-green-600"
                              : request.status === "rejected"
                              ? "bg-red-600/20 text-red-600"
                              : "bg-yellow-600/20 text-yellow-600"
                          }`}
                        >
                          {request.status.charAt(0).toUpperCase() +
                            request.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Type</div>
                      <div className="text-white font-medium text-sm">
                        {request.requestType === "full"
                          ? "Full Container"
                          : "Per Scoop"}
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Quantity</div>
                      <div className="text-white font-medium text-sm">
                        {request.quantity}
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">
                        Total Price
                      </div>
                      <div className="text-white font-medium text-sm">
                        ${request.totalPrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Status</div>
                      <div
                        className={`font-medium text-sm ${
                          request.status === "approved"
                            ? "text-green-600"
                            : request.status === "rejected"
                            ? "text-red-600"
                            : "text-yellow-600"
                        }`}
                      >
                        {request.status.charAt(0).toUpperCase() +
                          request.status.slice(1)}
                      </div>
                    </div>
                  </div>

                  {request.notes && (
                    <div className="mb-3 p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                      <p className="text-sm text-blue-600">
                        <span className="font-semibold">Member note:</span>{" "}
                        {request.notes}
                      </p>
                    </div>
                  )}

                  {request.adminNotes && (
                    <div className="mb-3 p-3 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                      <p className="text-sm text-purple-600">
                        <span className="font-semibold">Admin note:</span>{" "}
                        {request.adminNotes}
                      </p>
                    </div>
                  )}

                  {request.status === "pending" && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleApprove(request)}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Reject
                      </button>
                    </div>
                  )}

                  {request.status === "approved" && request.approvedAt && (
                    <div className="mt-4 p-3 bg-green-600/10 border border-green-600/30 rounded-lg">
                      <p className="text-xs text-green-600">
                        Approved on {formatDate(request.approvedAt)}
                      </p>
                    </div>
                  )}

                  {request.status === "rejected" && request.rejectedAt && (
                    <div className="mt-4 p-3 bg-red-600/10 border border-red-600/30 rounded-lg">
                      <p className="text-xs text-red-600">
                        Rejected on {formatDate(request.rejectedAt)}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* Approval Confirmation Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md">
            <div className="border-b border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white">Approve Request</h2>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-900 rounded-lg">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Supplement:</span>
                    <span className="text-white font-medium">
                      {selectedRequest.supplementName ||
                        getSupplementName(selectedRequest.supplementId)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Member:</span>
                    <span className="text-white font-medium">
                      {getMemberName(selectedRequest.memberId)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Quantity:</span>
                    <span className="text-white font-medium">
                      {selectedRequest.quantity}{" "}
                      {selectedRequest.requestType === "full"
                        ? "container(s)"
                        : "scoop(s)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total:</span>
                    <span className="text-green-600 font-bold">
                      ${selectedRequest.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Add any notes or instructions..."
                  rows="3"
                />
              </div>

              <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-600">
                  Approving this request will:
                </p>
                <ul className="text-xs text-yellow-600 mt-2 space-y-1 ml-4 list-disc">
                  <li>Update supplement inventory</li>
                  <li>Record revenue of ${selectedRequest.totalPrice.toFixed(2)}</li>
                  <li>Notify the member</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={confirmApproval}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                >
                  Confirm Approval
                </button>
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {showNotification && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-fade-in">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {notificationMessage}
        </div>
      )}
    </div>
  );
};

export default SupplementRequests;
