import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useGymSettings } from "../../contexts/GymSettingsContext";
import AdminLayout from "../../components/AdminLayout";

const InstructorSupplements = () => {
  const { user } = useAuth();
  const { settings } = useGymSettings();
  const currentGymId = user?.gymId;

  const [activeTab, setActiveTab] = useState("inventory");
  const [supplements, setSupplements] = useState([]);
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState(null);
  const [supplementForm, setSupplementForm] = useState({
    name: "", availableQuantity: "", price: "", scoopPrice: "",
    details: "", notes: "", category: "", imageURLs: [""],
  });

  const supplementCategories = ["Protein", "Pre-Workout", "Post-Workout", "Vitamins", "Mass Gainer", "Creatine", "BCAA", "Fat Burner", "Energy", "Other"];

  const canAccessSupplements = settings.instructorPermissions?.viewSupplements !== false;

  useEffect(() => {
    if (canAccessSupplements && currentGymId) fetchData();
  }, [currentGymId, canAccessSupplements]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import("firebase/firestore");

      const [suppSnap, reqSnap, memSnap] = await Promise.all([
        getDocs(query(collection(db, "supplements"), where("gymId", "==", currentGymId))),
        getDocs(query(collection(db, "supplementRequests"), where("gymId", "==", currentGymId), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "members"), where("gymId", "==", currentGymId))),
      ]);

      setSupplements(suppSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setRequests(reqSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMembers(memSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching supplement data:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetSupplementForm = () => {
    setShowAddModal(false);
    setEditingSupplement(null);
    setSupplementForm({ name: "", availableQuantity: "", price: "", scoopPrice: "", details: "", notes: "", category: "", imageURLs: [""] });
  };

  const handleSaveSupplement = async () => {
    if (!supplementForm.name || !supplementForm.availableQuantity || !supplementForm.price) {
      showToast("Please fill in Name, Quantity, and Price.", "error");
      return;
    }
    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, updateDoc, doc, Timestamp } = await import("firebase/firestore");
      const data = {
        ...supplementForm,
        gymId: currentGymId,
        availableQuantity: parseInt(supplementForm.availableQuantity),
        price: parseFloat(supplementForm.price),
        scoopPrice: supplementForm.scoopPrice ? parseFloat(supplementForm.scoopPrice) : 0,
        imageURLs: supplementForm.imageURLs.filter((u) => u.trim()),
        updatedAt: Timestamp.now(),
      };
      if (editingSupplement) {
        await updateDoc(doc(db, "supplements", editingSupplement.id), data);
        showToast("Supplement updated!");
      } else {
        await addDoc(collection(db, "supplements"), { ...data, createdAt: Timestamp.now(), createdBy: user?.id });
        showToast("Supplement added!");
      }
      resetSupplementForm();
      fetchData();
    } catch (err) {
      console.error(err);
      showToast("Failed to save supplement.", "error");
    }
  };

  const handleEditSupplement = (supp) => {
    setEditingSupplement(supp);
    setSupplementForm({
      name: supp.name || "",
      availableQuantity: String(supp.availableQuantity ?? ""),
      price: String(supp.price ?? ""),
      scoopPrice: supp.scoopPrice ? String(supp.scoopPrice) : "",
      details: supp.details || "",
      notes: supp.notes || "",
      category: supp.category || "",
      imageURLs: supp.imageURLs?.length ? supp.imageURLs : [""],
    });
    setShowAddModal(true);
  };

  const handleDeleteSupplement = async (id) => {
    if (!confirm("Delete this supplement?")) return;
    try {
      const { db } = await import("../../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "supplements", id));
      showToast("Supplement deleted.");
      fetchData();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete supplement.", "error");
    }
  };

  const handleUpdateStock = async (supp) => {
    const val = prompt(`Update stock for ${supp.name}\nCurrent: ${supp.availableQuantity}`, supp.availableQuantity);
    if (val === null) return;
    const qty = parseInt(val);
    if (isNaN(qty) || qty < 0) { alert("Invalid quantity"); return; }
    try {
      const { db } = await import("../../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "supplements", supp.id), { availableQuantity: qty });
      showToast("Stock updated!");
      fetchData();
    } catch (err) {
      showToast("Failed to update stock.", "error");
    }
  };

  const handleImageUpload = async (e, index) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { alert("File must be under 5MB"); return; }
    try {
      const { storage } = await import("../../config/firebase");
      const { ref, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");
      const fileName = `supplements/${currentGymId}/${Date.now()}_${file.name}`;
      const task = uploadBytesResumable(ref(storage, fileName), file);
      task.on("state_changed", null,
        (err) => { console.error(err); showToast("Upload failed", "error"); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          const urls = [...supplementForm.imageURLs];
          urls[index] = url;
          setSupplementForm((f) => ({ ...f, imageURLs: urls }));
          showToast("Image uploaded!");
        }
      );
    } catch (err) { console.error(err); showToast("Upload failed", "error"); }
  };

  const getMemberName = (memberId) =>
    members.find((m) => m.id === memberId)?.name || "Unknown Member";

  const getSupplementName = (suppId) =>
    supplements.find((s) => s.id === suppId)?.name || "Unknown Supplement";

  const formatDate = (ts) => {
    if (!ts) return "N/A";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const handleOpenApproval = (request) => {
    setSelectedRequest(request);
    setAdminNotes("");
    setShowApprovalModal(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      const { db } = await import("../../config/firebase");
      const { doc, updateDoc, getDoc, Timestamp, addDoc, collection } = await import("firebase/firestore");

      const suppRef = doc(db, "supplements", selectedRequest.supplementId);
      const suppSnap = await getDoc(suppRef);
      if (!suppSnap.exists()) throw new Error("Supplement not found");

      const suppData = suppSnap.data();
      const currentQty = suppData.availableQuantity || 0;
      const requestedQty = selectedRequest.quantity || 1;

      if (currentQty < requestedQty) {
        showToast("Insufficient stock to approve this request.", "error");
        setSubmitting(false);
        return;
      }

      await updateDoc(doc(db, "supplementRequests", selectedRequest.id), {
        status: "approved",
        notes: adminNotes,
        reviewedAt: Timestamp.now(),
        reviewedBy: user?.name || user?.username || "Instructor",
      });

      await updateDoc(suppRef, { availableQuantity: currentQty - requestedQty });

      const totalPrice = selectedRequest.requestType === "scoop"
        ? (suppData.scoopPrice || 0) * requestedQty
        : (suppData.price || 0) * requestedQty;

      await addDoc(collection(db, "supplementRevenue"), {
        gymId: currentGymId,
        supplementId: selectedRequest.supplementId,
        supplementName: suppData.name,
        memberId: selectedRequest.memberId,
        quantity: requestedQty,
        requestType: selectedRequest.requestType,
        amount: totalPrice,
        recordedAt: Timestamp.now(),
      });

      setShowApprovalModal(false);
      showToast("Request approved successfully!");
      fetchData();
    } catch (err) {
      console.error("Error approving request:", err);
      showToast("Failed to approve request.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      const { db } = await import("../../config/firebase");
      const { doc, updateDoc, Timestamp } = await import("firebase/firestore");

      await updateDoc(doc(db, "supplementRequests", selectedRequest.id), {
        status: "rejected",
        notes: adminNotes,
        reviewedAt: Timestamp.now(),
        reviewedBy: user?.name || user?.username || "Instructor",
      });

      setShowApprovalModal(false);
      showToast("Request rejected.");
      fetchData();
    } catch (err) {
      console.error("Error rejecting request:", err);
      showToast("Failed to reject request.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSupplements = supplements.filter((s) =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = requests.filter((r) =>
    filterStatus === "all" || r.status === filterStatus
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (!canAccessSupplements) {
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
            <p className="text-gray-400 text-sm">Supplement management is not enabled for instructors. Please contact your gym admin.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${toast.type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"}`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Supplements</h1>
            <p className="text-gray-400 text-sm">Manage supplement inventory and member requests</p>
          </div>
          <button
            onClick={() => { resetSupplementForm(); setShowAddModal(true); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Supplement
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Supplements", value: supplements.length, color: "blue" },
            { label: "Pending Requests", value: pendingCount, color: "yellow" },
            { label: "Total Requests", value: requests.length, color: "purple" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="text-gray-400 text-xs mb-1">{label}</div>
              <div className={`text-2xl font-bold text-${color}-400`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 w-fit">
          {[
            { id: "inventory", label: "Inventory" },
            { id: "requests", label: `Requests${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : activeTab === "inventory" ? (
          <>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search supplements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSupplements.map((supp) => (
                <div key={supp.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition">
                  {supp.imageURLs?.[0] && (
                    <img src={supp.imageURLs[0]} alt={supp.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-white font-bold">{supp.name}</h3>
                    {supp.category && (
                      <span className="text-xs px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded-full flex-shrink-0">{supp.category}</span>
                    )}
                  </div>
                  {supp.details && <p className="text-gray-400 text-xs mb-3 line-clamp-2">{supp.details}</p>}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Stock:</span>
                      <span className={`font-medium ${(supp.availableQuantity || 0) <= 5 ? "text-red-400" : "text-white"}`}>
                        {supp.availableQuantity ?? 0} units
                      </span>
                    </div>
                    {supp.price && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price:</span>
                        <span className="text-green-400 font-medium">Rs. {supp.price}</span>
                      </div>
                    )}
                    {supp.scoopPrice && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Scoop Price:</span>
                        <span className="text-green-400 font-medium">Rs. {supp.scoopPrice}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
                    <button onClick={() => handleUpdateStock(supp)} className="flex-1 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs font-medium transition">Stock</button>
                    <button onClick={() => handleEditSupplement(supp)} className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-medium transition">Edit</button>
                    <button onClick={() => handleDeleteSupplement(supp.id)} className="flex-1 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium transition">Delete</button>
                  </div>
                </div>
              ))}
              {filteredSupplements.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">No supplements found.</div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Requests Filter */}
            <div className="flex gap-2 flex-wrap">
              {["all", "pending", "approved", "rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                    filterStatus === s ? "bg-blue-600 text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <div key={req.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium">{getMemberName(req.memberId)}</div>
                      <div className="text-gray-400 text-sm">{getSupplementName(req.supplementId)}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>Qty: {req.quantity || 1}</span>
                        {req.requestType && <span className="capitalize">Type: {req.requestType}</span>}
                        <span>{formatDate(req.createdAt)}</span>
                      </div>
                      {req.notes && <div className="mt-1 text-xs text-gray-500 italic">"{req.notes}"</div>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                        req.status === "approved" ? "bg-green-600/20 text-green-400" :
                        req.status === "rejected" ? "bg-red-600/20 text-red-400" :
                        "bg-yellow-600/20 text-yellow-400"
                      }`}>
                        {req.status || "pending"}
                      </span>
                      {req.status === "pending" && (
                        <button
                          onClick={() => handleOpenApproval(req)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredRequests.length === 0 && (
                <div className="text-center py-12 text-gray-400">No requests found.</div>
              )}
            </div>
          </>
        )}

        {/* Add/Edit Supplement Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-bold text-white">{editingSupplement ? "Edit Supplement" : "Add Supplement"}</h2>
                <button onClick={resetSupplementForm} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Name *</label>
                  <input type="text" value={supplementForm.name} onChange={(e) => setSupplementForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Supplement name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Quantity *</label>
                    <input type="number" value={supplementForm.availableQuantity} onChange={(e) => setSupplementForm((f) => ({ ...f, availableQuantity: e.target.value }))} className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="100" min="0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Price (Rs.) *</label>
                    <input type="number" value={supplementForm.price} onChange={(e) => setSupplementForm((f) => ({ ...f, price: e.target.value }))} className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="2500" min="0" step="0.01" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Scoop Price (Rs.)</label>
                    <input type="number" value={supplementForm.scoopPrice} onChange={(e) => setSupplementForm((f) => ({ ...f, scoopPrice: e.target.value }))} className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Category</label>
                    <select value={supplementForm.category} onChange={(e) => setSupplementForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select category</option>
                      {supplementCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Details</label>
                  <textarea value={supplementForm.details} onChange={(e) => setSupplementForm((f) => ({ ...f, details: e.target.value }))} className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Product description..." />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Notes</label>
                  <textarea value={supplementForm.notes} onChange={(e) => setSupplementForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Internal notes..." />
                </div>
                {/* Images */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-400">Images</label>
                    <button type="button" onClick={() => setSupplementForm((f) => ({ ...f, imageURLs: [...f.imageURLs, ""] }))} className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
                  </div>
                  <div className="space-y-2">
                    {supplementForm.imageURLs.map((url, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input type="text" value={url} onChange={(e) => { const u = [...supplementForm.imageURLs]; u[i] = e.target.value; setSupplementForm((f) => ({ ...f, imageURLs: u })); }} className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Image URL" />
                        <label className="cursor-pointer px-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, i)} />
                        </label>
                        {supplementForm.imageURLs.length > 1 && (
                          <button type="button" onClick={() => setSupplementForm((f) => ({ ...f, imageURLs: f.imageURLs.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-300">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                        {url && url.startsWith("http") && <img src={url} alt="" className="h-8 w-8 object-cover rounded" onError={(e) => e.target.style.display = "none"} />}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={resetSupplementForm} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition">Cancel</button>
                  <button onClick={handleSaveSupplement} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
                    {editingSupplement ? "Update" : "Add Supplement"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Approval Modal */}
        {showApprovalModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <div>
                  <h2 className="text-lg font-bold text-white">Review Request</h2>
                  <p className="text-gray-400 text-sm">{getMemberName(selectedRequest.memberId)}</p>
                </div>
                <button onClick={() => setShowApprovalModal(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Supplement:</span>
                    <span className="text-white font-medium">{getSupplementName(selectedRequest.supplementId)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Quantity:</span>
                    <span className="text-white font-medium">{selectedRequest.quantity || 1}</span>
                  </div>
                  {selectedRequest.requestType && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Type:</span>
                      <span className="text-white font-medium capitalize">{selectedRequest.requestType}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Notes (optional)</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Add notes for the member..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleReject}
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Processing...</> : "Approve"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorSupplements;
