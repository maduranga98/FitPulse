import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNotification } from "../contexts/NotificationContext";
import Sidebar from "../components/Sidebar";
import { isAdmin } from "../utils/authUtils";
import {
  LayoutDashboard,
  Server,
  ScrollText,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  DoorOpen,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Search,
  X,
  Menu,
} from "lucide-react";

const WEBHOOK_URL =
  "https://us-central1-gymnex-65440.cloudfunctions.net/hikCentralWebhook";

const EVENT_TYPE_LABELS = {
  196893: "Face Recognition",
  198914: "Card Tap",
  198915: "Card + PIN",
  196890: "Face + Card",
};

const SUBSCRIBE_EVENT_TYPES = [196893, 198914, 198915, 196890, 196896, 196883];

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

const eventTypeLabel = (type) =>
  EVENT_TYPE_LABELS[type] || "Access Granted";

const MethodBadge = ({ method }) => {
  let label = "Manual";
  let cls = "bg-gray-500/20 text-gray-300 border border-gray-500/30";
  if (method === "hikvision-openapi") {
    label = "HikCentral";
    cls = "bg-blue-500/20 text-blue-400 border border-blue-500/30";
  } else if (method === "cloud-vision-multi-photo" || method === "cloud-vision") {
    label = "AI Vision";
    cls = "bg-purple-500/20 text-purple-400 border border-purple-500/30";
  }
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

const StatusDot = ({ status }) => {
  const color =
    status === "online"
      ? "bg-green-500"
      : status === "offline"
      ? "bg-red-500"
      : "bg-yellow-500";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
};

const DeviceManagement = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const gymId = user?.gymId;
  const userIsAdmin = isAdmin(user);

  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Shared data
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);

  // Overview
  const [recentLog, setRecentLog] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [hikStatus, setHikStatus] = useState("checking"); // checking | connected | disconnected

  // Devices tab
  const [syncing, setSyncing] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [doorActionId, setDoorActionId] = useState(null);

  // Access log tab
  const [logRows, setLogRows] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(todayStr());
  const [memberSearch, setMemberSearch] = useState("");
  const [doorFilter, setDoorFilter] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Settings tab
  const [hikConfig, setHikConfig] = useState({ host: "", appKey: "", autoSync: false });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState(null);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [subsModal, setSubsModal] = useState(null);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => {
    if (!gymId) return;
    fetchDevices();
    fetchOverview();
    loadConfig();
  }, [gymId]);

  useEffect(() => {
    if (activeTab === "log" && gymId) fetchAccessLog();
  }, [activeTab, gymId]);

  // ---------- Data fetching ----------
  const fetchDevices = async () => {
    setDevicesLoading(true);
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, query } = await import("firebase/firestore");
      const snap = await getDocs(query(collection(db, "gyms", gymId, "devices")));
      setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      showError("Failed to load devices: " + err.message);
    } finally {
      setDevicesLoading(false);
    }
  };

  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, orderBy, limit, getDocs } = await import(
        "firebase/firestore"
      );

      // Recent access log (last 10)
      const recentSnap = await getDocs(
        query(
          collection(db, "attendance"),
          where("gymId", "==", gymId),
          orderBy("checkInTime", "desc"),
          limit(10)
        )
      );
      setRecentLog(recentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Today's check-ins
      const todaySnap = await getDocs(
        query(
          collection(db, "attendance"),
          where("gymId", "==", gymId),
          where("date", "==", todayStr())
        )
      );
      setTodayCount(todaySnap.size);
    } catch (err) {
      showError("Failed to load overview: " + err.message);
    } finally {
      setOverviewLoading(false);
    }

    // HikCentral status (independent of Firestore errors)
    try {
      const result = await callFunction("hikTestConnection");
      const ok = result?.data?.success ?? result?.data?.connected ?? false;
      setHikStatus(ok ? "connected" : "disconnected");
    } catch {
      setHikStatus("disconnected");
    }
  };

  const loadConfig = async () => {
    setSettingsLoading(true);
    try {
      const { db } = await import("../config/firebase");
      const { doc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(db, "gyms", gymId));
      const cfg = snap.exists() ? snap.data().hikCentralConfig || {} : {};
      setHikConfig({
        host: cfg.host || "",
        appKey: cfg.appKey || "",
        autoSync: cfg.autoSync || false,
      });
    } catch (err) {
      showError("Failed to load settings: " + err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchAccessLog = async () => {
    setLogLoading(true);
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, orderBy, limit, getDocs } = await import(
        "firebase/firestore"
      );
      const snap = await getDocs(
        query(
          collection(db, "attendance"),
          where("gymId", "==", gymId),
          orderBy("checkInTime", "desc"),
          limit(100)
        )
      );
      setLogRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      showError("Failed to load access log: " + err.message);
    } finally {
      setLogLoading(false);
    }
  };

  // ---------- Actions ----------
  const handleSyncDevices = async () => {
    setSyncing(true);
    try {
      const result = await callFunction("hikGetDeviceList");
      const list =
        result?.data?.devices || result?.data?.list || result?.data || [];
      if (!Array.isArray(list) || list.length === 0) {
        showError("No devices returned from HikCentral");
        return;
      }

      const { db } = await import("../config/firebase");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");

      let count = 0;
      for (const dev of list) {
        const serialNo = dev.serialNo || dev.serialNumber || dev.devIndex;
        if (!serialNo) continue;
        await setDoc(
          doc(db, "gyms", gymId, "devices", String(serialNo)),
          {
            name: dev.name || dev.devName || "Unnamed Device",
            serialNo: String(serialNo),
            doorIndexCode: dev.doorIndexCode || dev.doorNo || "",
            ip: dev.ip || dev.ipAddress || "",
            status: "online",
            gymId,
            lastSynced: serverTimestamp(),
          },
          { merge: true }
        );
        count++;
      }
      showSuccess(`Synced ${count} device${count === 1 ? "" : "s"} from HikCentral`);
      fetchDevices();
    } catch (err) {
      showError("Device sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleTestConnection = async (device) => {
    setTestingId(device.id);
    try {
      const result = await callFunction("hikTestConnection");
      const ok = result?.data?.success ?? result?.data?.connected ?? false;
      if (ok) {
        showSuccess(`Connection OK${device?.name ? ` for ${device.name}` : ""}`);
      } else {
        showError("Connection failed: " + (result?.data?.error || "Unknown error"));
      }
    } catch (err) {
      showError("Connection test failed: " + err.message);
    } finally {
      setTestingId(null);
    }
  };

  const handleControlDoor = async (device, controlType) => {
    if (!controlType) return;
    setDoorActionId(device.id);
    try {
      await callFunction("hikControlDoor", {
        gymId,
        doorIndexCode: device.doorIndexCode,
        controlType,
      });
      showSuccess(`Door command "${controlType}" sent to ${device.name}`);
    } catch (err) {
      showError("Door control failed: " + err.message);
    } finally {
      setDoorActionId(null);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const { db } = await import("../config/firebase");
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(
        doc(db, "gyms", gymId),
        {
          hikCentralConfig: {
            host: hikConfig.host,
            appKey: hikConfig.appKey,
            autoSync: hikConfig.autoSync,
          },
        },
        { merge: true }
      );
      showSuccess("HikCentral configuration saved");
    } catch (err) {
      showError("Failed to save configuration: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestConnSettings = async () => {
    setTestingConn(true);
    setConnResult(null);
    try {
      const result = await callFunction("hikTestConnection");
      const data = result?.data || {};
      const ok = data.success ?? data.connected ?? false;
      if (ok) {
        setConnResult({ ok: true, message: `Connected${data.version ? ` - Version ${data.version}` : ""}` });
      } else {
        setConnResult({ ok: false, message: data.error || "Connection failed" });
      }
    } catch (err) {
      setConnResult({ ok: false, message: err.message });
    } finally {
      setTestingConn(false);
    }
  };

  const handleToggleAutoSync = async () => {
    const next = !hikConfig.autoSync;
    setHikConfig((c) => ({ ...c, autoSync: next }));
    try {
      const { db } = await import("../config/firebase");
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(
        doc(db, "gyms", gymId),
        { hikCentralConfig: { autoSync: next } },
        { merge: true }
      );
      showSuccess(`Auto-sync ${next ? "enabled" : "disabled"}`);
    } catch (err) {
      setHikConfig((c) => ({ ...c, autoSync: !next }));
      showError("Failed to update auto-sync: " + err.message);
    }
  };

  const handleRegisterWebhook = async () => {
    setRegisteringWebhook(true);
    try {
      const result = await callFunction("hikSubscribeEvents", {
        gymId,
        eventDest: WEBHOOK_URL,
        eventTypes: SUBSCRIBE_EVENT_TYPES,
      });
      const ok = result?.data?.success ?? true;
      if (ok) {
        showSuccess("Webhook registered with HikCentral");
      } else {
        showError("Failed: " + (result?.data?.error || "Unknown error"));
      }
    } catch (err) {
      showError("Webhook registration failed: " + err.message);
    } finally {
      setRegisteringWebhook(false);
    }
  };

  const handleViewSubscriptions = async () => {
    setLoadingSubs(true);
    try {
      const result = await callFunction("hikViewSubscriptions");
      setSubsModal(result?.data ?? {});
    } catch (err) {
      showError("Failed to load subscriptions: " + err.message);
    } finally {
      setLoadingSubs(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    showSuccess("Copied to clipboard");
  };

  // ---------- Access log filtering + export ----------
  const filteredLog = logRows.filter((row) => {
    const d = toJsDate(row.checkInTime);
    if (d) {
      const ds = d.toISOString().split("T")[0];
      if (dateFrom && ds < dateFrom) return false;
      if (dateTo && ds > dateTo) return false;
    }
    if (
      memberSearch &&
      !(row.memberName || "").toLowerCase().includes(memberSearch.toLowerCase())
    )
      return false;
    if (
      doorFilter &&
      !(row.doorName || "").toLowerCase().includes(doorFilter.toLowerCase())
    )
      return false;
    return true;
  });

  const handleExportCsv = () => {
    if (filteredLog.length === 0) {
      showError("Nothing to export");
      return;
    }
    const headers = ["Member Name", "Door", "Check-in Time", "Method", "Event Type"];
    const rows = filteredLog.map((r) => [
      r.memberName || "",
      r.doorName || "",
      formatDateTime(r.checkInTime),
      r.recognitionMethod || "manual",
      eventTypeLabel(r.eventType),
    ]);
    const csv = [headers, ...rows]
      .map((line) =>
        line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-log-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onlineCount = devices.filter((d) => d.status === "online").length;

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "devices", label: "Devices", icon: Server },
    { id: "log", label: "Access Log", icon: ScrollText },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Device Management</h1>
            <p className="text-sm text-gray-400">
              HikCentral access control & attendance
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 flex gap-1 overflow-x-auto flex-shrink-0">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <OverviewTab
              loading={overviewLoading}
              totalDevices={devices.length}
              onlineCount={onlineCount}
              todayCount={todayCount}
              hikStatus={hikStatus}
              recentLog={recentLog}
            />
          )}

          {activeTab === "devices" && (
            <DevicesTab
              devices={devices}
              loading={devicesLoading}
              syncing={syncing}
              testingId={testingId}
              doorActionId={doorActionId}
              userIsAdmin={userIsAdmin}
              onSync={handleSyncDevices}
              onTest={handleTestConnection}
              onControlDoor={handleControlDoor}
            />
          )}

          {activeTab === "log" && (
            <AccessLogTab
              loading={logLoading}
              rows={filteredLog}
              dateFrom={dateFrom}
              dateTo={dateTo}
              memberSearch={memberSearch}
              doorFilter={doorFilter}
              setDateFrom={setDateFrom}
              setDateTo={setDateTo}
              setMemberSearch={setMemberSearch}
              setDoorFilter={setDoorFilter}
              onExport={handleExportCsv}
              onPreview={setPreviewPhoto}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTab
              loading={settingsLoading}
              config={hikConfig}
              setConfig={setHikConfig}
              saving={savingConfig}
              onSave={handleSaveConfig}
              testingConn={testingConn}
              connResult={connResult}
              onTestConn={handleTestConnSettings}
              registeringWebhook={registeringWebhook}
              onRegisterWebhook={handleRegisterWebhook}
              loadingSubs={loadingSubs}
              onViewSubs={handleViewSubscriptions}
              onToggleAutoSync={handleToggleAutoSync}
              onCopy={copyToClipboard}
            />
          )}
        </div>
      </div>

      {/* Photo preview modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <img
            src={previewPhoto}
            alt="Access capture"
            className="max-h-[90vh] max-w-[90vw] rounded-xl border border-gray-700"
          />
        </div>
      )}

      {/* Subscriptions modal */}
      {subsModal !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Current Subscriptions</h2>
              <button
                onClick={() => setSubsModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="p-6 overflow-auto text-sm text-gray-300 whitespace-pre-wrap break-words">
              {JSON.stringify(subsModal, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Overview Tab ----------
const OverviewTab = ({
  loading,
  totalDevices,
  onlineCount,
  todayCount,
  hikStatus,
  recentLog,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Devices", value: totalDevices, color: "text-white" },
    { label: "Online Devices", value: onlineCount, color: "text-green-400" },
    { label: "Today's Check-ins", value: todayCount, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <div key={c.label} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <p className="text-sm text-gray-400">{c.label}</p>
            <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-sm text-gray-400">HikCentral Status</p>
          {hikStatus === "checking" ? (
            <p className="text-2xl font-bold mt-1 text-gray-400">Checking…</p>
          ) : hikStatus === "connected" ? (
            <p className="text-2xl font-bold mt-1 text-green-400 flex items-center gap-2">
              <Wifi className="w-6 h-6" /> Connected
            </p>
          ) : (
            <p className="text-2xl font-bold mt-1 text-red-400 flex items-center gap-2">
              <WifiOff className="w-6 h-6" /> Disconnected
            </p>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">Recent Access Log</h2>
        </div>
        {recentLog.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">No recent access records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  <th className="px-5 py-3 font-medium">Member Name</th>
                  <th className="px-5 py-3 font-medium">Door</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLog.map((row) => (
                  <tr key={row.id} className="border-b border-gray-700/50 last:border-0">
                    <td className="px-5 py-3 text-white">{row.memberName || "—"}</td>
                    <td className="px-5 py-3 text-gray-300">{row.doorName || "—"}</td>
                    <td className="px-5 py-3 text-gray-300">{formatDateTime(row.checkInTime)}</td>
                    <td className="px-5 py-3">
                      <MethodBadge method={row.recognitionMethod} />
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                        Granted
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

// ---------- Devices Tab ----------
const DevicesTab = ({
  devices,
  loading,
  syncing,
  testingId,
  doorActionId,
  userIsAdmin,
  onSync,
  onTest,
  onControlDoor,
}) => {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {userIsAdmin && (
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Devices from HikCentral"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Server className="w-14 h-14 text-gray-600 mb-4" />
          <p className="text-gray-400">
            No devices synced yet. Click 'Sync Devices from HikCentral' to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div
              key={device.id}
              className="bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusDot status={device.status} />
                  <h3 className="text-white font-semibold leading-tight">
                    {device.name || "Unnamed Device"}
                  </h3>
                </div>
                <span className="text-xs text-gray-400 capitalize">
                  {device.status || "unknown"}
                </span>
              </div>

              <div className="space-y-1.5 text-sm">
                {device.ip && (
                  <div className="flex gap-2 text-gray-300">
                    <span className="text-gray-500 w-24 flex-shrink-0">IP</span>
                    <span className="font-mono">{device.ip}</span>
                  </div>
                )}
                {device.serialNo && (
                  <div className="flex gap-2 text-gray-300">
                    <span className="text-gray-500 w-24 flex-shrink-0">Serial</span>
                    <span className="font-mono break-all">{device.serialNo}</span>
                  </div>
                )}
                {(device.lastHeartbeat || device.lastSynced) && (
                  <div className="flex gap-2 text-gray-300">
                    <span className="text-gray-500 w-24 flex-shrink-0">Last seen</span>
                    <span>{formatDateTime(device.lastHeartbeat || device.lastSynced)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => onTest(device)}
                  disabled={testingId === device.id}
                  className="px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingId === device.id ? "Testing…" : "Test Connection"}
                </button>
                <div className="relative flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <select
                    defaultValue=""
                    disabled={doorActionId === device.id}
                    onChange={(e) => {
                      onControlDoor(device, e.target.value);
                      e.target.value = "";
                    }}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>
                      {doorActionId === device.id ? "Sending…" : "Control Door"}
                    </option>
                    <option value="open">Open</option>
                    <option value="close">Close</option>
                    <option value="alwaysOpen">Always Open</option>
                    <option value="alwaysClose">Always Close</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Access Log Tab ----------
const AccessLogTab = ({
  loading,
  rows,
  dateFrom,
  dateTo,
  memberSearch,
  doorFilter,
  setDateFrom,
  setDateTo,
  setMemberSearch,
  setDoorFilter,
  onExport,
  onPreview,
}) => {
  return (
    <div className="space-y-5">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-gray-400 mb-1">Member</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search member name"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-gray-400 mb-1">Door</label>
          <input
            type="text"
            value={doorFilter}
            onChange={(e) => setDoorFilter(e.target.value)}
            placeholder="Filter by door"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">No access records match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  <th className="px-5 py-3 font-medium">Member Name</th>
                  <th className="px-5 py-3 font-medium">Door Name</th>
                  <th className="px-5 py-3 font-medium">Check-in Time</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Event Type</th>
                  <th className="px-5 py-3 font-medium">Photo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-700/50 last:border-0">
                    <td className="px-5 py-3 text-white">{row.memberName || "—"}</td>
                    <td className="px-5 py-3 text-gray-300">{row.doorName || "—"}</td>
                    <td className="px-5 py-3 text-gray-300">{formatDateTime(row.checkInTime)}</td>
                    <td className="px-5 py-3">
                      <MethodBadge method={row.recognitionMethod} />
                    </td>
                    <td className="px-5 py-3 text-gray-300">{eventTypeLabel(row.eventType)}</td>
                    <td className="px-5 py-3">
                      {row.picUri ? (
                        <img
                          src={row.picUri}
                          alt="capture"
                          onClick={() => onPreview(row.picUri)}
                          className="w-10 h-10 rounded object-cover cursor-pointer hover:ring-2 hover:ring-blue-500"
                        />
                      ) : (
                        <span className="text-gray-600">—</span>
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
  );
};

// ---------- Settings Tab ----------
const SettingsTab = ({
  loading,
  config,
  setConfig,
  saving,
  onSave,
  testingConn,
  connResult,
  onTestConn,
  registeringWebhook,
  onRegisterWebhook,
  loadingSubs,
  onViewSubs,
  onToggleAutoSync,
  onCopy,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const maskedKey = config.appKey
    ? config.appKey.slice(0, 4) + "••••••••" + config.appKey.slice(-2)
    : "Not configured";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Section 1: Connection */}
      <form
        onSubmit={onSave}
        className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4"
      >
        <h2 className="text-white font-semibold text-lg">HikCentral Connection</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1">HikCentral Host URL</label>
          <input
            type="text"
            value={config.host}
            onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value }))}
            placeholder="https://136.116.31.22"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">App Key</label>
          <input
            type="text"
            value={maskedKey}
            readOnly
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400 font-mono text-sm cursor-not-allowed"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
          >
            {saving ? "Saving…" : "Save Connection"}
          </button>
          <button
            type="button"
            onClick={onTestConn}
            disabled={testingConn}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
          >
            {testingConn ? "Testing…" : "Test Connection"}
          </button>
          {connResult && (
            <span
              className={`flex items-center gap-1 text-sm ${
                connResult.ok ? "text-green-400" : "text-red-400"
              }`}
            >
              {connResult.ok ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {connResult.message}
            </span>
          )}
        </div>
      </form>

      {/* Section 2: Event Subscription */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <h2 className="text-white font-semibold text-lg">Event Subscription</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Webhook URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={WEBHOOK_URL}
              readOnly
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 font-mono text-xs cursor-not-allowed"
            />
            <button
              onClick={() => onCopy(WEBHOOK_URL)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onRegisterWebhook}
            disabled={registeringWebhook}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
          >
            {registeringWebhook ? "Registering…" : "Register Webhook with HikCentral"}
          </button>
          <button
            onClick={onViewSubs}
            disabled={loadingSubs}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
          >
            {loadingSubs ? "Loading…" : "View Current Subscriptions"}
          </button>
        </div>
      </div>

      {/* Section 3: Auto-Sync */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Auto-Sync Settings</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-medium">Auto-sync new members to HikCentral</p>
            <p className="text-sm text-gray-400 mt-0.5">
              Controls the useHikCentral flag on member creation.
            </p>
          </div>
          <button
            onClick={onToggleAutoSync}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
              config.autoSync ? "bg-green-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                config.autoSync ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceManagement;
