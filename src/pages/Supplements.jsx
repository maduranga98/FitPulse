import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";

const Supplements = () => {
  const { user: currentUser, logout } = useAuth();
  const currentGymId = currentUser?.gymId;

  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddSupplement, setShowAddSupplement] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const [supplementForm, setSupplementForm] = useState({
    name: "",
    availableQuantity: "",
    price: "",
    scoopPrice: "",
    details: "",
    notes: "",
    category: "",
    imageURLs: [""],
  });

  const categories = [
    "Protein",
    "Pre-Workout",
    "Post-Workout",
    "Vitamins",
    "Mass Gainer",
    "Creatine",
    "BCAA",
    "Fat Burner",
    "Energy",
    "Other",
  ];

  useEffect(() => {
    if (currentGymId) {
      fetchSupplements();
    }
  }, [currentGymId]);

  const fetchSupplements = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import(
        "firebase/firestore"
      );

      const supplementsQuery = query(
        collection(db, "supplements"),
        where("gymId", "==", currentGymId),
        orderBy("createdAt", "desc")
      );

      const supplementsSnapshot = await getDocs(supplementsQuery);
      const supplementsData = supplementsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSupplements(supplementsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching supplements:", error);
      setLoading(false);
    }
  };

  const handleAddSupplement = async () => {
    if (!supplementForm.name || !supplementForm.availableQuantity || !supplementForm.price) {
      alert("Please fill in all required fields (Name, Quantity, Price)");
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, updateDoc, doc, Timestamp } = await import(
        "firebase/firestore"
      );

      const supplementData = {
        ...supplementForm,
        gymId: currentGymId,
        availableQuantity: parseInt(supplementForm.availableQuantity),
        price: parseFloat(supplementForm.price),
        scoopPrice: supplementForm.scoopPrice ? parseFloat(supplementForm.scoopPrice) : 0,
        imageURLs: supplementForm.imageURLs.filter((url) => url.trim() !== ""),
        createdAt: Timestamp.now(),
        createdBy: currentUser.id,
      };

      if (editingSupplement) {
        await updateDoc(doc(db, "supplements", editingSupplement.id), supplementData);
        showSuccessNotification("Supplement updated successfully!");
      } else {
        await addDoc(collection(db, "supplements"), supplementData);
        showSuccessNotification("Supplement added successfully!");
      }

      resetForm();
      fetchSupplements();
    } catch (error) {
      console.error("Error adding supplement:", error);
      alert("Failed to add supplement");
    }
  };

  const handleDeleteSupplement = async (id) => {
    if (!confirm("Are you sure you want to delete this supplement?")) return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "supplements", id));
      showSuccessNotification("Supplement deleted successfully!");
      fetchSupplements();
    } catch (error) {
      console.error("Error deleting supplement:", error);
      alert("Failed to delete supplement");
    }
  };

  const handleEditSupplement = (supplement) => {
    setEditingSupplement(supplement);
    setSupplementForm({
      name: supplement.name,
      availableQuantity: supplement.availableQuantity.toString(),
      price: supplement.price.toString(),
      scoopPrice: supplement.scoopPrice ? supplement.scoopPrice.toString() : "",
      details: supplement.details || "",
      notes: supplement.notes || "",
      category: supplement.category || "",
      imageURLs: supplement.imageURLs?.length > 0 ? supplement.imageURLs : [""],
    });
    setShowAddSupplement(true);
  };

  const handleUpdateStock = async (supplement) => {
    const newQuantity = prompt(
      `Update stock for ${supplement.name}\nCurrent quantity: ${supplement.availableQuantity}`,
      supplement.availableQuantity
    );

    if (newQuantity === null) return;

    const quantity = parseInt(newQuantity);
    if (isNaN(quantity) || quantity < 0) {
      alert("Please enter a valid quantity");
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      await updateDoc(doc(db, "supplements", supplement.id), {
        availableQuantity: quantity,
      });

      showSuccessNotification("Stock updated successfully!");
      fetchSupplements();
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Failed to update stock");
    }
  };

  const handleDeleteQuantity = async (supplement) => {
    const deleteAmount = prompt(
      `Delete quantity from ${supplement.name}\nCurrent quantity: ${supplement.availableQuantity}\nEnter amount to delete:`,
      ""
    );

    if (deleteAmount === null) return;

    const amount = parseInt(deleteAmount);
    if (isNaN(amount) || amount < 0) {
      alert("Please enter a valid amount");
      return;
    }

    const newQuantity = supplement.availableQuantity - amount;
    if (newQuantity < 0) {
      alert("Cannot delete more than available quantity");
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      await updateDoc(doc(db, "supplements", supplement.id), {
        availableQuantity: newQuantity,
      });

      showSuccessNotification(`Deleted ${amount} units. New stock: ${newQuantity}`);
      fetchSupplements();
    } catch (error) {
      console.error("Error deleting quantity:", error);
      alert("Failed to delete quantity");
    }
  };

  const showSuccessNotification = (message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  const addImageField = () => {
    setSupplementForm({
      ...supplementForm,
      imageURLs: [...supplementForm.imageURLs, ""],
    });
  };

  const removeImageField = (index) => {
    const newImageURLs = supplementForm.imageURLs.filter((_, i) => i !== index);
    setSupplementForm({
      ...supplementForm,
      imageURLs: newImageURLs.length > 0 ? newImageURLs : [""],
    });
  };

  const updateImageField = (index, value) => {
    const newImageURLs = [...supplementForm.imageURLs];
    newImageURLs[index] = value;
    setSupplementForm({ ...supplementForm, imageURLs: newImageURLs });
  };

  const handleFileUpload = async (event, index) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setUploadingFiles(true);

    try {
      const { storage } = await import("../config/firebase");
      const { ref, uploadBytesResumable, getDownloadURL } = await import(
        "firebase/storage"
      );

      // Create unique filename
      const timestamp = Date.now();
      const fileName = `supplements/${currentGymId}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);

      // Upload file
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress((prev) => ({
            ...prev,
            [index]: progress,
          }));
        },
        (error) => {
          console.error("Upload error:", error);
          alert("Failed to upload image");
          setUploadingFiles(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          updateImageField(index, downloadURL);
          setUploadingFiles(false);
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[index];
            return newProgress;
          });
        }
      );
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload image");
      setUploadingFiles(false);
    }
  };

  const resetForm = () => {
    setShowAddSupplement(false);
    setEditingSupplement(null);
    setSupplementForm({
      name: "",
      availableQuantity: "",
      price: "",
      scoopPrice: "",
      details: "",
      notes: "",
      category: "",
      imageURLs: [""],
    });
    setUploadProgress({});
  };

  const filteredSupplements = supplements.filter((supplement) =>
    supplement.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading supplements...</p>
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
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Supplements Management
              </h1>
            </div>
            <button
              onClick={() => setShowAddSupplement(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-lg hover:shadow-xl"
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
              <span className="hidden sm:inline">Add Supplement</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search supplements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Supplements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSupplements.length === 0 ? (
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
                <p className="text-gray-400 text-lg mb-4">
                  {searchTerm
                    ? "No supplements found"
                    : "No supplements added yet"}
                </p>
                <button
                  onClick={() => setShowAddSupplement(true)}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
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
                  Add Your First Supplement
                </button>
              </div>
            ) : (
              filteredSupplements.map((supplement) => (
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
                        <h3 className="text-lg font-bold text-white mb-1">
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
                        ? `${supplement.availableQuantity} in stock`
                        : "Out of stock"}
                    </span>
                  </div>

                  {supplement.details && (
                    <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                      {supplement.details}
                    </p>
                  )}

                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Full Price:</span>
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

                  {supplement.notes && (
                    <div className="mb-4 p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                      <p className="text-xs text-yellow-600">{supplement.notes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => handleUpdateStock(supplement)}
                      className="px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-600 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
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
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Update Stock
                    </button>
                    <button
                      onClick={() => handleDeleteQuantity(supplement)}
                      className="px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-600 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
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
                          d="M20 12H4"
                        />
                      </svg>
                      Delete Qty
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSupplement(supplement)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSupplement(supplement.id)}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg text-sm font-medium transition"
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
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* Floating Action Button for Mobile */}
      <button
        onClick={() => setShowAddSupplement(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 z-40 lg:hidden"
        title="Add Supplement"
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
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Add/Edit Supplement Modal */}
      {showAddSupplement && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-white">
                {editingSupplement ? "Edit Supplement" : "Add New Supplement"}
              </h2>
              <button
                onClick={resetForm}
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

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Supplement Name *
                  </label>
                  <input
                    type="text"
                    value={supplementForm.name}
                    onChange={(e) =>
                      setSupplementForm({
                        ...supplementForm,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Whey Protein Gold Standard"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={supplementForm.category}
                    onChange={(e) =>
                      setSupplementForm({
                        ...supplementForm,
                        category: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Available Quantity *
                    </label>
                    <input
                      type="number"
                      value={supplementForm.availableQuantity}
                      onChange={(e) =>
                        setSupplementForm({
                          ...supplementForm,
                          availableQuantity: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Full Price ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={supplementForm.price}
                      onChange={(e) =>
                        setSupplementForm({
                          ...supplementForm,
                          price: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Scoop Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={supplementForm.scoopPrice}
                    onChange={(e) =>
                      setSupplementForm({
                        ...supplementForm,
                        scoopPrice: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Details
                  </label>
                  <textarea
                    value={supplementForm.details}
                    onChange={(e) =>
                      setSupplementForm({
                        ...supplementForm,
                        details: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Product description, benefits, usage instructions..."
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={supplementForm.notes}
                    onChange={(e) =>
                      setSupplementForm({
                        ...supplementForm,
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Internal notes, warnings, or special instructions..."
                    rows="2"
                  />
                </div>

                {/* Product Images */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Product Images
                  </label>
                  {supplementForm.imageURLs.map((url, idx) => (
                    <div key={idx} className="mb-3">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => updateImageField(idx, e.target.value)}
                          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://example.com/image.jpg or upload file"
                        />
                        {supplementForm.imageURLs.length > 1 && (
                          <button
                            onClick={() => removeImageField(idx)}
                            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg"
                            type="button"
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
                        )}
                      </div>

                      {/* File Upload */}
                      <div className="flex items-center gap-2">
                        <label className="flex-1 cursor-pointer">
                          <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
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
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                              />
                            </svg>
                            Upload Image
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, idx)}
                            className="hidden"
                            disabled={uploadingFiles}
                          />
                        </label>
                        {uploadProgress[idx] !== undefined && (
                          <div className="flex-1">
                            <div className="bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${uploadProgress[idx]}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              Uploading... {Math.round(uploadProgress[idx])}%
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Image Preview */}
                      {url && url.startsWith("http") && (
                        <div className="mt-2">
                          <img
                            src={url}
                            alt={`Preview ${idx + 1}`}
                            className="h-32 w-full object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addImageField}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1"
                    type="button"
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Another Image
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAddSupplement}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  {editingSupplement ? "Update Supplement" : "Add Supplement"}
                </button>
                <button
                  onClick={resetForm}
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

export default Supplements;
