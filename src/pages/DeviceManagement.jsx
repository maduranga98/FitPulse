import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNotification } from "../contexts/NotificationContext";
import Sidebar from "../components/Sidebar";
import { isAdmin } from "../utils/authUtils";

const DIRECTIONS = ["in", "out", "both"];
const PROTOCOLS = ["HTTP", "HTTPS"];

const emptyForm = {
  name: "",
  location: "",
  ip: "",
  port: "80",
  username: "admin",
  password: "",
  model: "",
  serialNumber: "",
  direction: "in",
  protocol: "HTTP",
};

const DeviceManagement = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const gymId = user?.gymId;
  const userIsAdmin = isAdmin(user);

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (gymId) fetchDevices();
  }, [gymId]);

  const fetchDevices = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
      const snap = await getDocs(
        query(collection(db, "gyms", gymId, "devices"), orderBy("createdAt", "desc"))
      );
      setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      showError("Failed to load devices: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingDevice(null);
    setForm(emptyForm);
    setShowPassword(false);
    setShowForm(true);
  };

  const openEdit = (device) => {
    setEditingDevice(device);
    setForm({
      name: device.name || "",
      location: device.location || "",
      ip: device.ip || "",
      port: String(device.port || 80),
      username: device.username || "admin",
      password: device.password || "",
      model: device.model || "",
      serialNumber: device.serialNumber || "",
      direction: device.direction || "in",
      protocol: device.protocol || "HTTP",
    });
    setShowPassword(false);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!gymId || !userIsAdmin) return;
    if (!form.name || !form.ip || !form.password) {
      showError("Name, IP address and password are required");
      return;
    }

    setSaving(true);
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");

      const payload = {
        ...form,
        port: parseInt(form.port) || 80,
        gymId,
        status: "unknown",
        lastHeartbeat: null,
        updatedAt: serverTimestamp(),
      };

      if (editingDevice) {
        await updateDoc(doc(db, "gyms", gymId, "devices", editingDevice.id), payload);
        showSuccess("Device updated");
      } else {
        await addDoc(collection(db, "gyms", gymId, "devices"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showSuccess("Device added");
      }

      setShowForm(false);
      fetchDevices();
    } catch (err) {
      showError("Failed to save device: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (device) => {
    if (!window.confirm(`Delete device "${device.name}"? This cannot be undone.`)) return;
    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "gyms", gymId, "devices", device.id));
      showSuccess("Device deleted");
      fetchDevices();
    } catch (err) {
      showError("Failed to delete device: " + err.message);
    }
  };

  const handleTestConnection = async (device) => {
    setTestingId(device.id);
    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const { app } = await import("../config/firebase");
      const fns = getFunctions(app);
      const testDevice = httpsCallable(fns, "testDeviceConnection");
      const result = await testDevice({ deviceId: device.id, gymId });
      if (result.data.success) {
        showSuccess(`Connected to ${device.name} successfully`);
      } else {
        showError(`Connection failed: ${result.data.error}`);
      }
    } catch (err) {
      showError(`Connection test failed: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const statusBadge = (status) => {
    const map = {
      online: "bg-green-500/20 text-green-400 border border-green-500/30",
      offline: "bg-red-500/20 text-red-400 border border-red-500/30",
      error: "bg-red-500/20 text-red-400 border border-red-500/30",
      unknown: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
    };
    return map[status] || map.unknown;
  };

  return (
    <div className="flex h-screen w-screen bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Device Management</h1>
              <p className="text-sm text-gray-400">Manage Hikvision attendance terminals</p>
            </div>
          </div>
          {userIsAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Device
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              <p className="text-gray-400 text-lg font-medium">No devices registered</p>
              <p className="text-gray-500 text-sm mt-1">Add your first Hikvision terminal to get started</p>
              {userIsAdmin && (
                <button onClick={openAdd} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                  Add Device
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {devices.map((device) => (
                <div key={device.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-white font-semibold text-lg leading-tight">{device.name}</h3>
                      <p className="text-gray-400 text-sm">{device.location}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${statusBadge(device.status)}`}>
                      {device.status || "unknown"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="text-gray-500 w-20 flex-shrink-0">IP</span>
                      <span className="font-mono">{device.ip}:{device.port}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="text-gray-500 w-20 flex-shrink-0">Direction</span>
                      <span className="capitalize">{device.direction}</span>
                    </div>
                    {device.model && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <span className="text-gray-500 w-20 flex-shrink-0">Model</span>
                        <span>{device.model}</span>
                      </div>
                    )}
                    {device.lastHeartbeat && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <span className="text-gray-500 w-20 flex-shrink-0">Last seen</span>
                        <span>{new Date(device.lastHeartbeat.toDate?.() || device.lastHeartbeat).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleTestConnection(device)}
                      disabled={testingId === device.id}
                      className="flex-1 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      {testingId === device.id ? "Testing..." : "Test"}
                    </button>
                    {userIsAdmin && (
                      <>
                        <button
                          onClick={() => openEdit(device)}
                          className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(device)}
                          className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg text-sm transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">
                {editingDevice ? "Edit Device" : "Add Device"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Device Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Main Entrance"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Front Door, Gym Floor"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">IP Address *</label>
                  <input
                    type="text"
                    value={form.ip}
                    onChange={(e) => setForm({ ...form, ip: e.target.value })}
                    placeholder="192.168.1.100"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                    placeholder="80"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Direction</label>
                  <select
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    {DIRECTIONS.map((d) => (
                      <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Protocol</label>
                  <select
                    value={form.protocol}
                    onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    {PROTOCOLS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Model</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. DS-K1T671MF"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={form.serialNumber}
                    onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
                >
                  {saving ? "Saving..." : editingDevice ? "Update" : "Add Device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceManagement;
