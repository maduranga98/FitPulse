import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import MultiAngleFaceCapture from "../components/MultiAngleFaceCapture";

const Members = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [viewMember, setViewMember] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");

  // Multi-angle face capture states
  const [showMultiAngleCaptureModal, setShowMultiAngleCaptureModal] =
    useState(false);
  const [capturedFacePhotos, setCapturedFacePhotos] = useState([]);
  const [uploadingFacePhoto, setUploadingFacePhoto] = useState(false);
  const [faceUploadProgress, setFaceUploadProgress] = useState(0);

  const isAdmin = user?.role === "gym_admin" || user?.role === "manager";

  const [memberForm, setMemberForm] = useState({
    name: "",
    age: "",
    mobile: "",
    whatsapp: "",
    email: "",
    weight: "",
    height: "",
    allergies: "",
    diseases: "",
    level: "beginner",
    status: "active",
    joinDate: new Date().toISOString().split("T")[0],
    emergencyContact: "",
    emergencyName: "",
    notes: "",
  });

  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [bmiInfo, setBmiInfo] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, [currentGymId]);

  useEffect(() => {
    if (memberForm.weight && memberForm.height) {
      calculateBMI(memberForm.weight, memberForm.height);
    } else {
      setBmiInfo(null);
    }
  }, [memberForm.weight, memberForm.height]);

  const fetchMembers = async () => {
    if (!currentGymId) {
      setLoading(false);
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, orderBy, query, where } = await import(
        "firebase/firestore"
      );

      const membersRef = collection(db, "members");
      const membersQuery = query(
        membersRef,
        where("gymId", "==", currentGymId),
        orderBy("joinDate", "desc")
      );
      const snapshot = await getDocs(membersQuery);
      const membersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setMembers(membersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching members:", error);
      setLoading(false);
    }
  };

  const calculateBMI = (weight, height) => {
    const weightKg = parseFloat(weight);
    const heightM = parseFloat(height) / 100;

    if (weightKg > 0 && heightM > 0) {
      const bmi = (weightKg / (heightM * heightM)).toFixed(1);
      let category = "";
      let color = "";

      if (bmi < 18.5) {
        category = "Underweight";
        color = "text-blue-600";
      } else if (bmi >= 18.5 && bmi < 25) {
        category = "Normal weight";
        color = "text-green-600";
      } else if (bmi >= 25 && bmi < 30) {
        category = "Overweight";
        color = "text-yellow-600";
      } else {
        category = "Obese";
        color = "text-red-600";
      }

      setBmiInfo({ bmi, category, color });
    }
  };

  const generateUsername = (name) => {
    const cleanName = name.toLowerCase().replace(/\s+/g, "");
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${cleanName}${randomNum}`;
  };

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAddMember = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      alert("You don't have permission to add members");
      return;
    }

    // Validation
    if (!memberForm.mobile && !memberForm.whatsapp) {
      alert(
        "❌ At least one phone number (Mobile or WhatsApp) is required for SMS"
      );
      return;
    }

    if (capturedFacePhotos.length === 0) {
      const confirmWithoutFace = window.confirm(
        "⚠️ No face photos captured. Member won't be able to use face recognition attendance.\n\nContinue without face photos?"
      );
      if (!confirmWithoutFace) return;
    }

    try {
      const { db, storage } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );
      const { ref, uploadBytesResumable, getDownloadURL } = await import(
        "firebase/storage"
      );

      const username = generateUsername(memberForm.name);
      const password = generatePassword();

      let facePhotosArray = [];

      // Upload all face photos (6 photos: 3 angles x 2 copies)
      if (capturedFacePhotos && capturedFacePhotos.length > 0) {
        try {
          setUploadingFacePhoto(true);

          for (let i = 0; i < capturedFacePhotos.length; i++) {
            const photo = capturedFacePhotos[i];

            const timestamp = Date.now();
            const copyLabel = photo.copy ? `copy${photo.copy}` : '';
            const fileName = `faces/${currentGymId}/${username}_${photo.angle}_${copyLabel}_${timestamp}.jpg`;
            const storageRef = ref(storage, fileName);

            const uploadTask = uploadBytesResumable(storageRef, photo.blob);

            await new Promise((resolve, reject) => {
              uploadTask.on(
                "state_changed",
                (snapshot) => {
                  const progress =
                    (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  setFaceUploadProgress(progress);
                  console.log(
                    `Photo ${i + 1}/6 upload: ${progress.toFixed(0)}%`
                  );
                },
                (error) => {
                  console.error(`Photo ${i + 1} upload error:`, error);
                  reject(error);
                },
                async () => {
                  const downloadURL = await getDownloadURL(
                    uploadTask.snapshot.ref
                  );
                  facePhotosArray.push({
                    url: downloadURL,
                    angle: photo.angle,
                    uploadedAt: new Date().toISOString(),
                    index: photo.index,
                    copy: photo.copy,
                  });
                  console.log(`✅ Photo ${i + 1}/6 uploaded`);
                  resolve();
                }
              );
            });
          }

          setUploadingFacePhoto(false);
          console.log(
            `✅ All ${facePhotosArray.length} photos uploaded successfully`
          );
        } catch (uploadError) {
          console.error("❌ Face photos upload failed:", uploadError);
          alert("Failed to upload face photos. Please try again.");
          setUploadingFacePhoto(false);
          return;
        }
      }

      // Create member data
      const memberData = {
        ...memberForm,
        gymId: currentGymId,
        username,
        password,
        bmi: bmiInfo?.bmi || null,
        bmiCategory: bmiInfo?.category || null,
        role: "member",
        facePhotos: facePhotosArray.length > 0 ? facePhotosArray : null,
        faceRegistered: facePhotosArray.length > 0 ? true : false,
        faceRegistrationDate:
          facePhotosArray.length > 0 ? new Date().toISOString() : null,
        faceRegistrationMethod:
          facePhotosArray.length > 0 ? "multi-angle-capture" : null,
        createdAt: Timestamp.now(),
        joinDate: Timestamp.fromDate(new Date(memberForm.joinDate)),
      };

      await addDoc(collection(db, "members"), memberData);

      setGeneratedCredentials({ username, password, name: memberForm.name });

      // Send SMS notification
      try {
        const { sendMemberRegistrationSMS } = await import(
          "../services/smsService"
        );

        await sendMemberRegistrationSMS(
          {
            name: memberForm.name,
            mobile: memberForm.mobile,
            whatsapp: memberForm.whatsapp,
          },
          username,
          password
        );

        console.log("✅ SMS sent successfully");
      } catch (smsError) {
        console.error("⚠️ SMS sending failed:", smsError);
        alert(
          `⚠️ Member added, but SMS sending failed: ${smsError.message}\n\nManually share credentials with the member.`
        );
      }

      // Reset form
      setMemberForm({
        name: "",
        age: "",
        mobile: "",
        whatsapp: "",
        email: "",
        weight: "",
        height: "",
        allergies: "",
        diseases: "",
        level: "beginner",
        status: "active",
        joinDate: new Date().toISOString().split("T")[0],
        emergencyContact: "",
        emergencyName: "",
        notes: "",
      });

      setCapturedFacePhotos([]);
      setFaceUploadProgress(0);

      fetchMembers();
    } catch (error) {
      console.error("❌ Error adding member:", error);
      alert("Failed to add member: " + error.message);
    }
  };

  const handleDeleteMember = async (id) => {
    if (!isAdmin) {
      alert("You don't have permission to delete members");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this member?")) return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "members", id));
      fetchMembers();
    } catch (error) {
      console.error("Error deleting member:", error);
      alert("Failed to delete member");
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    if (!isAdmin) {
      alert("You don't have permission to update member status");
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      await updateDoc(doc(db, "members", id), {
        status: newStatus,
      });

      fetchMembers();

      if (viewMember && viewMember.id === id) {
        setViewMember({ ...viewMember, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.mobile?.includes(searchTerm) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || member.status === filterStatus;
    const matchesLevel = filterLevel === "all" || member.level === filterLevel;

    return matchesSearch && matchesStatus && matchesLevel;
  });

  const stats = {
    total: members.length,
    active: members.filter((m) => m.status === "active").length,
    inactive: members.filter((m) => m.status === "inactive").length,
    beginner: members.filter((m) => m.level === "beginner").length,
    intermediate: members.filter((m) => m.level === "intermediate").length,
    advanced: members.filter((m) => m.level === "advanced").length,
  };

  const closeCredentialsModal = () => {
    setGeneratedCredentials(null);
    setShowAddMember(false);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Members
              </h1>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddMember(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="hidden sm:inline">Add Member</span>
                <span className="sm:hidden">Add</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Total Members</div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Active</div>
              <div className="text-2xl font-bold text-green-600">
                {stats.active}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Inactive</div>
              <div className="text-2xl font-bold text-red-600">
                {stats.inactive}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Beginner</div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.beginner}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Intermediate</div>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.intermediate}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Advanced</div>
              <div className="text-2xl font-bold text-purple-600">
                {stats.advanced}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {/* Members Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400 text-lg">No members found</p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                  >
                    Add Your First Member
                  </button>
                )}
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {member.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {member.name}
                        </h3>
                        <p className="text-sm text-gray-400">{member.mobile}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        member.status === "active"
                          ? "bg-green-600/20 text-green-600"
                          : "bg-red-600/20 text-red-600"
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Level:</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          member.level === "beginner"
                            ? "bg-blue-600/20 text-blue-600"
                            : member.level === "intermediate"
                            ? "bg-yellow-600/20 text-yellow-600"
                            : "bg-purple-600/20 text-purple-600"
                        }`}
                      >
                        {member.level}
                      </span>
                    </div>
                    {member.bmi && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">BMI:</span>
                        <span className="text-white font-medium">
                          {member.bmi}{" "}
                          <span className="text-gray-500">
                            ({member.bmiCategory})
                          </span>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Age:</span>
                      <span className="text-white">{member.age} years</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMember(member)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      View Details
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg text-sm font-medium transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* Add Member Modal */}
      {showAddMember && !generatedCredentials && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-white">Add New Member</h2>
              <button
                onClick={() => {
                  setShowAddMember(false);
                  setCapturedFacePhotos([]);
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="md:col-span-2">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Personal Information
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={memberForm.name}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, name: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Age *
                  </label>
                  <input
                    type="number"
                    value={memberForm.age}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, age: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="25"
                    required
                    min="1"
                    max="150"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    value={memberForm.mobile}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, mobile: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1234567890"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    value={memberForm.whatsapp}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, whatsapp: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1234567890"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={memberForm.email}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, email: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>

                {/* Physical Information */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Physical Information
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={memberForm.weight}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, weight: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="70.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Height (cm) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={memberForm.height}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, height: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="175"
                    required
                  />
                </div>

                {bmiInfo && (
                  <div className="md:col-span-2">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-400 mb-1">
                            BMI (Body Mass Index)
                          </div>
                          <div className="text-2xl font-bold text-white">
                            {bmiInfo.bmi}
                          </div>
                        </div>
                        <div className={`text-right ${bmiInfo.color}`}>
                          <div className="text-lg font-bold">
                            {bmiInfo.category}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {bmiInfo.bmi < 18.5 && "Below normal range"}
                            {bmiInfo.bmi >= 18.5 &&
                              bmiInfo.bmi < 25 &&
                              "Healthy weight"}
                            {bmiInfo.bmi >= 25 &&
                              bmiInfo.bmi < 30 &&
                              "Above normal range"}
                            {bmiInfo.bmi >= 30 && "Significantly above normal"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Face Recognition Section */}
                <div className="md:col-span-2 mt-6">
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-blue-500"
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
                    Face Recognition (Optional)
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Capture 3 face photos from different angles (saved as 6 images) for better
                    recognition accuracy
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Face Photos (6 Images: 3 Angles × 2 Copies)
                  </label>

                  {capturedFacePhotos.length > 0 ? (
                    <div className="space-y-4">
                      {/* Photos Preview Grid */}
                      <div className="grid grid-cols-3 gap-4">
                        {capturedFacePhotos.map((photo, index) => (
                          <div key={index} className="relative">
                            <img
                              src={photo.url}
                              alt={`Face ${photo.angle}`}
                              className="w-full h-32 object-cover rounded-lg border-2 border-green-500"
                            />
                            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold">
                              {photo.angle} {photo.copy ? `(${photo.copy})` : ''}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Upload Progress */}
                      {uploadingFacePhoto && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">
                              Uploading photos...
                            </span>
                            <span className="text-sm text-blue-400">
                              {faceUploadProgress.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${faceUploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowMultiAngleCaptureModal(true)}
                          className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium flex items-center justify-center gap-2"
                          disabled={uploadingFacePhoto}
                        >
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
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Retake Photos
                        </button>
                        <button
                          type="button"
                          onClick={() => setCapturedFacePhotos([])}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center gap-2"
                          disabled={uploadingFacePhoto}
                        >
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Capture Button */}
                      <button
                        type="button"
                        onClick={() => setShowMultiAngleCaptureModal(true)}
                        className="w-full px-6 py-8 bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all duration-300 transform hover:scale-[1.02] font-semibold text-lg flex items-center justify-center gap-3"
                      >
                        <svg
                          className="w-8 h-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        Capture 3 Face Photos
                      </button>

                      {/* Guidelines */}
                      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-blue-300 font-medium mb-2">
                          📸 Multi-Angle Capture:
                        </p>
                        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                          <li>Capture 3 photos from different angles (saved as 6 images)</li>
                          <li>Improves recognition accuracy by 10-20%</li>
                          <li>Takes only 2-3 minutes</li>
                          <li>Works better in varying lighting conditions</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Medical Information */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Medical Information
                  </h3>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Allergies
                  </label>
                  <textarea
                    value={memberForm.allergies}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        allergies: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Any known allergies..."
                    rows="2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Medical Conditions / Diseases
                  </label>
                  <textarea
                    value={memberForm.diseases}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, diseases: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Any medical conditions, chronic diseases, etc..."
                    rows="2"
                  />
                </div>

                {/* Gym Information */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Gym Information
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fitness Level *
                  </label>
                  <select
                    value={memberForm.level}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, level: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Membership Status *
                  </label>
                  <select
                    value={memberForm.status}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, status: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Join Date *
                  </label>
                  <input
                    type="date"
                    value={memberForm.joinDate}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, joinDate: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Emergency Contact */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Emergency Contact
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    value={memberForm.emergencyName}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        emergencyName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contact person name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Emergency Contact Number
                  </label>
                  <input
                    type="tel"
                    value={memberForm.emergencyContact}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        emergencyContact: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1234567890"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={memberForm.notes}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, notes: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Any additional information about the member..."
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={uploadingFacePhoto}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingFacePhoto
                    ? "Uploading..."
                    : "Add Member & Generate Credentials"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMember(false);
                    setCapturedFacePhotos([]);
                  }}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Credentials Modal */}
      {generatedCredentials && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md">
            <div className="border-b border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
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
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Member Added Successfully!
                  </h2>
                  <p className="text-sm text-gray-400">
                    Login credentials generated
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-400 mb-3">
                  Member:{" "}
                  <span className="text-white font-medium">
                    {generatedCredentials.name}
                  </span>
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Username
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={generatedCredentials.username}
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            generatedCredentials.username
                          );
                          alert("Username copied!");
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Password
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={generatedCredentials.password}
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            generatedCredentials.password
                          );
                          alert("Password copied!");
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-4 mb-4">
                <div className="flex gap-2">
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm text-yellow-600 font-medium mb-1">
                      Important
                    </p>
                    <p className="text-xs text-yellow-600">
                      Please save these credentials securely. Share them with
                      the member via WhatsApp or in person.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const text = `Welcome to our Gym!\n\nYour Login Credentials:\nUsername: ${generatedCredentials.username}\nPassword: ${generatedCredentials.password}\n\nPlease keep these credentials safe.`;
                    navigator.clipboard.writeText(text);
                    alert("Credentials copied to clipboard!");
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                >
                  Copy All
                </button>
                <button
                  onClick={closeCredentialsModal}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Member Modal */}
      {viewMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {viewMember.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {viewMember.name}
                  </h2>
                  <p className="text-gray-400">Member ID: {viewMember.id}</p>
                </div>
              </div>
              <button
                onClick={() => setViewMember(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {isAdmin && (
                <div className="mb-6 flex gap-3">
                  <button
                    onClick={() => handleUpdateStatus(viewMember.id, "active")}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                      viewMember.status === "active"
                        ? "bg-green-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() =>
                      handleUpdateStatus(viewMember.id, "inactive")
                    }
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                      viewMember.status === "inactive"
                        ? "bg-red-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Personal Information
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Age</div>
                    <div className="text-white font-medium">
                      {viewMember.age} years
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Mobile</div>
                    <div className="text-white font-medium">
                      {viewMember.mobile}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">WhatsApp</div>
                    <div className="text-white font-medium">
                      {viewMember.whatsapp}
                    </div>
                  </div>
                  {viewMember.email && (
                    <div className="bg-gray-900 rounded-lg p-4 sm:col-span-2">
                      <div className="text-gray-400 text-sm mb-1">Email</div>
                      <div className="text-white font-medium">
                        {viewMember.email}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Physical Information
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Weight</div>
                    <div className="text-white font-medium">
                      {viewMember.weight} kg
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Height</div>
                    <div className="text-white font-medium">
                      {viewMember.height} cm
                    </div>
                  </div>
                  {viewMember.bmi && (
                    <>
                      <div className="bg-gray-900 rounded-lg p-4">
                        <div className="text-gray-400 text-sm mb-1">BMI</div>
                        <div className="text-white font-medium">
                          {viewMember.bmi}
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded-lg p-4">
                        <div className="text-gray-400 text-sm mb-1">
                          Category
                        </div>
                        <div className="text-white font-medium">
                          {viewMember.bmiCategory}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {(viewMember.allergies || viewMember.diseases) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Medical Information
                  </h3>
                  {viewMember.allergies && (
                    <div className="mb-3">
                      <div className="text-sm text-gray-400 mb-2">
                        Allergies
                      </div>
                      <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-3">
                        <p className="text-yellow-600 text-sm">
                          {viewMember.allergies}
                        </p>
                      </div>
                    </div>
                  )}
                  {viewMember.diseases && (
                    <div>
                      <div className="text-sm text-gray-400 mb-2">
                        Medical Conditions
                      </div>
                      <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3">
                        <p className="text-red-600 text-sm">
                          {viewMember.diseases}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Gym Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">
                      Fitness Level
                    </div>
                    <span
                      className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                        viewMember.level === "beginner"
                          ? "bg-blue-600/20 text-blue-600"
                          : viewMember.level === "intermediate"
                          ? "bg-yellow-600/20 text-yellow-600"
                          : "bg-purple-600/20 text-purple-600"
                      }`}
                    >
                      {viewMember.level}
                    </span>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Status</div>
                    <span
                      className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                        viewMember.status === "active"
                          ? "bg-green-600/20 text-green-600"
                          : "bg-red-600/20 text-red-600"
                      }`}
                    >
                      {viewMember.status}
                    </span>
                  </div>
                </div>
              </div>

              {(viewMember.emergencyName || viewMember.emergencyContact) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Emergency Contact
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4">
                    {viewMember.emergencyName && (
                      <div className="mb-2">
                        <span className="text-gray-400 text-sm">Name: </span>
                        <span className="text-white font-medium">
                          {viewMember.emergencyName}
                        </span>
                      </div>
                    )}
                    {viewMember.emergencyContact && (
                      <div>
                        <span className="text-gray-400 text-sm">Phone: </span>
                        <span className="text-white font-medium">
                          {viewMember.emergencyContact}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewMember.notes && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Additional Notes
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <p className="text-gray-300 text-sm">{viewMember.notes}</p>
                  </div>
                </div>
              )}

              {isAdmin && viewMember.username && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Login Credentials
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-400 text-sm mb-1">
                          Username
                        </div>
                        <div className="text-white font-mono">
                          {viewMember.username}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm mb-1">
                          Password
                        </div>
                        <div className="text-white font-mono">
                          {viewMember.password}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setViewMember(null)}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Angle Face Capture Modal */}
      {showMultiAngleCaptureModal && (
        <MultiAngleFaceCapture
          memberId={null}
          memberName={memberForm.name || "New Member"}
          onComplete={(photos) => {
            console.log("✅ Multi-angle capture complete:", photos);
            // Photos already have blob and url properties
            setCapturedFacePhotos(photos);
            setShowMultiAngleCaptureModal(false);
          }}
          onCancel={() => {
            setShowMultiAngleCaptureModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Members;
