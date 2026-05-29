import { useState, useEffect } from "react";
import { db } from "../config/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../hooks/useAuth";
import AdminLayout from "../components/AdminLayout";

const timeAgo = (value) => {
  if (!value) return "Never";
  const d = value.toDate ? value.toDate() : new Date(value);
  if (isNaN(d.getTime())) return "Never";
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const emptyForm = { name: "", ip: "", direction: "in" };

const Devices = () => {
  const { user } = useAuth();
  const gymId = user?.gymId || JSON.parse(localStorage.getItem("gymUser") || "{}")?.gymId;

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { mode: "add"|"edit", device? }
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!gymId) return;
    const unsub = onSnapshot(
      collection(db, "gyms", gymId, "devices"),
      (snap) => {
        setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [gymId]);

  const openAdd = () => {
    setForm(emptyForm);
    setError("");
    setModal({ mode: "add" });
  };

  const openEdit = (device) => {
    setForm({ name: device.name || "", ip: device.ip || "", direction: device.direction || "in" });
    setError("");
    setModal({ mode: "edit", device });
  };

  const closeModal = () => {
    setModal(null);
    setError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ip.trim()) {
      setError("Device name and IP address are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        ip: form.ip.trim(),
        direction: form.direction,
        gymId,
        updatedAt: serverTimestamp(),
      };
      if (modal.mode === "edit") {
        await updateDoc(doc(db, "gyms", gymId, "devices", modal.device.id), payload);
      } else {
        await addDoc(collection(db, "gyms", gymId, "devices"), {
          ...payload,
          status: "unknown",
          lastHeartbeat: null,
          createdAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (err) {
      setError("Failed to save device: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (device) => {
    if (!window.confirm(`Delete "${device.name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "gyms", gymId, "devices", device.id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const statusDot = (status) => {
    if (status === "online") return "bg-green-500";
    if (status === "offline") return "bg-red-500";
    return "bg-gray-500";
  };

  const statusLabel = (status) => {
    if (status === "online") return "Online";
    if (status === "offline") return "Offline";
    return "Unknown";
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Devices</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Manage attendance devices for your gym
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Device
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-900 rounded-xl border border-gray-800">
            <svg className="w-14 h-14 text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-300 font-medium text-lg">No devices added yet</p>
            <p className="text-gray-500 text-sm mt-1 max-w-xs">
              Add your Hikvision device to start tracking attendance
            </p>
            <button
              onClick={openAdd}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Device
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div key={device.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot(device.status)}`} />
                    <h3 className="text-white font-semibold truncate">{device.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(device)}
                      title="Edit"
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(device)}
                      title="Delete"
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">IP Address</span>
                    <span className="text-gray-300 font-mono text-xs">{device.ip || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Direction</span>
                    {device.direction === "out" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25">
                        Out
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/25">
                        In
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`text-xs font-medium ${device.status === "online" ? "text-green-400" : device.status === "offline" ? "text-red-400" : "text-gray-400"}`}>
                      {statusLabel(device.status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Last seen</span>
                    <span className="text-gray-400 text-xs">{timeAgo(device.lastHeartbeat)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-white font-semibold text-lg">
                {modal.mode === "edit" ? "Edit Device" : "Add Device"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Device Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Entrance"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">IP Address</label>
                <input
                  type="text"
                  value={form.ip}
                  onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))}
                  placeholder="e.g. 192.168.8.160"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Direction</label>
                <select
                  value={form.direction}
                  onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="in">Check In</option>
                  <option value="out">Check Out</option>
                </select>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition text-sm"
                >
                  {saving ? "Saving…" : modal.mode === "edit" ? "Save Changes" : "Add Device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default Devices;
