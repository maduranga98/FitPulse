import { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";

const MemberComplaints = () => {
  const { user: currentUser } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddComplaint, setShowAddComplaint] = useState(false);
  const [viewComplaint, setViewComplaint] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const [complaintForm, setComplaintForm] = useState({
    isAnonymous: false,
    subject: "",
    category: "Equipment",
    description: "",
    priority: "Medium",
  });

  const categories = [
    "Equipment",
    "Cleanliness",
    "Staff",
    "Schedule",
    "Facilities",
    "Other",
  ];

  const priorities = ["Low", "Medium", "High"];

  useEffect(() => {
    if (currentUser?.id) {
      fetchComplaints();
    }
  }, [currentUser?.id]);

  const fetchComplaints = async () => {
    try {
      const { db } = await import("../../../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import(
        "firebase/firestore"
      );

      const complaintsQuery = query(
        collection(db, "complaints"),
        where("memberId", "==", currentUser.id),
        orderBy("createdAt", "desc")
      );

      const complaintsSnapshot = await getDocs(complaintsQuery);
      const complaintsData = complaintsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setComplaints(complaintsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching complaints:", error);
      setLoading(false);
    }
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { db } = await import("../../../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      const complaintData = {
        ...complaintForm,
        memberId: currentUser.id,
        memberName: complaintForm.isAnonymous ? "Anonymous" : currentUser.name,
        status: "Pending",
        createdAt: Timestamp.now(),
        responses: [],
        gymId: currentUser.gymId || null,
      };

      await addDoc(collection(db, "complaints"), complaintData);

      setComplaintForm({
        isAnonymous: false,
        subject: "",
        category: "Equipment",
        description: "",
        priority: "Medium",
      });

      setShowAddComplaint(false);
      fetchComplaints();
    } catch (error) {
      console.error("Error submitting complaint:", error);
      alert("Failed to submit complaint. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-600/20 text-yellow-600 border-yellow-600/30";
      case "In Progress":
        return "bg-blue-600/20 text-blue-600 border-blue-600/30";
      case "Resolved":
        return "bg-green-600/20 text-green-600 border-green-600/30";
      default:
        return "bg-gray-600/20 text-gray-600 border-gray-600/30";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "text-red-600";
      case "Medium":
        return "text-yellow-600";
      case "Low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
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

  const filteredComplaints = complaints.filter((complaint) => {
    if (filterStatus === "all") return true;
    return complaint.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            My Complaints
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Submit and track your complaints
          </p>
        </div>
        <button
          onClick={() => setShowAddComplaint(true)}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition active:scale-95 flex items-center justify-center gap-2"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Submit Complaint
        </button>
      </div>

      {/* Filter Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          {["all", "Pending", "In Progress", "Resolved"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
                filterStatus === status
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600"
              }`}
            >
              {status === "all" ? "All" : status}
            </button>
          ))}
        </div>
      </div>

      {/* Complaints List */}
      {filteredComplaints.length === 0 ? (
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
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            No Complaints Found
          </h3>
          <p className="text-gray-400">
            {filterStatus === "all"
              ? "You haven't submitted any complaints yet."
              : `No ${filterStatus.toLowerCase()} complaints found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredComplaints.map((complaint) => (
            <div
              key={complaint.id}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 hover:border-gray-600 transition cursor-pointer"
              onClick={() => setViewComplaint(complaint)}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">
                        {complaint.subject}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-gray-400">
                          {complaint.category}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className={getPriorityColor(complaint.priority)}>
                          {complaint.priority} Priority
                        </span>
                        {complaint.isAnonymous && (
                          <>
                            <span className="text-gray-600">•</span>
                            <span className="text-purple-600">Anonymous</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2">
                    {complaint.description}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      complaint.status
                    )}`}
                  >
                    {complaint.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(complaint.createdAt)}
                  </span>
                </div>
              </div>

              {complaint.responses && complaint.responses.length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{complaint.responses.length} Response(s)</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Complaint Modal */}
      {showAddComplaint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-white">
                Submit Complaint
              </h2>
              <button
                onClick={() => setShowAddComplaint(false)}
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

            <form onSubmit={handleSubmitComplaint} className="p-6 space-y-6">
              {/* Anonymous Toggle */}
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-white font-medium">
                      Submit Anonymously
                    </span>
                    <p className="text-sm text-gray-400 mt-1">
                      Your identity will be hidden from staff
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={complaintForm.isAnonymous}
                      onChange={(e) =>
                        setComplaintForm({
                          ...complaintForm,
                          isAnonymous: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-600/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </div>
                </label>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={complaintForm.subject}
                  onChange={(e) =>
                    setComplaintForm({
                      ...complaintForm,
                      subject: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="Brief summary of your complaint"
                  required
                />
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={complaintForm.category}
                    onChange={(e) =>
                      setComplaintForm({
                        ...complaintForm,
                        category: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                    required
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Priority *
                  </label>
                  <select
                    value={complaintForm.priority}
                    onChange={(e) =>
                      setComplaintForm({
                        ...complaintForm,
                        priority: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                    required
                  >
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={complaintForm.description}
                  onChange={(e) =>
                    setComplaintForm({
                      ...complaintForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none"
                  placeholder="Provide detailed information about your complaint..."
                  rows="6"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddComplaint(false)}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Complaint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Complaint Modal */}
      {viewComplaint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-white">
                Complaint Details
              </h2>
              <button
                onClick={() => setViewComplaint(null)}
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

            <div className="p-6 space-y-6">
              {/* Status and Info */}
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(
                    viewComplaint.status
                  )}`}
                >
                  {viewComplaint.status}
                </span>
                <span className="text-gray-400 text-sm">
                  {formatDate(viewComplaint.createdAt)}
                </span>
              </div>

              {/* Complaint Info */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Subject
                  </label>
                  <p className="text-white text-lg font-semibold">
                    {viewComplaint.subject}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Category
                    </label>
                    <p className="text-white">{viewComplaint.category}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Priority
                    </label>
                    <p className={getPriorityColor(viewComplaint.priority)}>
                      {viewComplaint.priority}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Submitted By
                  </label>
                  <p className="text-white">
                    {viewComplaint.isAnonymous ? (
                      <span className="flex items-center gap-2">
                        Anonymous
                        <span className="text-xs text-purple-600 bg-purple-600/20 px-2 py-1 rounded">
                          Hidden
                        </span>
                      </span>
                    ) : (
                      viewComplaint.memberName
                    )}
                  </p>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Description
                  </label>
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <p className="text-white whitespace-pre-wrap">
                      {viewComplaint.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Responses */}
              {viewComplaint.responses &&
                viewComplaint.responses.length > 0 && (
                  <div className="border-t border-gray-700 pt-6">
                    <h3 className="text-lg font-bold text-white mb-4">
                      Responses from Admin
                    </h3>
                    <div className="space-y-4">
                      {viewComplaint.responses.map((response, index) => (
                        <div
                          key={index}
                          className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg
                                className="w-5 h-5 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-white font-medium">
                                  {response.adminName}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDate(response.respondedAt)}
                                </span>
                              </div>
                              <p className="text-gray-300 text-sm">
                                {response.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberComplaints;
