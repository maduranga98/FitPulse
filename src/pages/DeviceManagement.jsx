import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useNotification } from "../contexts/NotificationContext";
import AdminLayout from "../components/AdminLayout";
import {
  LayoutDashboard,
  Server,
  ScrollText,
  Settings,
  Monitor,
  Wifi,
  WifiOff,
  Users,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Settings2,
  Lock,
  Unlock,
  DoorOpen,
  DoorClosed,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const WEBHOOK_URL =
  "https://us-central1-gymnex-65440.cloudfunctions.net/hikCentralWebhook";

const SUBSCRIBE_EVENT_TYPES = [
  196893, 198914, 198915, 196890, 196896, 196883, 196885, 196888,
];

const EVENT_TYPES = {
  196893: { label: "Face Recognition", emoji: "😊" },
  198914: { label: "Card Tap", emoji: "💳" },
  198915: { label: "Card + PIN", emoji: "🔢" },
  196890: { label: "Face + Card", emoji: "🔒" },
};

const DEVICE_TYPES = [
  { value: "access_control", label: "Access Control" },
  { value: "camera", label: "Camera" },
  { value: "intercom", label: "Intercom" },
  { value: "other", label: "Other" },
];

const emptyDeviceForm = {
  name: "",
  deviceId: "",
  doorIndexCode: "",
  serialNo: "",
  ip: "",
  type: "access_control",
  location: "",
  description: "",
};

// ─── helpers ──────────────────────────────────────────────────────────────
const callFunction = async (name, data) => {
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const { app } = await import("../config/firebase");
  const functions = getFunctions(app);
  const fn = httpsCallable(functions, name);
  return await fn(data || {});
};

const todayStr = () => new Date().toISOString().split("T")[0];

const toJsDate = (value) => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  return new Date(value);
};

