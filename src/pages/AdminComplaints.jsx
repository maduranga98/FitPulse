import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import { where } from "firebase/firestore";

const AdminComplaints = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewComplaint, setViewComplaint] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseForm, setResponseForm] = useState({
    message: "",
    newStatus: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === "gym_admin" || user?.role === "manager";

  const categories = [
    "all",
    "Equipment",
    "Cleanliness",
    "Staff",
    "Schedule",
    "Facilities",
    "Other",
  ];

  useEffect(() => {
    if (isAdmin) {
      fetchComplaints();
    }
  }, [isAdmin]);

  const fetchComplaints = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, orderBy, query } = await import(
        "firebase/firestore"
      );

      const complaintsQuery = query(
        collection(db, "complaints"),
        where("gymId", "==", currentGymId),
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

  const handleUpdateStatus = async (complaintId, newStatus) => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      await updateDoc(doc(db, "complaints", complaintId), {
        status: newStatus,
      });

      fetchComplaints();
      if (viewComplaint?.id === complaintId) {
        setViewComplaint({ ...viewComplaint, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    }
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc, arrayUnion, Timestamp } = await import(
        "firebase/firestore"
      );

      const response = {
        message: responseForm.message,
        adminName: user.name,
        adminId: user.id,
        respondedAt: Timestamp.now(),
      };

      const updateData = {
        responses: arrayUnion(response),
      };

      if (responseForm.newStatus) {
        updateData.status = responseForm.newStatus;
      }

      await updateDoc(doc(db, "complaints", viewComplaint.id), updateData);

      setResponseForm({ message: "", newStatus: "" });
      setShowResponseModal(false);
      fetchComplaints();

      setViewComplaint({
        ...viewComplaint,
        responses: [...(viewComplaint.responses || []), response],
        status: responseForm.newStatus || viewComplaint.status,
      });

      alert("Response submitted successfully! ✅");
    } catch (error) {
      console.error("Error submitting response:", error);
      alert("Failed to submit response. Please try again.");
    } finally {
      setSubmitting(false);
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

  const getStatusColor = (status) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-600/20 text-yellow-600 border-yellow-600/50";
      case "In Progress":
        return "bg-blue-600/20 text-blue-600 border-blue-600/50";
      case "Resolved":
        return "bg-green-600/20 text-green-600 border-green-600/50";
      default:
        return "bg-gray-600/20 text-gray-400 border-gray-600/50";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-600/20 text-red-600";
      case "Medium":
        return "bg-orange-600/20 text-orange-600";
      case "Low":
        return "bg-green-600/20 text-green-600";
      default:
        return "bg-gray-600/20 text-gray-400";
    }
  };

  const filteredComplaints = complaints.filter((complaint) => {
    const matchesStatus =
      filterStatus === "all" || complaint.status === filterStatus;
    const matchesCategory =
      filterCategory === "all" || complaint.category === filterCategory;
    const matchesSearch =
      searchTerm === "" ||
      complaint.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.memberName?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesCategory && matchesSearch;
  });

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading complaints...</p>
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
                  Complaints Management
                </h1>
                <p className="text-gray-400 text-sm hidden sm:block">
                  View and respond to member complaints
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total</span>
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">
                {complaints.length}
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Pending</span>
                <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-yellow-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">
                {complaints.filter((c) => c.status === "Pending").length}
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">In Progress</span>
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">
                {complaints.filter((c) => c.status === "In Progress").length}
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Resolved</span>
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
                {complaints.filter((c) => c.status === "Resolved").length}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search complaints..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === "all" ? "All Categories" : category}
                    </option>
                  ))}
                </select>
              </div>
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
                No complaints match your current filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredComplaints.map((complaint) => (
                <div
                  key={complaint.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition cursor-pointer"
                  onClick={() => setViewComplaint(complaint)}
                >
                  <div className="flex flex-col lg:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-3">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-blue-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-2">
                            {complaint.subject}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                                complaint.priority
                              )}`}
                            >
                              {complaint.priority}
                            </span>
                            <span className="text-gray-400 text-sm">
                              {complaint.category}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-gray-400 text-sm">
                              {complaint.isAnonymous
                                ? "Anonymous"
                                : complaint.memberName}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm line-clamp-2">
                            {complaint.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 lg:min-w-[180px]">
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
                      {complaint.responses &&
                        complaint.responses.length > 0 && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
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
                            {complaint.responses.length} Response(s)
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* View Complaint Modal */}
      {viewComplaint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
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
              {/* Status and Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4">
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

                <div className="flex gap-2">
                  <select
                    value={viewComplaint.status}
                    onChange={(e) =>
                      handleUpdateStatus(viewComplaint.id, e.target.value)
                    }
                    className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>

                  <button
                    onClick={() => setShowResponseModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    Add Response
                  </button>
                </div>
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <p
                      className={`font-medium ${
                        getPriorityColor(viewComplaint.priority).split(" ")[0]
                      }`}
                    >
                      {viewComplaint.priority}
                    </p>
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
                      Admin Responses ({viewComplaint.responses.length})
                    </h3>
                    <div className="space-y-4">
                      {viewComplaint.responses.map((response, index) => (
                        <div
                          key={index}
                          className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg
                                className="w-5 h-5 text-blue-600"
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
                              <p className="text-gray-300 whitespace-pre-wrap">
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

      {/* Response Modal */}
      {showResponseModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl">
            <div className="border-b border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Add Response</h2>
              <button
                onClick={() => setShowResponseModal(false)}
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

            <form onSubmit={handleSubmitResponse} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Response *
                </label>
                <textarea
                  value={responseForm.message}
                  onChange={(e) =>
                    setResponseForm({
                      ...responseForm,
                      message: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                  placeholder="Write your response to the member..."
                  rows="6"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Update Status (Optional)
                </label>
                <select
                  value={responseForm.newStatus}
                  onChange={(e) =>
                    setResponseForm({
                      ...responseForm,
                      newStatus: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Keep current status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowResponseModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Response"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminComplaints;
