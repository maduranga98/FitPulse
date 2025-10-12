import { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";

const MemberProfile = () => {
  const { user: currentUser } = useAuth();

  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [bmiInfo, setBmiInfo] = useState(null);

  const [editForm, setEditForm] = useState({
    name: "",
    age: "",
    mobile: "",
    whatsapp: "",
    email: "",
    weight: "",
    height: "",
    allergies: "",
    diseases: "",
    emergencyContact: "",
    emergencyName: "",
  });

  useEffect(() => {
    fetchMemberData();
  }, []);

  useEffect(() => {
    if (editForm.weight && editForm.height) {
      calculateBMI(editForm.weight, editForm.height);
    } else {
      setBmiInfo(null);
    }
  }, [editForm.weight, editForm.height]);

  const fetchMemberData = async () => {
    try {
      const { db } = await import("../../../config/firebase");
      const { doc, getDoc } = await import("firebase/firestore");

      const memberRef = doc(db, "members", currentUser.id);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        const data = { id: memberSnap.id, ...memberSnap.data() };
        setMemberData(data);
        setEditForm({
          name: data.name || "",
          age: data.age || "",
          mobile: data.mobile || "",
          whatsapp: data.whatsapp || "",
          email: data.email || "",
          weight: data.weight || "",
          height: data.height || "",
          allergies: data.allergies || "",
          diseases: data.diseases || "",
          emergencyContact: data.emergencyContact || "",
          emergencyName: data.emergencyName || "",
        });
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching member data:", error);
      setLoading(false);
    }
  };

  const calculateBMI = (weight, height) => {
    if (!weight || !height) return;

    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height) / 100;

    if (weightNum > 0 && heightNum > 0) {
      const bmi = (weightNum / (heightNum * heightNum)).toFixed(1);
      let category = "";
      let color = "";

      if (bmi < 18.5) {
        category = "Underweight";
        color = "text-blue-600";
      } else if (bmi < 25) {
        category = "Normal";
        color = "text-green-600";
      } else if (bmi < 30) {
        category = "Overweight";
        color = "text-yellow-600";
      } else {
        category = "Obese";
        color = "text-red-600";
      }

      setBmiInfo({ bmi, category, color });
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const { db } = await import("../../../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      const updateData = {
        ...editForm,
        bmi: bmiInfo?.bmi || null,
        bmiCategory: bmiInfo?.category || null,
      };

      await updateDoc(doc(db, "members", currentUser.id), updateData);

      setMemberData({ ...memberData, ...updateData });
      setIsEditing(false);
      setShowSuccessMessage(true);

      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      name: memberData.name || "",
      age: memberData.age || "",
      mobile: memberData.mobile || "",
      whatsapp: memberData.whatsapp || "",
      email: memberData.email || "",
      weight: memberData.weight || "",
      height: memberData.height || "",
      allergies: memberData.allergies || "",
      diseases: memberData.diseases || "",
      emergencyContact: memberData.emergencyContact || "",
      emergencyName: memberData.emergencyName || "",
    });
    setIsEditing(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="bg-green-600/20 border border-green-600/30 rounded-lg p-4 flex items-center gap-3">
          <svg
            className="w-5 h-5 text-green-600 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-green-600 font-medium text-sm sm:text-base">
            Profile updated successfully!
          </p>
        </div>
      )}

      {/* Edit Button */}
      {!isEditing && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsEditing(true)}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition flex items-center gap-2 active:scale-95 text-sm sm:text-base"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit Profile
          </button>
        </div>
      )}

      {/* Account Status */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white mb-1">
              Account Status
            </h2>
            <p className="text-xs sm:text-sm text-gray-400">
              Member since {formatDate(memberData?.joinDate)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium ${
                memberData?.status === "active"
                  ? "bg-green-600/20 text-green-600"
                  : "bg-red-600/20 text-red-600"
              }`}
            >
              {memberData?.status === "active" ? "Active" : "Inactive"}
            </span>
            <span
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium ${
                memberData?.level === "beginner"
                  ? "bg-blue-600/20 text-blue-600"
                  : memberData?.level === "intermediate"
                  ? "bg-yellow-600/20 text-yellow-600"
                  : "bg-purple-600/20 text-purple-600"
              }`}
            >
              {memberData?.level?.charAt(0).toUpperCase() +
                memberData?.level?.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Personal Information
        </h3>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Age
                </label>
                <input
                  type="number"
                  value={editForm.age}
                  onChange={(e) =>
                    setEditForm({ ...editForm, age: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={editForm.mobile}
                  onChange={(e) =>
                    setEditForm({ ...editForm, mobile: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={editForm.whatsapp}
                  onChange={(e) =>
                    setEditForm({ ...editForm, whatsapp: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                Full Name
              </div>
              <div className="text-white font-medium text-sm sm:text-base">
                {memberData?.name || "Not set"}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Age</div>
              <div className="text-white font-medium text-sm sm:text-base">
                {memberData?.age ? `${memberData.age} years` : "Not set"}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                Mobile
              </div>
              <div className="text-white font-medium text-sm sm:text-base">
                {memberData?.mobile || "Not set"}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                WhatsApp
              </div>
              <div className="text-white font-medium text-sm sm:text-base">
                {memberData?.whatsapp || "Not set"}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Email</div>
              <div className="text-white font-medium text-sm sm:text-base">
                {memberData?.email || "Not set"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Physical Stats */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Physical Stats
        </h3>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editForm.weight}
                  onChange={(e) =>
                    setEditForm({ ...editForm, weight: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Height (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editForm.height}
                  onChange={(e) =>
                    setEditForm({ ...editForm, height: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {bmiInfo && (
              <div className="bg-gray-900 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm text-gray-400 mb-1">
                      BMI (Body Mass Index)
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-lg sm:text-xl">
                        {bmiInfo.bmi}
                      </span>
                      <span
                        className={`px-2 sm:px-3 py-1 ${bmiInfo.color} bg-current/10 rounded-full text-xs sm:text-sm font-medium`}
                      >
                        {bmiInfo.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                Weight
              </div>
              <div className="text-white font-bold text-base sm:text-lg">
                {memberData?.weight ? `${memberData.weight} kg` : "N/A"}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                Height
              </div>
              <div className="text-white font-bold text-base sm:text-lg">
                {memberData?.height ? `${memberData.height} cm` : "N/A"}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">BMI</div>
              <div className="text-white font-bold text-base sm:text-lg">
                {memberData?.bmi || "N/A"}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                Category
              </div>
              <div
                className={`font-bold text-sm sm:text-base ${
                  memberData?.bmiCategory === "Underweight"
                    ? "text-blue-600"
                    : memberData?.bmiCategory === "Normal"
                    ? "text-green-600"
                    : memberData?.bmiCategory === "Overweight"
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {memberData?.bmiCategory || "N/A"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Medical Information */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Medical Information
        </h3>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                Allergies
              </label>
              <textarea
                value={editForm.allergies}
                onChange={(e) =>
                  setEditForm({ ...editForm, allergies: e.target.value })
                }
                rows="3"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="List any allergies (e.g., peanuts, lactose, etc.)"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                Medical Conditions / Diseases
              </label>
              <textarea
                value={editForm.diseases}
                onChange={(e) =>
                  setEditForm({ ...editForm, diseases: e.target.value })
                }
                rows="3"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="List any medical conditions (e.g., asthma, diabetes, etc.)"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-2">
                Allergies
              </div>
              <div className="bg-gray-900 rounded-lg p-3 sm:p-4">
                <p className="text-white text-sm sm:text-base">
                  {memberData?.allergies || "None reported"}
                </p>
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-2">
                Medical Conditions
              </div>
              <div className="bg-gray-900 rounded-lg p-3 sm:p-4">
                <p className="text-white text-sm sm:text-base">
                  {memberData?.diseases || "None reported"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Emergency Contact */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-orange-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
          Emergency Contact
        </h3>

        {isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                Contact Name
              </label>
              <input
                type="text"
                value={editForm.emergencyName}
                onChange={(e) =>
                  setEditForm({ ...editForm, emergencyName: e.target.value })
                }
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., John Doe"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                Contact Number
              </label>
              <input
                type="tel"
                value={editForm.emergencyContact}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    emergencyContact: e.target.value,
                  })
                }
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., +1234567890"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                Contact Name
              </div>
              <div className="text-white font-medium text-sm sm:text-base">
                {memberData?.emergencyName || "Not set"}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                Contact Number
              </div>
              <div className="text-white font-medium text-sm sm:text-base">
                {memberData?.emergencyContact || "Not set"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Account Credentials */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-cyan-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          Login Credentials
        </h3>
        <div className="space-y-4">
          <div>
            <div className="text-xs sm:text-sm text-gray-400 mb-1">
              Username
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-gray-900 px-3 py-2 rounded text-blue-400 font-mono text-sm sm:text-base flex-1">
                {memberData?.username || "Not set"}
              </code>
            </div>
          </div>
          <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-yellow-600/90 text-xs sm:text-sm">
                To change your password, please contact the gym administrator.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {isEditing && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition text-sm sm:text-base active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition text-sm sm:text-base active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              <>
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
                Save Changes
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default MemberProfile;
