import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useGymSettings } from "../../contexts/GymSettingsContext";
import { useNotification } from "../../contexts/NotificationContext";

const InstructorPackages = () => {
  const { settings, loading, updateSettings } = useGymSettings();
  const { showSuccess, showError } = useNotification();
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState(Array.isArray(settings.packages) ? settings.packages : []);
  const [newPackage, setNewPackage] = useState({ name: "", price: "", duration: 1 });

  // Keep local list in sync once settings finish loading from Firestore —
  // the initial useState snapshot runs before the async load completes.
  useEffect(() => {
    if (!loading) {
      setPackages(Array.isArray(settings.packages) ? settings.packages : []);
    }
  }, [loading, settings.packages]);

  const persistPackages = async (nextPackages, successMessage) => {
    setSaving(true);
    try {
      await updateSettings({ ...settings, packages: nextPackages });
      setPackages(nextPackages);
      if (successMessage) showSuccess(successMessage);
      return true;
    } catch {
      showError("Failed to save packages. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addPackage = async () => {
    const name = newPackage.name.trim();
    const price = parseFloat(newPackage.price);
    if (!name || isNaN(price) || price < 0) {
      showError("Enter a valid package name and price");
      return;
    }
    const pkg = { id: `pkg_${Date.now()}`, name, price, duration: parseInt(newPackage.duration) || 1 };
    const saved = await persistPackages([...packages, pkg], `Package "${name}" saved`);
    if (saved) setNewPackage({ name: "", price: "", duration: 1 });
  };

  const removePackage = (id) => {
    persistPackages(packages.filter((p) => p.id !== id), "Package removed");
  };

  const handleSave = () => persistPackages(packages, "Packages saved successfully!");

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Membership Packages</h1>
          <p className="text-gray-400 text-sm mt-1">
            Define packages with a name and price. When registering a member, staff can pick a package and the fee is filled in automatically.
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          {/* Existing packages */}
          {packages.length > 0 && (
            <div className="space-y-2 mb-5">
              {packages.map((pkg) => (
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

          {packages.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm mb-4">No packages yet. Add one below.</div>
          )}

          {/* Add new package */}
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

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Saving...</>
          ) : "Save Packages"}
        </button>
      </div>
    </AdminLayout>
  );
};

export default InstructorPackages;
