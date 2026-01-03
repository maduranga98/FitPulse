import { useState, useEffect } from "react";
import MemberLayout from "../../components/MemberLayout";
import { useAuth } from "../../hooks/useAuth";

const MemberSupplements = () => {
  const { user: currentUser } = useAuth();
  const currentGymId = currentUser?.gymId;
  const memberId = currentUser?.id;

  const [supplements, setSupplements] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedSupplement, setSelectedSupplement] = useState(null);
  const [requestForm, setRequestForm] = useState({
    quantity: "",
    requestType: "full",
    notes: "",
  });
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [activeTab, setActiveTab] = useState("available");

  useEffect(() => {
    if (currentGymId && memberId) {
      fetchData();
    }
  }, [currentGymId, memberId]);

  const fetchData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import(
        "firebase/firestore"
      );

      // Fetch supplements
      const supplementsQuery = query(
        collection(db, "supplements"),
        where("gymId", "==", currentGymId),
        orderBy("name")
      );
      const supplementsSnapshot = await getDocs(supplementsQuery);
      const supplementsData = supplementsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch member's requests
      const requestsQuery = query(
        collection(db, "supplementRequests"),
        where("memberId", "==", memberId),
        where("gymId", "==", currentGymId),
        orderBy("createdAt", "desc")
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      const requestsData = requestsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSupplements(supplementsData);
      setMyRequests(requestsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleRequestSupplement = (supplement) => {
    setSelectedSupplement(supplement);
    setRequestForm({
      quantity: "",
      requestType: "full",
      notes: "",
    });
    setShowRequestModal(true);
  };

  const submitRequest = async () => {
    if (!requestForm.quantity || parseInt(requestForm.quantity) <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    const quantity = parseInt(requestForm.quantity);
    const requestType = requestForm.requestType;

    // Calculate total price
    let totalPrice = 0;
    if (requestType === "full") {
      totalPrice = selectedSupplement.price * quantity;
    } else {
      totalPrice = selectedSupplement.scoopPrice * quantity;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      const requestData = {
        memberId: memberId,
        gymId: currentGymId,
        supplementId: selectedSupplement.id,
        supplementName: selectedSupplement.name,
        quantity: quantity,
        requestType: requestType,
        totalPrice: totalPrice,
        status: "pending",
        notes: requestForm.notes,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "supplementRequests"), requestData);

      showSuccessNotification("Request submitted successfully!");
      setShowRequestModal(false);
      setSelectedSupplement(null);
      fetchData();
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("Failed to submit request");
    }
  };

  const showSuccessNotification = (message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
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

  if (loading) {
    return (
      <MemberLayout>
        <div className="h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading supplements...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout>
      <div className="min-h-screen bg-gray-900">
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-white">Supplements</h1>
            <p className="text-gray-400 mt-1">
              Browse and request supplements from your gym
            </p>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {/* Tabs */}
          <div className="mb-6 flex gap-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab("available")}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "available"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Available Supplements
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "requests"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              My Requests
              {myRequests.filter((r) => r.status === "pending").length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full">
                  {myRequests.filter((r) => r.status === "pending").length}
                </span>
              )}
            </button>
          </div>

          {/* Available Supplements Tab */}
          {activeTab === "available" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {supplements.length === 0 ? (
                <div className="col-span-full text-center py-12">
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
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <p className="text-gray-400 text-lg">
                    No supplements available yet
                  </p>
                </div>
              ) : (
                supplements.map((supplement) => (
                  <div
                    key={supplement.id}
                    className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition"
                  >
                    {/* Product Image */}
                    {supplement.imageURLs?.[0] && (
                      <div className="h-48 bg-gray-900 overflow-hidden">
                        <img
                          src={supplement.imageURLs[0]}
                          alt={supplement.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-2">
                            {supplement.name}
                          </h3>
                        {supplement.category && (
                          <span className="inline-block px-2 py-1 bg-purple-600/20 text-purple-600 rounded text-xs font-medium">
                            {supplement.category}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          supplement.availableQuantity > 10
                            ? "bg-green-600/20 text-green-600"
                            : supplement.availableQuantity > 0
                            ? "bg-yellow-600/20 text-yellow-600"
                            : "bg-red-600/20 text-red-600"
                        }`}
                      >
                        {supplement.availableQuantity > 0
                          ? `${supplement.availableQuantity} available`
                          : "Out of stock"}
                      </span>
                    </div>

                    {supplement.details && (
                      <p className="text-sm text-gray-400 mb-4 line-clamp-3">
                        {supplement.details}
                      </p>
                    )}

                    <div className="mb-4 space-y-2 bg-gray-900 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Full Container:</span>
                        <span className="text-white font-semibold">
                          ${supplement.price.toFixed(2)}
                        </span>
                      </div>
                      {supplement.scoopPrice > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Per Scoop:</span>
                          <span className="text-blue-600 font-semibold">
                            ${supplement.scoopPrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRequestSupplement(supplement)}
                      disabled={supplement.availableQuantity === 0}
                      className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition ${
                        supplement.availableQuantity === 0
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                    >
                      {supplement.availableQuantity === 0
                        ? "Out of Stock"
                        : "Request Supplement"}
                    </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* My Requests Tab */}
          {activeTab === "requests" && (
            <div className="space-y-4">
              {myRequests.length === 0 ? (
                <div className="text-center py-12">
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
                  <p className="text-gray-400 text-lg">No requests yet</p>
                </div>
              ) : (
                myRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-1">
                          {request.supplementName || getSupplementName(request.supplementId)}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {formatDate(request.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-xs font-medium ${
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

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-900 rounded-lg p-3">
                        <div className="text-gray-400 text-xs mb-1">Quantity</div>
                        <div className="text-white font-medium">
                          {request.quantity}{" "}
                          {request.requestType === "full"
                            ? "container(s)"
                            : "scoop(s)"}
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded-lg p-3">
                        <div className="text-gray-400 text-xs mb-1">
                          Total Price
                        </div>
                        <div className="text-white font-medium">
                          ${request.totalPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {request.notes && (
                      <div className="mb-3 p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                        <p className="text-sm text-blue-600">
                          <span className="font-semibold">Your note:</span>{" "}
                          {request.notes}
                        </p>
                      </div>
                    )}

                    {request.adminNotes && (
                      <div className="p-3 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <p className="text-sm text-purple-600">
                          <span className="font-semibold">Admin note:</span>{" "}
                          {request.adminNotes}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* Request Modal */}
      {showRequestModal && selectedSupplement && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md">
            <div className="border-b border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Request {selectedSupplement.name}
              </h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Request Type
                  </label>
                  <select
                    value={requestForm.requestType}
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        requestType: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="full">
                      Full Container (${selectedSupplement.price.toFixed(2)} each)
                    </option>
                    {selectedSupplement.scoopPrice > 0 && (
                      <option value="scoop">
                        Per Scoop (${selectedSupplement.scoopPrice.toFixed(2)} each)
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={requestForm.quantity}
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        quantity: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter quantity"
                    min="1"
                    max={selectedSupplement.availableQuantity}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Available: {selectedSupplement.availableQuantity}
                  </p>
                </div>

                {requestForm.quantity && (
                  <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 font-semibold">
                        Estimated Total:
                      </span>
                      <span className="text-blue-600 font-bold text-xl">
                        $
                        {(
                          (requestForm.requestType === "full"
                            ? selectedSupplement.price
                            : selectedSupplement.scoopPrice) *
                          parseInt(requestForm.quantity || 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={requestForm.notes}
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Any special requests or notes..."
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={submitRequest}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Submit Request
                </button>
                <button
                  onClick={() => setShowRequestModal(false)}
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
    </MemberLayout>
  );
};

export default MemberSupplements;
