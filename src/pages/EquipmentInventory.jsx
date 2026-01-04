import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Layout from "../components/Layout";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  Search,
} from "lucide-react";

const EquipmentInventory = () => {
  const { user: currentUser } = useAuth();

  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [equipmentForm, setEquipmentForm] = useState({
    name: "",
    category: "cardio",
    quantity: 1,
    condition: "good",
    purchaseDate: "",
    lastMaintenance: "",
    nextMaintenance: "",
    notes: "",
  });

  const categories = ["cardio", "strength", "free weights", "accessories", "other"];
  const conditions = ["excellent", "good", "fair", "needs repair", "out of service"];

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import("firebase/firestore");

      const equipmentQuery = query(
        collection(db, "equipment"),
        where("gymId", "==", currentUser.gymId),
        orderBy("name", "asc")
      );
      const snapshot = await getDocs(equipmentQuery);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        purchaseDate: doc.data().purchaseDate?.toDate
          ? doc.data().purchaseDate.toDate()
          : doc.data().purchaseDate
          ? new Date(doc.data().purchaseDate)
          : null,
        lastMaintenance: doc.data().lastMaintenance?.toDate
          ? doc.data().lastMaintenance.toDate()
          : doc.data().lastMaintenance
          ? new Date(doc.data().lastMaintenance)
          : null,
        nextMaintenance: doc.data().nextMaintenance?.toDate
          ? doc.data().nextMaintenance.toDate()
          : doc.data().nextMaintenance
          ? new Date(doc.data().nextMaintenance)
          : null,
      }));

      setEquipment(data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingEquipment(item);
      setEquipmentForm({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        condition: item.condition,
        purchaseDate: item.purchaseDate
          ? new Date(item.purchaseDate).toISOString().split("T")[0]
          : "",
        lastMaintenance: item.lastMaintenance
          ? new Date(item.lastMaintenance).toISOString().split("T")[0]
          : "",
        nextMaintenance: item.nextMaintenance
          ? new Date(item.nextMaintenance).toISOString().split("T")[0]
          : "",
        notes: item.notes || "",
      });
    } else {
      setEditingEquipment(null);
      setEquipmentForm({
        name: "",
        category: "cardio",
        quantity: 1,
        condition: "good",
        purchaseDate: "",
        lastMaintenance: "",
        nextMaintenance: "",
        notes: "",
      });
    }
    setShowModal(true);
  };

  const handleSaveEquipment = async (e) => {
    e.preventDefault();

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, doc, updateDoc, Timestamp } = await import("firebase/firestore");

      const equipmentData = {
        name: equipmentForm.name,
        category: equipmentForm.category,
        quantity: parseInt(equipmentForm.quantity),
        condition: equipmentForm.condition,
        purchaseDate: equipmentForm.purchaseDate
          ? Timestamp.fromDate(new Date(equipmentForm.purchaseDate))
          : null,
        lastMaintenance: equipmentForm.lastMaintenance
          ? Timestamp.fromDate(new Date(equipmentForm.lastMaintenance))
          : null,
        nextMaintenance: equipmentForm.nextMaintenance
          ? Timestamp.fromDate(new Date(equipmentForm.nextMaintenance))
          : null,
        notes: equipmentForm.notes,
        gymId: currentUser.gymId,
      };

      if (editingEquipment) {
        await updateDoc(doc(db, "equipment", editingEquipment.id), {
          ...equipmentData,
          updatedAt: Timestamp.now(),
        });
        alert("Equipment updated successfully! ✓");
      } else {
        await addDoc(collection(db, "equipment"), {
          ...equipmentData,
          createdAt: Timestamp.now(),
        });
        alert("Equipment added successfully! 🎉");
      }

      setShowModal(false);
      fetchEquipment();
    } catch (error) {
      console.error("Error saving equipment:", error);
      alert("Failed to save equipment. Please try again.");
    }
  };

  const handleDeleteEquipment = async (id) => {
    if (!confirm("Are you sure you want to delete this equipment?")) {
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "equipment", id));
      fetchEquipment();
      alert("Equipment deleted successfully.");
    } catch (error) {
      console.error("Error deleting equipment:", error);
      alert("Failed to delete equipment. Please try again.");
    }
  };

  const getFilteredEquipment = () => {
    return equipment.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "needs_maintenance" &&
          item.nextMaintenance &&
          new Date(item.nextMaintenance) < new Date()) ||
        (filterStatus === "needs_repair" && item.condition === "needs repair") ||
        (filterStatus === "out_of_service" && item.condition === "out of service");

      return matchesSearch && matchesStatus;
    });
  };

  const getStatusBadge = (item) => {
    if (item.condition === "out of service") {
      return (
        <span className="px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded border border-red-500/30">
          Out of Service
        </span>
      );
    }
    if (item.condition === "needs repair") {
      return (
        <span className="px-2 py-1 bg-orange-900/30 text-orange-400 text-xs rounded border border-orange-500/30">
          Needs Repair
        </span>
      );
    }
    if (item.nextMaintenance && new Date(item.nextMaintenance) < new Date()) {
      return (
        <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded border border-yellow-500/30">
          Maintenance Due
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded border border-green-500/30">
        Operational
      </span>
    );
  };

  const stats = {
    total: equipment.length,
    needsMaintenance: equipment.filter(
      (item) => item.nextMaintenance && new Date(item.nextMaintenance) < new Date()
    ).length,
    needsRepair: equipment.filter((item) => item.condition === "needs repair").length,
    outOfService: equipment.filter((item) => item.condition === "out of service").length,
  };

  if (loading) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading equipment...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Equipment Inventory</h1>
              <p className="text-gray-400">Manage gym equipment and maintenance</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Add Equipment
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-5 h-5" />
                <p className="text-sm text-blue-100">Total Equipment</p>
              </div>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm text-yellow-100">Maintenance Due</p>
              </div>
              <p className="text-3xl font-bold">{stats.needsMaintenance}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm text-orange-100">Needs Repair</p>
              </div>
              <p className="text-3xl font-bold">{stats.needsRepair}</p>
            </div>
            <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <X className="w-5 h-5" />
                <p className="text-sm text-red-100">Out of Service</p>
              </div>
              <p className="text-3xl font-bold">{stats.outOfService}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search equipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Equipment</option>
              <option value="needs_maintenance">Maintenance Due</option>
              <option value="needs_repair">Needs Repair</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </div>
        </div>

        {/* Equipment List */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          {getFilteredEquipment().length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Equipment
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Next Maintenance
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {getFilteredEquipment().map((item) => (
                    <tr key={item.id} className="hover:bg-gray-700/50 transition">
                      <td className="px-6 py-4">
                        <p className="text-white font-medium">{item.name}</p>
                        {item.notes && (
                          <p className="text-sm text-gray-400 mt-1">{item.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-sm rounded capitalize">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white">{item.quantity}</p>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(item)}</td>
                      <td className="px-6 py-4">
                        <p className="text-gray-300">
                          {item.nextMaintenance
                            ? new Date(item.nextMaintenance).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Not scheduled"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEquipment(item.id)}
                            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-xl font-bold text-white mb-2">No Equipment Found</h3>
              <p className="text-gray-400 mb-6">
                {searchQuery || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Add your first equipment item to get started"}
              </p>
              {!searchQuery && filterStatus === "all" && (
                <button
                  onClick={() => handleOpenModal()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition"
                >
                  Add First Equipment
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingEquipment ? "Edit Equipment" : "Add Equipment"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveEquipment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Equipment Name *
                    </label>
                    <input
                      type="text"
                      value={equipmentForm.name}
                      onChange={(e) =>
                        setEquipmentForm({ ...equipmentForm, name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Treadmill, Dumbbells, Yoga Mat"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Category *
                    </label>
                    <select
                      value={equipmentForm.category}
                      onChange={(e) =>
                        setEquipmentForm({ ...equipmentForm, category: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={equipmentForm.quantity}
                      onChange={(e) =>
                        setEquipmentForm({ ...equipmentForm, quantity: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Condition *
                    </label>
                    <select
                      value={equipmentForm.condition}
                      onChange={(e) =>
                        setEquipmentForm({ ...equipmentForm, condition: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {conditions.map((cond) => (
                        <option key={cond} value={cond}>
                          {cond.charAt(0).toUpperCase() + cond.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      value={equipmentForm.purchaseDate}
                      onChange={(e) =>
                        setEquipmentForm({ ...equipmentForm, purchaseDate: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Last Maintenance
                    </label>
                    <input
                      type="date"
                      value={equipmentForm.lastMaintenance}
                      onChange={(e) =>
                        setEquipmentForm({ ...equipmentForm, lastMaintenance: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Next Maintenance
                    </label>
                    <input
                      type="date"
                      value={equipmentForm.nextMaintenance}
                      onChange={(e) =>
                        setEquipmentForm({ ...equipmentForm, nextMaintenance: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                  <textarea
                    value={equipmentForm.notes}
                    onChange={(e) =>
                      setEquipmentForm({ ...equipmentForm, notes: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes, serial number, etc."
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingEquipment ? "Update Equipment" : "Add Equipment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EquipmentInventory;
