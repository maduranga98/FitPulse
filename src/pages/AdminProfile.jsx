import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

const AdminProfile = () => {
  const { user: currentUser } = useAuth();

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
  });

  useEffect(() => {
    if (currentUser?.id) fetchUserData();
  }, [currentUser?.id]);

  const fetchUserData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, getDoc } = await import("firebase/firestore");

      const userRef = doc(db, "users", currentUser.id);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = { id: userSnap.id, ...userSnap.data() };
        setUserData(data);
        setEditForm({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          username: data.username || "",
        });
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc, Timestamp } = await import("firebase/firestore");

      await updateDoc(doc(db, "users", currentUser.id), {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        username: editForm.username.trim(),
        updatedAt: Timestamp.now(),
      });

      setUserData((prev) => ({ ...prev, ...editForm }));
      setIsEditing(false);
      setSuccessMessage(true);
      setTimeout(() => setSuccessMessage(false), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      name: userData?.name || "",
      email: userData?.email || "",
      phone: userData?.phone || "",
      username: userData?.username || "",
    });
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account information</p>
      </div>

      {successMessage && (
        <div className="mb-4 p-3 bg-green-600/20 border border-green-500 rounded-lg text-green-400 text-sm">
          Profile updated successfully.
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {/* Avatar header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
            {(userData?.name || userData?.username || "A")[0].toUpperCase()}
          </div>
          <div>
            <div className="text-white font-semibold text-lg">
              {userData?.name || userData?.username}
            </div>
            <div className="text-blue-200 text-sm capitalize">
              {userData?.role?.replace(/_/g, " ")}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {[
            { label: "Full Name", field: "name", type: "text" },
            { label: "Username", field: "username", type: "text" },
            { label: "Email", field: "email", type: "email" },
            { label: "Phone", field: "phone", type: "tel" },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              {isEditing ? (
                <input
                  type={type}
                  value={editForm[field]}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              ) : (
                <div className="text-white text-sm py-2.5 px-4 bg-gray-700/50 rounded-lg">
                  {userData?.[field] || (
                    <span className="text-gray-500">Not set</span>
                  )}
                </div>
              )}
            </div>
          ))}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Gym ID</label>
            <div className="text-white text-sm py-2.5 px-4 bg-gray-700/50 rounded-lg text-gray-400 font-mono text-xs">
              {currentUser?.gymId}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={handleCancel}
                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