const formatDateTime = (value) => {
  const d = toJsDate(value);
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const timeAgo = (value) => {
  const d = toJsDate(value);
  if (!d || isNaN(d.getTime())) return "never";
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const initials = (name = "") =>
  name
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const eventTypeDisplay = (type) => {
  const e = EVENT_TYPES[type];
  return e ? `${e.emoji} ${e.label}` : "✓ Access Granted";
};

const MethodBadge = ({ method }) => {
  let label = "Other";
  let cls = "bg-gray-500/20 text-gray-300 border border-gray-500/30";
  if (method === "hikvision-openapi") {
    label = "HikCentral";
    cls = "bg-blue-500/20 text-blue-400 border border-blue-500/30";
  } else if (method === "cloud-vision-multi-photo" || method === "cloud-vision") {
    label = "AI Vision";
    cls = "bg-purple-500/20 text-purple-400 border border-purple-500/30";
  } else if (method === "manual") {
    label = "Manual";
  }
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

const statusDotClass = (status) =>
  status === "online"
    ? "bg-green-500"
    : status === "offline"
    ? "bg-red-500"
    : "bg-yellow-500";

// ─── Main component ─────────────────────────────────────────────────────────
const DeviceManagement = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const gymId = user?.gymId;

  const [activeTab, setActiveTab] = useState(location.state?.tab || "overview");

  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [todayCount, setTodayCount] = useState(0);
  const [hikConfig, setHikConfig] = useState({
    host: "",
    appKey: "",
    autoSync: false,
    whatsappOnCheckin: false,
    webhookRegistered: false,
    connectionStatus: "unknown",
  });

  // Modals
  const [deviceModal, setDeviceModal] = useState(null); // { mode: "add"|"edit", device }
  const [configDevice, setConfigDevice] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [subsModal, setSubsModal] = useState(null);

  // ── Real-time devices ──
  useEffect(() => {
    if (!gymId) return;
    let unsub;
    (async () => {
      const { db } = await import("../config/firebase");
      const { collection, query, onSnapshot } = await import("firebase/firestore");
      unsub = onSnapshot(
        query(collection(db, "gyms", gymId, "devices")),
        (snap) => {
          setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setDevicesLoading(false);
        },
        (err) => {
          console.error(err);
          setDevicesLoading(false);
        }
      );
    })();
    return () => unsub && unsub();
  }, [gymId]);

  // ── Real-time recent activity + today count ──
  useEffect(() => {
    if (!gymId) return;
    let unsubRecent, unsubToday;
    (async () => {
      const { db } = await import("../config/firebase");
      const { collection, query, where, orderBy, limit, onSnapshot } =
        await import("firebase/firestore");

      unsubRecent = onSnapshot(
        query(
          collection(db, "attendance"),
          where("gymId", "==", gymId),
          orderBy("checkInTime", "desc"),
          limit(10)
        ),
        (snap) => setRecentActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error(err)
      );

      unsubToday = onSnapshot(
        query(
          collection(db, "attendance"),
          where("gymId", "==", gymId),
          where("date", "==", todayStr())
        ),
        (snap) => setTodayCount(snap.size),
        (err) => console.error(err)
      );
    })();
    return () => {
      unsubRecent && unsubRecent();
      unsubToday && unsubToday();
    };
  }, [gymId]);

  // ── Load gym config ──
  const loadConfig = async () => {
    const { db } = await import("../config/firebase");
    const { doc, getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "gyms", gymId));
    const cfg = snap.exists() ? snap.data().hikCentralConfig || {} : {};
    setHikConfig({
      host: cfg.host || "",
      appKey: cfg.appKey || "",
      autoSync: cfg.autoSync || false,
      whatsappOnCheckin: cfg.whatsappOnCheckin || false,
      webhookRegistered: cfg.webhookRegistered || false,
      connectionStatus: cfg.connectionStatus || "unknown",
    });
  };

  useEffect(() => {
    if (gymId) loadConfig().catch((e) => showError("Failed to load config: " + e.message));
  }, [gymId]);

  const saveConfig = async (patch) => {
    const { db } = await import("../config/firebase");
    const { doc, setDoc } = await import("firebase/firestore");
    await setDoc(doc(db, "gyms", gymId), { hikCentralConfig: patch }, { merge: true });
    setHikConfig((c) => ({ ...c, ...patch }));
  };

  // ── Shared actions ──
  const handleTestConnection = async () => {
    try {
      const result = await callFunction("hikTestConnection");
      const data = result?.data || {};
      const ok = data.success ?? false;
      const { serverTimestamp } = await import("firebase/firestore");
      await saveConfig({
        connectionStatus: ok ? "connected" : "disconnected",
        lastConnectionTest: serverTimestamp(),
      });
      if (ok) {
        const version = data.result?.version || data.version;
        showSuccess(`✅ Connected${version ? ` - HikCentral Version ${version}` : ""}`);
      } else {
        showError("❌ Failed - " + (data.error || "Unknown error"));
      }
      return ok;
    } catch (err) {
      await saveConfig({ connectionStatus: "disconnected" }).catch(() => {});
      showError("❌ Failed - " + err.message);
      return false;
    }
  };

  const handleSyncDevices = async () => {
    try {
      const result = await callFunction("hikGetDeviceList", { gymId });
      const list = result?.data?.list || result?.data?.devices || result?.data || [];
      if (!Array.isArray(list) || list.length === 0) {
        showError("No devices returned from HikCentral");
        return;
      }
      const { db } = await import("../config/firebase");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      let count = 0;
      for (const dev of list) {
        const serialNo =
          dev.serialNo || dev.serialNumber || dev.devIndex ||
          dev.acsDevIndexCode || dev.devIndexCode;
        if (!serialNo) continue;
        await setDoc(
          doc(db, "gyms", gymId, "devices", String(serialNo)),
          {
            gymId,
            name: dev.name || dev.devName || dev.acsDevName || "Unnamed Device",
            serialNo: String(serialNo),
            doorIndexCode: dev.doorIndexCode || dev.doorNo || "",
            ip: dev.ip || dev.ipAddress || dev.devIp || "",
            type: "access_control",
            status: "online",
            lastSynced: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        count++;
      }
      showSuccess(`Synced ${count} device${count === 1 ? "" : "s"} from HikCentral`);
    } catch (err) {
      showError("Device sync failed: " + err.message);
    }
  };

  const handleRegisterWebhook = async () => {
    try {
      const result = await callFunction("hikSubscribeEvents", {
        gymId,
        eventDest: WEBHOOK_URL,
        eventTypes: SUBSCRIBE_EVENT_TYPES,
      });
      const ok = result?.data?.success ?? true;
      if (ok) {
        await saveConfig({ webhookRegistered: true });
        showSuccess("Webhook registered with HikCentral");
      } else {
        showError("Failed: " + (result?.data?.error || "Unknown error"));
      }
    } catch (err) {
      showError("Webhook registration failed: " + err.message);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "devices", label: "Devices", icon: Server },
    { id: "log", label: "Access Log", icon: ScrollText },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Device Management</h1>
          <p className="text-sm text-gray-400">
            Manage HikCentral access control devices
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700 flex gap-1 overflow-x-auto mb-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-blue-500 text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && (
          <OverviewTab
            devices={devices}
            todayCount={todayCount}
            recentActivity={recentActivity}
            connectionStatus={hikConfig.connectionStatus}
            onSync={handleSyncDevices}
            onTest={handleTestConnection}
            onRegisterWebhook={handleRegisterWebhook}
          />
        )}

        {activeTab === "devices" && (
          <DevicesTab
            gymId={gymId}
            devices={devices}
            loading={devicesLoading}
            onSync={handleSyncDevices}
            onAdd={(prefill) =>
              setDeviceModal({ mode: "add", device: { ...emptyDeviceForm, ...(prefill || {}) } })
            }
            onEdit={(device) => setDeviceModal({ mode: "edit", device })}
            onConfig={(device) => setConfigDevice(device)}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {activeTab === "log" && (
          <AccessLogTab
            gymId={gymId}
            onLightbox={setLightbox}
            showError={showError}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            gymId={gymId}
            config={hikConfig}
            saveConfig={saveConfig}
            onTest={handleTestConnection}
            onRegisterWebhook={handleRegisterWebhook}
            onViewSubs={async () => {
              try {
                const result = await callFunction("hikViewSubscriptions", { gymId });
                setSubsModal(result?.data ?? {});
              } catch (err) {
                showError("Failed to load subscriptions: " + err.message);
              }
            }}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
      </div>

      {deviceModal && (
        <DeviceFormModal
          gymId={gymId}
          mode={deviceModal.mode}
          initial={deviceModal.device}
          onClose={() => setDeviceModal(null)}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {configDevice && (
        <DeviceConfigModal
          gymId={gymId}
          device={configDevice}
          host={hikConfig.host}
          onClose={() => setConfigDevice(null)}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="capture"
            className="max-h-[90vh] max-w-[90vw] rounded-xl border border-gray-700"
          />
        </div>
      )}

      {subsModal !== null && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Subscriptions</h2>
              <button onClick={() => setSubsModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="p-6 overflow-auto text-sm text-gray-300 whitespace-pre-wrap break-words bg-gray-900 m-4 rounded-lg">
              {JSON.stringify(subsModal, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

// ─── Overview Tab ──────────────────────────────────────────────────────────
const OverviewTab = ({
  devices,
  todayCount,
  recentActivity,
  connectionStatus,
  onSync,
  onTest,
  onRegisterWebhook,
}) => {
  const [busy, setBusy] = useState(null);
  const online = devices.filter((d) => d.status === "online").length;

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const cards = [
    { label: "Total Devices", value: devices.length, icon: Monitor, color: "text-white" },
    { label: "Online Devices", value: online, icon: Wifi, color: "text-green-400" },
    { label: "Today Check-ins", value: todayCount, icon: Users, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{c.label}</p>
                <Icon className="w-5 h-5 text-gray-500" />
              </div>
              <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          );
        })}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">HikCentral</p>
            {connectionStatus === "connected" ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
          </div>
          <p
            className={`text-xl font-bold mt-1 flex items-center gap-2 ${
              connectionStatus === "connected" ? "text-green-400" : "text-red-400"
            }`}
          >
            {connectionStatus === "connected" ? (
              <>● Connected</>
            ) : connectionStatus === "disconnected" ? (
              <>✗ Error</>
            ) : (
              <span className="text-gray-400">Unknown</span>
            )}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => run("sync", onSync)}
          disabled={busy === "sync"}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition"
        >
          <RefreshCw className={`w-4 h-4 ${busy === "sync" ? "animate-spin" : ""}`} />
          Sync from HikCentral
        </button>
        <button
          onClick={() => run("test", onTest)}
          disabled={busy === "test"}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition"
        >
          <Wifi className="w-4 h-4" />
          {busy === "test" ? "Testing…" : "Test Connection"}
        </button>
        <button
          onClick={() => run("webhook", onRegisterWebhook)}
          disabled={busy === "webhook"}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition"
        >
          <ExternalLink className="w-4 h-4" />
          {busy === "webhook" ? "Registering…" : "Register Webhook"}
        </button>
      </div>

      {/* Recent activity */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">Recent Activity</h2>
        </div>
        {recentActivity.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">No recent access records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Door</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((row) => (
                  <tr key={row.id} className="border-b border-gray-700/50 last:border-0">
                    <td className="px-5 py-3 text-white">{row.memberName || "—"}</td>
                    <td className="px-5 py-3 text-gray-300">{row.doorName || "—"}</td>
                    <td className="px-5 py-3 text-gray-300">{formatDateTime(row.checkInTime)}</td>
                    <td className="px-5 py-3"><MethodBadge method={row.recognitionMethod} /></td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                        Present
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Devices Tab ─────────────────────────────────────────────────────────────
const DevicesTab = ({
  gymId,
  devices,
  loading,
  onSync,
  onAdd,
  onEdit,
  onConfig,
  showSuccess,
  showError,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [hikOpen, setHikOpen] = useState(false);
  const [hikList, setHikList] = useState([]);
  const [hikLoading, setHikLoading] = useState(false);

  const doSync = async () => {
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

  const setDeviceStatus = async (device, status) => {
    const { db } = await import("../config/firebase");
    const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
    await updateDoc(doc(db, "gyms", gymId, "devices", device.id), {
      status,
      lastHeartbeat: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleTest = async (device) => {
    setBusyId(device.id + ":test");
    try {
      const result = await callFunction("hikTestConnection");
      const ok = result?.data?.success ?? false;
      await setDeviceStatus(device, ok ? "online" : "offline");
      ok ? showSuccess(`${device.name} is online`) : showError(`${device.name} is offline`);
    } catch (err) {
      await setDeviceStatus(device, "offline").catch(() => {});
      showError("Test failed: " + err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDoor = async (device, controlType) => {
    setBusyId(device.id + ":door" + controlType);
    try {
      await callFunction("hikControlDoor", {
        gymId,
        doorIndexCode: device.doorIndexCode,
        controlType,
      });
      showSuccess(`Door ${controlType === 1 ? "opened" : "closed"}: ${device.name}`);
    } catch (err) {
      showError("Door control failed: " + err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (device) => {
    if (!window.confirm(`Delete device "${device.name}"? This cannot be undone.`)) return;
    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "gyms", gymId, "devices", device.id));
      showSuccess("Device deleted");
    } catch (err) {
      showError("Delete failed: " + err.message);
    }
  };

  const fetchHikList = async () => {
    setHikLoading(true);
    try {
      const result = await callFunction("hikGetDeviceList", { gymId });
      const list = result?.data?.list || result?.data?.devices || result?.data || [];
      const existingSerials = new Set(devices.map((d) => String(d.serialNo)));
      const normalized = (Array.isArray(list) ? list : [])
        .map((dev) => ({
          name: dev.name || dev.devName || dev.acsDevName || "Unnamed Device",
          serialNo: String(
            dev.serialNo || dev.serialNumber || dev.devIndex ||
            dev.acsDevIndexCode || dev.devIndexCode || ""
          ),
          doorIndexCode: dev.doorIndexCode || dev.doorNo || "",
          ip: dev.ip || dev.ipAddress || dev.devIp || "",
          status: dev.online || dev.status || "unknown",
        }))
        .filter((d) => d.serialNo && !existingSerials.has(d.serialNo));
      setHikList(normalized);
      if (normalized.length === 0) showSuccess("No new devices found in HikCentral");
    } catch (err) {
      showError("Failed to fetch from HikCentral: " + err.message);
    } finally {
      setHikLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section A header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Devices ({devices.length})</h2>
        <div className="flex gap-2">
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" /> Add Device
          </button>
          <button
            onClick={doSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sync from HikCentral
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-800 rounded-xl border border-gray-700">
          <Server className="w-14 h-14 text-gray-600 mb-4" />
          <p className="text-gray-300 font-medium">No devices added yet.</p>
          <p className="text-gray-500 text-sm mt-1">Add a device manually or sync from HikCentral.</p>
          <div className="flex gap-2 mt-4">
            <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
              <Plus className="w-4 h-4" /> Add Device
            </button>
            <button onClick={doSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sync from HikCentral
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {devices.map((device) => (
            <div key={device.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotClass(device.status)}`} />
                  <h3 className="text-white font-semibold truncate">{device.name || "Unnamed Device"}</h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onConfig(device)} title="Configure" className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => onEdit(device)} title="Edit" className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(device)} title="Delete" className="p-1.5 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <Row label="Type" value={DEVICE_TYPES.find((t) => t.value === device.type)?.label || device.type || "—"} />
                <Row label="Location" value={device.location || "—"} />
                <Row label="Device ID" value={device.deviceId || "—"} mono />
                <Row label="Door Code" value={device.doorIndexCode || "—"} mono />
                <Row label="IP" value={device.ip || "—"} mono />
                <Row label="Last seen" value={timeAgo(device.lastHeartbeat || device.lastSynced)} />
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-700">
                <button
                  onClick={() => handleTest(device)}
                  disabled={busyId === device.id + ":test"}
                  className="flex-1 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {busyId === device.id + ":test" ? "Testing…" : "Test"}
                </button>
                <button
                  onClick={() => handleDoor(device, 1)}
                  disabled={busyId === device.id + ":door1"}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Unlock className="w-3.5 h-3.5" /> Open
                </button>
                <button
                  onClick={() => handleDoor(device, 0)}
                  disabled={busyId === device.id + ":door0"}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Lock className="w-3.5 h-3.5" /> Close
                </button>
                <button
                  onClick={() => onConfig(device)}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
                >
                  Config
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section B: HikCentral live list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <button
          onClick={() => setHikOpen((o) => !o)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <span className="text-white font-medium">Devices in HikCentral (not yet added)</span>
          {hikOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </button>
        {hikOpen && (
          <div className="px-5 pb-5 border-t border-gray-700 pt-4">
            <button
              onClick={fetchHikList}
              disabled={hikLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition mb-4"
            >
              <RefreshCw className={`w-4 h-4 ${hikLoading ? "animate-spin" : ""}`} /> Fetch from HikCentral
            </button>
            {hikList.length === 0 ? (
              <p className="text-gray-400 text-sm">No un-added devices. Click "Fetch from HikCentral".</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-left border-b border-gray-700">
                      <th className="px-3 py-2 font-medium">Device Name</th>
                      <th className="px-3 py-2 font-medium">Serial No</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {hikList.map((dev) => (
                      <tr key={dev.serialNo} className="border-b border-gray-700/50 last:border-0">
                        <td className="px-3 py-2 text-white">{dev.name}</td>
                        <td className="px-3 py-2 text-gray-300 font-mono text-xs">{dev.serialNo}</td>
                        <td className="px-3 py-2 text-gray-300">{dev.status}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() =>
                              onAdd({
                                name: dev.name,
                                serialNo: dev.serialNo,
                                doorIndexCode: dev.doorIndexCode,
                                ip: dev.ip,
                              })
                            }
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
                          >
                            Add to Gym
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Row = ({ label, value, mono }) => (
  <div className="flex gap-2">
    <span className="text-gray-500 w-24 flex-shrink-0">{label}</span>
    <span className={`text-gray-300 truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
  </div>
);

// ─── Device Form Modal (Add / Edit) ─────────────────────────────────────────
const DeviceFormModal = ({ gymId, mode, initial, onClose, showSuccess, showError }) => {
  const [form, setForm] = useState({ ...emptyDeviceForm, ...initial });
  const [saving, setSaving] = useState(false);
  const isEdit = mode === "edit" && initial?.id;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.deviceId || !form.location) {
      showError("Name, Device ID and Location are required");
      return;
    }
    setSaving(true);
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      const payload = {
        gymId,
        name: form.name,
        deviceId: form.deviceId,
        doorIndexCode: form.doorIndexCode,
        serialNo: form.serialNo,
        ip: form.ip,
        type: form.type,
        location: form.location,
        description: form.description,
        updatedAt: serverTimestamp(),
      };
      if (isEdit) {
        await updateDoc(doc(db, "gyms", gymId, "devices", initial.id), payload);
        showSuccess("Device updated successfully");
      } else {
        await addDoc(collection(db, "gyms", gymId, "devices"), {
          ...payload,
          status: "unknown",
          createdAt: serverTimestamp(),
        });
        showSuccess("Device added successfully");
      }
      onClose();
    } catch (err) {
      showError("Failed to save device: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">{isEdit ? "Edit Device" : "Add Device"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Device Name *">
            <input value={form.name} onChange={set("name")} placeholder="Main Entrance" className={inputCls} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Device ID *">
              <input value={form.deviceId} onChange={set("deviceId")} placeholder="gymdoor1" className={inputCls} required />
            </Field>
            <Field label="Door Index Code">
              <input value={form.doorIndexCode} onChange={set("doorIndexCode")} className={inputCls} />
            </Field>
            <Field label="Serial Number">
              <input value={form.serialNo} onChange={set("serialNo")} className={inputCls} />
            </Field>
            <Field label="IP Address">
              <input value={form.ip} onChange={set("ip")} placeholder="192.168.1.100" className={inputCls} />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={set("type")} className={inputCls}>
                {DEVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Location *">
              <input value={form.location} onChange={set("location")} placeholder="Front Door" className={inputCls} required />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={form.description} onChange={set("description")} rows={3} className={inputCls} />
          </Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition">
              {saving ? "Saving…" : isEdit ? "Update" : "Add Device"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const inputCls =
  "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm";

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm text-gray-400 mb-1">{label}</label>
    {children}
  </div>
);

// ─── Device Config Modal ─────────────────────────────────────────────────────
const DeviceConfigModal = ({ gymId, device, host, onClose, showSuccess, showError }) => {
  const [tab, setTab] = useState("door");
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState(10);
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const controlDoor = async (controlType, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await callFunction("hikControlDoor", {
        gymId,
        doorIndexCode: device.doorIndexCode,
        controlType,
      });
      showSuccess("Door command sent");
    } catch (err) {
      showError("Door control failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const unlockForDuration = async () => {
    setBusy(true);
    try {
      await callFunction("hikControlDoor", { gymId, doorIndexCode: device.doorIndexCode, controlType: 1 });
      showSuccess(`Door open for ${duration}s`);
      setTimeout(async () => {
        try {
          await callFunction("hikControlDoor", { gymId, doorIndexCode: device.doorIndexCode, controlType: 0 });
          showSuccess("Door auto-closed");
        } catch (err) {
          showError("Auto-close failed: " + err.message);
        }
      }, duration * 1000);
    } catch (err) {
      showError("Unlock failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const loadMembers = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const snap = await getDocs(
        query(collection(db, "members"), where("gymId", "==", gymId), where("useHikCentral", "==", true))
      );
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMembersLoaded(true);
    } catch (err) {
      showError("Failed to load members: " + err.message);
    }
  };

  useEffect(() => {
    if (tab === "schedule" && !membersLoaded) loadMembers();
  }, [tab]);

  const syncMember = async (member) => {
    try {
      await callFunction("hikAddPerson", {
        gymId,
        personCode: member.id,
        personName: member.name,
        gender: member.gender || "male",
        phoneNo: member.mobile || member.phone || "",
        email: member.email || "",
      });
      const { db } = await import("../config/firebase");
      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      await updateDoc(doc(db, "members", member.id), {
        useHikCentral: true, hikCentralSynced: true, hikCentralSyncedAt: serverTimestamp(),
      });
      showSuccess(`${member.name} synced`);
      loadMembers();
    } catch (err) {
      showError("Sync failed: " + err.message);
    }
  };

  const updateStatus = async () => {
    setBusy(true);
    try {
      const result = await callFunction("hikTestConnection");
      const ok = result?.data?.success ?? false;
      const { db } = await import("../config/firebase");
      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      await updateDoc(doc(db, "gyms", gymId, "devices", device.id), {
        status: ok ? "online" : "offline", lastHeartbeat: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      showSuccess("Status updated: " + (ok ? "online" : "offline"));
    } catch (err) {
      showError("Update failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeFromSync = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "gyms", gymId, "devices", device.id), { useHikCentral: false });
      showSuccess("Removed from HikCentral sync");
    } catch (err) {
      showError("Update failed: " + err.message);
    }
  };

  const deleteDevice = async () => {
    if (!window.confirm(`Delete device "${device.name}"? This cannot be undone.`)) return;
    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "gyms", gymId, "devices", device.id));
      showSuccess("Device deleted");
      onClose();
    } catch (err) {
      showError("Delete failed: " + err.message);
    }
  };

  const configTabs = [
    { id: "door", label: "Door Control" },
    { id: "schedule", label: "Access Schedule" },
    { id: "advanced", label: "Advanced" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Configure {device.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 border-b border-gray-700 flex gap-1">
          {configTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                tab === t.id ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "door" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusDotClass(device.status)}`} />
                <span className="text-gray-300 text-sm">Current status: <span className="capitalize text-white">{device.status || "unknown"}</span></span>
              </div>
              <div>
                <p className="text-white font-medium mb-3">Manual Door Control</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button onClick={() => controlDoor(1)} disabled={busy} className="px-3 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex flex-col items-center gap-1">
                    <Unlock className="w-5 h-5" /> Open
                  </button>
                  <button onClick={() => controlDoor(0)} disabled={busy} className="px-3 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex flex-col items-center gap-1">
                    <Lock className="w-5 h-5" /> Close
                  </button>
                  <button onClick={() => controlDoor(2, "Set door to ALWAYS OPEN? It will stay unlocked until changed.")} disabled={busy} className="px-3 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 text-yellow-400 disabled:opacity-50 rounded-lg text-sm font-medium transition flex flex-col items-center gap-1">
                    <DoorOpen className="w-5 h-5" /> Always Open
                  </button>
                  <button onClick={() => controlDoor(3, "Set door to ALWAYS CLOSE? It will stay locked until changed.")} disabled={busy} className="px-3 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 disabled:opacity-50 rounded-lg text-sm font-medium transition flex flex-col items-center gap-1">
                    <DoorClosed className="w-5 h-5" /> Always Close
                  </button>
                </div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <p className="text-white font-medium mb-3">Remote Unlock</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Duration (seconds)</label>
                    <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls + " w-32"}>
                      {[5, 10, 30, 60].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <button onClick={unlockForDuration} disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                    Unlock for duration
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "schedule" && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Access schedules are managed in HikCentral Professional. Open HikCentral Web Client to configure time-based access rules.
              </p>
              {host && (
                <a href={host} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm">
                  {host} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <div className="border-t border-gray-700 pt-4">
                <p className="text-white font-medium mb-2">HikCentral-enrolled Members</p>
                {!membersLoaded ? (
                  <p className="text-gray-400 text-sm">Loading…</p>
                ) : members.length === 0 ? (
                  <p className="text-gray-400 text-sm">No members enrolled in HikCentral.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 text-left border-b border-gray-700">
                          <th className="px-3 py-2 font-medium">Member</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">User ID</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.id} className="border-b border-gray-700/50 last:border-0">
                            <td className="px-3 py-2 text-white">{m.name}</td>
                            <td className="px-3 py-2">
                              {m.hikCentralSynced ? (
                                <span className="text-green-400 text-xs">Synced</span>
                              ) : (
                                <span className="text-yellow-400 text-xs">Pending</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-300 font-mono text-xs">{m.hikvisionUserId || "—"}</td>
                            <td className="px-3 py-2 text-right">
                              {!m.hikCentralSynced && (
                                <button onClick={() => syncMember(m)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition">Sync</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "advanced" && (
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 space-y-1 text-sm">
                {["name", "deviceId", "serialNo", "doorIndexCode", "ip", "type", "location", "status"].map((k) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-gray-500 w-28 flex-shrink-0">{k}</span>
                    <span className="text-gray-300 break-all">{String(device[k] ?? "—")}</span>
                  </div>
                ))}
              </div>
              <button onClick={updateStatus} disabled={busy} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                {busy ? "Updating…" : "Update Status"}
              </button>
              <div className="flex items-center justify-between border-t border-gray-700 pt-4">
                <span className="text-sm text-gray-300">Remove from HikCentral sync</span>
                <button onClick={removeFromSync} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition">Remove</button>
              </div>
              <div className="border border-red-600/40 rounded-lg p-4">
                <p className="text-red-400 font-medium text-sm mb-2">Danger Zone</p>
                <button onClick={deleteDevice} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Delete Device
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Access Log Tab ──────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

const AccessLogTab = ({ gymId, onLightbox, showError }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(todayStr());
  const [memberSearch, setMemberSearch] = useState("");
  const [doorFilter, setDoorFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  useEffect(() => {
    if (!gymId) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { db } = await import("../config/firebase");
        const { collection, query, where, orderBy, limit, getDocs } = await import("firebase/firestore");
        const snap = await getDocs(
          query(
            collection(db, "attendance"),
            where("gymId", "==", gymId),
            orderBy("checkInTime", "desc"),
            limit(200)
          )
        );
        if (active) setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        showError("Failed to load access log: " + err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [gymId]);

  const doorNames = [...new Set(rows.map((r) => r.doorName).filter(Boolean))];

  const matchesMethod = (m) => {
    if (methodFilter === "all") return true;
    if (methodFilter === "hikcentral") return m === "hikvision-openapi";
    if (methodFilter === "ai") return m === "cloud-vision-multi-photo" || m === "cloud-vision";
    if (methodFilter === "manual") return m === "manual";
    return true;
  };

  const filtered = rows.filter((r) => {
    const d = toJsDate(r.checkInTime);
    if (d) {
      const ds = d.toISOString().split("T")[0];
      if (dateFrom && ds < dateFrom) return false;
      if (dateTo && ds > dateTo) return false;
    }
    if (memberSearch && !(r.memberName || "").toLowerCase().includes(memberSearch.toLowerCase())) return false;
    if (doorFilter && r.doorName !== doorFilter) return false;
    if (!matchesMethod(r.recognitionMethod)) return false;
    return true;
  });

  useEffect(() => setPage(1), [dateFrom, dateTo, memberSearch, doorFilter, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    if (filtered.length === 0) { showError("Nothing to export"); return; }
    const headers = ["Member Name", "Door", "Date", "Time", "Method", "Event Type", "Status"];
    const lines = filtered.map((r) => {
      const d = toJsDate(r.checkInTime);
      return [
        r.memberName || "",
        r.doorName || "",
        d ? d.toLocaleDateString("en-US") : "",
        d ? d.toLocaleTimeString("en-US") : "",
        r.recognitionMethod || "manual",
        EVENT_TYPES[r.eventType]?.label || "Access Granted",
        "Present",
      ];
    });
    const csv = [headers, ...lines]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `access-log-${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-gray-400 mb-1">Member</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search name" className={inputCls + " pl-9"} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Door</label>
          <select value={doorFilter} onChange={(e) => setDoorFilter(e.target.value)} className={inputCls}>
            <option value="">All doors</option>
            {doorNames.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Method</label>
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className={inputCls}>
            <option value="all">All</option>
            <option value="hikcentral">HikCentral</option>
            <option value="ai">AI Vision</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">No access records found for the selected filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="px-5 py-3 font-medium">Member</th>
                    <th className="px-5 py-3 font-medium">Door Name</th>
                    <th className="px-5 py-3 font-medium">Date/Time</th>
                    <th className="px-5 py-3 font-medium">Method</th>
                    <th className="px-5 py-3 font-medium">Event Type</th>
                    <th className="px-5 py-3 font-medium">Photo</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-700/50 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {initials(row.memberName)}
                          </div>
                          <span className="text-white">{row.memberName || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-300">{row.doorName || "—"}</td>
                      <td className="px-5 py-3 text-gray-300">{formatDateTime(row.checkInTime)}</td>
                      <td className="px-5 py-3"><MethodBadge method={row.recognitionMethod} /></td>
                      <td className="px-5 py-3 text-gray-300">{eventTypeDisplay(row.eventType)}</td>
                      <td className="px-5 py-3">
                        {row.picUri ? (
                          <img src={row.picUri} alt="capture" onClick={() => onLightbox(row.picUri)} className="w-8 h-8 rounded object-cover cursor-pointer hover:ring-2 hover:ring-blue-500" />
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Present</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700">
              <span className="text-sm text-gray-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm transition">Prev</button>
                <span className="px-3 py-1.5 text-gray-300 text-sm">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm transition">Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Settings Tab ────────────────────────────────────────────────────────────
const SettingsTab = ({ gymId, config, saveConfig, onTest, onRegisterWebhook, onViewSubs, showSuccess, showError }) => {
  const [host, setHost] = useState(config.host);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState(null);

  useEffect(() => setHost(config.host), [config.host]);

  const maskedKey = config.appKey
    ? config.appKey.slice(0, 3) + "x".repeat(Math.max(0, config.appKey.length - 3))
    : "Not configured";

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  };

  const saveHost = async () => {
    setSaving(true);
    try {
      await saveConfig({ host });
      showSuccess("Configuration saved");
    } catch (err) {
      showError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const bulkSync = async (resyncAll) => {
    if (resyncAll && !window.confirm("This will re-sync ALL members with HikCentral. Continue?")) return;
    setBusy(resyncAll ? "resync" : "sync");
    setProgress({ done: 0, total: 0, failed: 0 });
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      const clauses = [where("gymId", "==", gymId), where("useHikCentral", "==", true)];
      if (!resyncAll) clauses.push(where("hikCentralSynced", "==", false));
      const snap = await getDocs(query(collection(db, "members"), ...clauses));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      let done = 0, failed = 0;
      setProgress({ done, total: list.length, failed });
      for (const m of list) {
        try {
          await callFunction("hikAddPerson", {
            gymId,
            personCode: m.id,
            personName: m.name,
            gender: m.gender || "male",
            phoneNo: m.mobile || m.phone || "",
            email: m.email || "",
          });
          await updateDoc(doc(db, "members", m.id), {
            useHikCentral: true, hikCentralSynced: true, hikCentralSyncedAt: serverTimestamp(),
          });
        } catch {
          failed++;
        }
        done++;
        setProgress({ done, total: list.length, failed });
      }
      showSuccess(`✅ ${done - failed} members synced, ❌ ${failed} failed`);
    } catch (err) {
      showError("Bulk sync failed: " + err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Section 1 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <h2 className="text-white font-semibold text-lg">HikCentral Connection</h2>
        <Field label="HikCentral Host URL">
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="https://136.116.31.22" className={inputCls + " font-mono"} />
          <p className="text-xs text-gray-500 mt-1">Include port if needed. Default: https://IP:443</p>
        </Field>
        <Field label="App Key">
          <input value={maskedKey} readOnly className={inputCls + " bg-gray-900 text-gray-400 cursor-not-allowed font-mono"} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            config.connectionStatus === "connected"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : config.connectionStatus === "disconnected"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-gray-500/20 text-gray-300 border border-gray-500/30"
          }`}>
            {config.connectionStatus === "connected" ? "Connected" : config.connectionStatus === "disconnected" ? "Disconnected" : "Unknown"}
          </span>
          <button onClick={() => run("test", onTest)} disabled={busy === "test"} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-medium transition">
            {busy === "test" ? "Testing…" : "Test Connection"}
          </button>
          <button onClick={saveHost} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition">
            {saving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      </div>

      {/* Section 2 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <h2 className="text-white font-semibold text-lg">Webhook / Event Subscription</h2>
        <Field label="Webhook URL">
          <div className="flex gap-2">
            <input value={WEBHOOK_URL} readOnly className={inputCls + " bg-gray-900 text-gray-300 font-mono text-xs cursor-not-allowed"} />
            <button onClick={() => { navigator.clipboard?.writeText(WEBHOOK_URL); showSuccess("Copied"); }} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </Field>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Status:</span>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            config.webhookRegistered ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
          }`}>
            {config.webhookRegistered ? "Registered" : "Not Registered"}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => run("webhook", onRegisterWebhook)} disabled={busy === "webhook"} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition">
            {busy === "webhook" ? "Registering…" : "Register Webhook with HikCentral"}
          </button>
          <button onClick={() => run("subs", onViewSubs)} disabled={busy === "subs"} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-medium transition">
            {busy === "subs" ? "Loading…" : "View Subscriptions"}
          </button>
        </div>
      </div>

      {/* Section 3 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
        <h2 className="text-white font-semibold text-lg">Auto-Sync Settings</h2>
        <ToggleRow
          label="Auto-sync new members to HikCentral"
          desc="When enabled, new members added to this gym will automatically be registered in HikCentral Professional for face recognition access."
          value={config.autoSync}
          onChange={async (v) => {
            try { await saveConfig({ autoSync: v }); showSuccess(`Auto-sync ${v ? "enabled" : "disabled"}`); }
            catch (err) { showError("Update failed: " + err.message); }
          }}
        />
        <ToggleRow
          label="Send WhatsApp on check-in"
          desc="Send a WhatsApp message to members when they check in."
          value={config.whatsappOnCheckin}
          onChange={async (v) => {
            try { await saveConfig({ whatsappOnCheckin: v }); showSuccess(`WhatsApp on check-in ${v ? "enabled" : "disabled"}`); }
            catch (err) { showError("Update failed: " + err.message); }
          }}
        />
      </div>

      {/* Section 4 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <h2 className="text-white font-semibold text-lg">Bulk Operations</h2>
        {progress && (
          <p className="text-sm text-blue-400">
            Syncing {progress.done}/{progress.total} members…{progress.failed ? ` (${progress.failed} failed)` : ""}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => bulkSync(false)} disabled={busy === "sync" || busy === "resync"} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition">
            {busy === "sync" ? "Syncing…" : "Sync All Unsynced Members"}
          </button>
          <button onClick={() => bulkSync(true)} disabled={busy === "sync" || busy === "resync"} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-medium transition">
            {busy === "resync" ? "Re-syncing…" : "Re-sync All Members"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ToggleRow = ({ label, desc, value, onChange }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <p className="text-white font-medium">{label}</p>
      <p className="text-sm text-gray-400 mt-0.5">{desc}</p>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${value ? "bg-green-600" : "bg-gray-600"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  </div>
);

export default DeviceManagement;
