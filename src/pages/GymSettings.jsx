import { useState } from "react";
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
  const { settings, updateSettings } = useGymSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [localSettings, setLocalSettings] = useState({
    features: { ...settings.features },
    instructorPermissions: {
      registerMembers: false,
      collectPayments: false,
      ...settings.instructorPermissions,
    },
    notifications: { ...settings.notifications },
  });

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
