import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import { useGymSettings } from "../contexts/GymSettingsContext";

const ToggleRow = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
    <div className="mr-4">
      <div className="text-sm font-medium text-white">{label}</div>
      {description && <div className="text-xs text-gray-400 mt-0.5">{description}</div>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? "bg-blue-600" : "bg-gray-600"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  </div>
);

const GymSettings = () => {
  const navigate = useNavigate();
  const { settings, loading, updateSettings } = useGymSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const buildLocalSettings = (src) => ({
    features: { ...src.features },
    instructorPermissions: {
      registerMembers: false,
      collectPayments: false,
      viewSupplements: false,
      ...src.instructorPermissions,
    },
    notifications: { ...src.notifications },
    packages: Array.isArray(src.packages) ? src.packages : [],
    payment: {
      dueDay: 10,
      reminderDays: [3, 1],
      ...src.payment,
    },
  });

  const [localSettings, setLocalSettings] = useState(() => buildLocalSettings(settings));

  useEffect(() => {
    if (!loading) {
      setLocalSettings(buildLocalSettings(settings));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, settings]);

  const [newPackage, setNewPackage] = useState({ name: "", price: "", duration: 1 });

  const addPackage = () => {
    const name = newPackage.name.trim();
    const price = parseFloat(newPackage.price);
    if (!name || isNaN(price) || price < 0) return;
    const pkg = {
      id: `pkg_${Date.now()}`,
      name,
      price,
      duration: parseInt(newPackage.duration) || 1,
    };
    setLocalSettings((prev) => ({ ...prev, packages: [...prev.packages, pkg] }));
    setNewPackage({ name: "", price: "", duration: 1 });
  };

  const removePackage = (id) =>
    setLocalSettings((prev) => ({
      ...prev,
      packages: prev.packages.filter((p) => p.id !== id),
    }));

  const updatePayment = (key, value) =>
    setLocalSettings((prev) => ({ ...prev, payment: { ...prev.payment, [key]: value } }));

  const updateFeature = (key, value) =>
    setLocalSettings((prev) => ({ ...prev, features: { ...prev.features, [key]: value } }));

  const updateInstructorPerm = (key, value) =>
    setLocalSettings((prev) => ({
      ...prev,
      instructorPermissions: { ...prev.instructorPermissions, [key]: value },
    }));

  const updateNotification = (key, value) =>
    setLocalSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ ...settings, ...localSettings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Gym Settings</h1>
            <p className="text-gray-400 text-sm">Configure features and permissions</p>
          </div>
        </div>

        {saved && (
          <div className="mb-6 bg-green-600/20 border border-green-600/30 rounded-lg p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-green-400 text-sm font-medium">Settings saved successfully!</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* App Features */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              App Features
            </h2>
            <p className="text-gray-400 text-xs mb-4">Enable or disable features across the entire app</p>
            <ToggleRow
              label="Supplements"
              description="Supplement inventory and member requests"
              checked={localSettings.features.supplements !== false}
              onChange={(v) => updateFeature("supplements", v)}
            />
            <ToggleRow
              label="Classes"
              description="Class scheduling and enrollment"
              checked={localSettings.features.classes !== false}
              onChange={(v) => updateFeature("classes", v)}
            />
            <ToggleRow
              label="Meal Plans"
              description="Instructor meal plans and member nutrition"
              checked={localSettings.features.mealPlans !== false}
              onChange={(v) => updateFeature("mealPlans", v)}
            />
          </div>

          {/* Instructor Permissions */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              Instructor Permissions
            </h2>
            <p className="text-gray-400 text-xs mb-4">Control what instructors are allowed to do</p>
            <ToggleRow
              label="Register Members"
              description="Allow instructors to add new members and share the self-registration QR code"
              checked={localSettings.instructorPermissions.registerMembers === true}
              onChange={(v) => updateInstructorPerm("registerMembers", v)}
            />
            <ToggleRow
              label="Collect Payments"
              description="Allow instructors to record member payments"
              checked={localSettings.instructorPermissions.collectPayments === true}
              onChange={(v) => updateInstructorPerm("collectPayments", v)}
            />
            <ToggleRow
              label="Supplement Management"
              description="Allow instructors to view supplement inventory and approve/reject member supplement requests"
              checked={localSettings.instructorPermissions.viewSupplements === true}
              onChange={(v) => updateInstructorPerm("viewSupplements", v)}
            />
          </div>

          {/* Notifications */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Notifications
            </h2>
            <p className="text-gray-400 text-xs mb-4">Configure notification channels</p>
            <ToggleRow
              label="SMS Notifications"
              description="Send SMS for registration, payments, and alerts"
              checked={localSettings.notifications.sms !== false}
              onChange={(v) => updateNotification("sms", v)}
            />
            <ToggleRow
              label="WhatsApp Notifications"
              description="Send WhatsApp receipts and welcome messages"
              checked={localSettings.notifications.whatsapp === true}
              onChange={(v) => updateNotification("whatsapp", v)}
            />
          </div>
        </div>

        {/* Membership Packages */}
        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Membership Packages
          </h2>
          <p className="text-gray-400 text-xs mb-4">
            Define packages with a name and price. When registering a member, staff can pick a package and the fee is filled in automatically.
          </p>

          {localSettings.packages.length > 0 && (
            <div className="space-y-2 mb-4">
              {localSettings.packages.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3">
                  <div>
                    <span className="text-white font-medium text-sm">{pkg.name}</span>
                    <span className="text-gray-400 text-xs ml-2">
                      Rs. {Number(pkg.price).toLocaleString()} · {pkg.duration} Month{pkg.duration > 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePackage(pkg.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <input
              type="text"
              value={newPackage.name}
              onChange={(e) => setNewPackage((p) => ({ ...p, name: e.target.value }))}
              placeholder="Package name (e.g. Gold)"
              className="sm:col-span-5 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={newPackage.price}
              onChange={(e) => setNewPackage((p) => ({ ...p, price: e.target.value }))}
              placeholder="Price (Rs.)"
              min="0"
              step="0.01"
              className="sm:col-span-3 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newPackage.duration}
              onChange={(e) => setNewPackage((p) => ({ ...p, duration: parseInt(e.target.value) }))}
              className="sm:col-span-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 Month</option>
              <option value={2}>2 Months</option>
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>12 Months</option>
            </select>
            <button
              type="button"
              onClick={addPackage}
              className="sm:col-span-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
            >
              Add
            </button>
          </div>
        </div>

        {/* Payment Collection */}
        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Payment Collection
          </h2>
          <p className="text-gray-400 text-xs mb-4">
            Set the day of the month payments are due and how many days before to send reminders.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Payment Due Day</label>
              <select
                value={localSettings.payment.dueDay}
                onChange={(e) => updatePayment("dueDay", parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Before {d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"} of the month
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Reminder Days (comma separated)
              </label>
              <input
                type="text"
                value={(localSettings.payment.reminderDays || []).join(", ")}
                onChange={(e) =>
                  updatePayment(
                    "reminderDays",
                    e.target.value
                      .split(",")
                      .map((n) => parseInt(n.trim()))
                      .filter((n) => !isNaN(n) && n >= 0),
                  )
                }
                placeholder="e.g. 3, 1"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Days before the due date to remind members.</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Saving...</>
            ) : "Save Settings"}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default GymSettings;
