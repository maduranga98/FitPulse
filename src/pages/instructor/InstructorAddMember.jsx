import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNotification } from "../../contexts/NotificationContext";
import { useGymSettings } from "../../contexts/GymSettingsContext";
import AdminLayout from "../../components/AdminLayout";
import { QRCodeSVG } from "qrcode.react";
import { APP_URL } from "../../config/app";
import { calculateBMI, validateBMIInputs } from "../../utils/validationUtils";
import { supabase } from "../../services/supabaseClient";
import MemberAvatar from "../../components/MemberAvatar";

const InstructorAddMember = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const { settings } = useGymSettings();
  const currentGymId = user?.gymId;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [gymName, setGymName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [profileImageUrlOverride, setProfileImageUrlOverride] = useState(null);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);

  const canRegisterMembers = settings.instructorPermissions?.registerMembers !== false;

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
    membershipFee: "",
    packageDuration: 1,
    packageId: "",
    packageName: "",
    isVip: false,
    nextPaymentDate: "",
    emergencyContact: "",
    emergencyName: "",
    notes: "",
  });

  const handleSelectPackage = (packageId) => {
    const pkg = (settings.packages || []).find((p) => p.id === packageId);
    if (!pkg) {
      setMemberForm((prev) => ({ ...prev, packageId: "", packageName: "" }));
      return;
    }
    setMemberForm((prev) => ({
      ...prev,
      packageId: pkg.id,
      packageName: pkg.name,
      membershipFee: prev.isVip ? "" : String(pkg.price),
      packageDuration: pkg.duration || prev.packageDuration,
    }));
  };

  const handleToggleVip = (isVip) => {
    setMemberForm((prev) => ({
      ...prev,
      isVip,
      membershipFee: isVip
        ? "0"
        : (settings.packages || []).find((p) => p.id === prev.packageId)?.price?.toString() || prev.membershipFee,
    }));
  };

  const bmiInfo =
    memberForm.weight && memberForm.height
      ? calculateBMI(memberForm.weight, memberForm.height)
      : null;

  useEffect(() => {
    fetchData();
    fetchPendingRegistrations();
  }, [currentGymId]);

  useEffect(() => {
    if (memberForm.joinDate && memberForm.packageDuration) {
      const join = new Date(memberForm.joinDate);
      join.setMonth(join.getMonth() + parseInt(memberForm.packageDuration));
      setMemberForm((prev) => ({
        ...prev,
        nextPaymentDate: join.toISOString().split("T")[0],
      }));
    }
  }, [memberForm.joinDate, memberForm.packageDuration]);

  const fetchPendingRegistrations = async () => {
    if (!currentGymId) return;
    try {
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, query, where, orderBy } = await import("firebase/firestore");
      const snap = await getDocs(query(
        collection(db, "self_registrations"),
        where("gymId", "==", currentGymId),
        where("status", "==", "pending_approval"),
        orderBy("submittedAt", "desc"),
      ));
      setPendingRegistrations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching pending registrations:", err);
    }
  };

  const handleApproveRegistration = (registration) => {
    setMemberForm({
      name: registration.name || "",
      age: registration.age || "",
      mobile: registration.mobile || "",
      whatsapp: registration.whatsapp || "",
      email: registration.email || "",
      weight: registration.weight || "",
      height: registration.height || "",
      allergies: registration.allergies || "",
      diseases: registration.diseases || "",
      level: "beginner",
      status: "active",
      joinDate: new Date().toISOString().split("T")[0],
      membershipFee: "",
      packageDuration: 1,
      packageId: "",
      packageName: "",
      isVip: false,
      nextPaymentDate: "",
      emergencyContact: registration.emergencyContact || "",
      emergencyName: registration.emergencyName || "",
      notes: "Self-registered",
    });
    if (registration.profileImageUrl) {
      setProfileImagePreview(registration.profileImageUrl);
      setProfileImageUrlOverride(registration.profileImageUrl);
    }
    setShowAddForm(true);

    (async () => {
      try {
        const { db } = await import("../../config/firebase");
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "self_registrations", registration.id), { status: "approved" });
        fetchPendingRegistrations();
      } catch (err) {
        console.error("Error updating registration status:", err);
      }
    })();
  };

  const handleDismissRegistration = async (registrationId) => {
    try {
      const { db } = await import("../../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "self_registrations", registrationId), { status: "dismissed" });
      showSuccess("Registration dismissed");
      fetchPendingRegistrations();
    } catch (err) {
      showError("Failed to dismiss registration");
    }
  };

  const fetchData = async () => {
    if (!currentGymId) { setLoading(false); return; }
    try {
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, query, where, orderBy, doc, getDoc } = await import("firebase/firestore");

      const snap = await getDocs(query(
        collection(db, "members"),
        where("gymId", "==", currentGymId),
        where("status", "==", "active"),
        orderBy("name", "asc")
      ));
      setMembers(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => !m.role || m.role === "member")
      );

      const gymSnap = await getDoc(doc(db, "gyms", currentGymId));
      if (gymSnap.exists()) setGymName(gymSnap.data().name || "");
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateUsername = (name) => {
    const cleanName = name.toLowerCase().replace(/\s+/g, "");
    return `${cleanName}${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const generateMemberCode = (docId) => `PG${docId.substring(0, 6).toUpperCase()}`;
  const generateDevicePIN = () => Math.floor(100000 + Math.random() * 900000).toString();

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showError("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { showError("Image must be smaller than 5MB"); return; }
    setProfileImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfileImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!canRegisterMembers) {
      showError("You don't have permission to register members");
      return;
    }
    if (!memberForm.mobile && !memberForm.whatsapp) {
      showError("At least one phone number is required");
      return;
    }
    if (memberForm.weight && memberForm.height) {
      const v = validateBMIInputs(memberForm.weight, memberForm.height);
      if (!v.isValid) { showError("Invalid measurements: " + v.errors.join(", ")); return; }
    }

    setSubmitting(true);
    try {
      const { db, storage } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp, updateDoc, doc } = await import("firebase/firestore");
      const { ref, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");

      const username = generateUsername(memberForm.name);
      const password = generatePassword();
      const hikvisionUserId = `${currentGymId.slice(-4).toUpperCase()}${Date.now().toString().slice(-6)}`;

      const memberData = {
        ...memberForm,
        gymId: currentGymId,
        username,
        password,
        membershipFee: memberForm.membershipFee ? parseFloat(memberForm.membershipFee) : 0,
        packageDuration: parseInt(memberForm.packageDuration) || 1,
        nextPaymentDate: memberForm.nextPaymentDate || "",
        bmi: bmiInfo?.bmi || null,
        bmiCategory: bmiInfo?.category || null,
        role: "member",
        hikvisionUserId,
        enrolledDevices: [],
        createdAt: Timestamp.now(),
        joinDate: Timestamp.fromDate(new Date(memberForm.joinDate)),
        addedBy: user?.id || "",
        addedByName: user?.name || user?.username || "Instructor",
      };

      const memberRef = await addDoc(collection(db, "members"), memberData);
      const memberCode = generateMemberCode(memberRef.id);
      const devicePIN = generateDevicePIN();

      let profileImageUrl = profileImageUrlOverride || null;
      if (profileImageFile && storage) {
        try {
          const imgRef = ref(storage, `members/${currentGymId}/${memberRef.id}/profile.jpg`);
          const uploadTask = uploadBytesResumable(imgRef, profileImageFile, { contentType: profileImageFile.type });
          await new Promise((resolve, reject) => uploadTask.on("state_changed", null, reject, resolve));
          profileImageUrl = await getDownloadURL(imgRef);
        } catch (imgErr) {
          console.error("Profile image upload failed:", imgErr);
        }
      }

      await updateDoc(doc(db, "members", memberRef.id), {
        memberCode,
        firestoreId: memberRef.id,
        devicePIN,
        ...(profileImageUrl ? { profileImageUrl } : {}),
      });

      if (supabase) {
        await supabase.from("members").insert({
          employee_no: memberCode,
          name: memberForm.name,
          gym_id: currentGymId,
          pin: devicePIN,
        }).catch((err) => console.error("Supabase error:", err));
      }

      // SMS is sent automatically by the onMemberCreated Cloud Function.

      setGeneratedCredentials({ username, password, name: memberForm.name, memberCode, devicePIN });
      setMemberForm({
        name: "", age: "", mobile: "", whatsapp: "", email: "",
        weight: "", height: "", allergies: "", diseases: "",
        level: "beginner", status: "active",
        joinDate: new Date().toISOString().split("T")[0],
        membershipFee: "", packageDuration: 1, packageId: "", packageName: "", isVip: false, nextPaymentDate: "",
        emergencyContact: "", emergencyName: "", notes: "",
      });
      setProfileImageFile(null);
      setProfileImagePreview(null);
      setProfileImageUrlOverride(null);
      fetchData();
    } catch (err) {
      console.error("Error adding member:", err);
      showError("Failed to add member: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = members.filter((m) =>
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.mobile?.includes(searchTerm)
  );

  const selfRegUrl = `${APP_URL}/register/${currentGymId}?gym=${encodeURIComponent(gymName)}`;

  const inputClass = "w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (!canRegisterMembers) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center h-full">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
            <p className="text-gray-400 text-sm">Member registration is not enabled for instructors. Please contact your gym admin.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Members</h1>
            <p className="text-gray-400 text-sm">{members.length} active members</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowQRModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Share QR
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Member
            </button>
          </div>
        </div>

        {/* Pending Self-Registrations */}
        {pendingRegistrations.length > 0 && (
          <div className="bg-gray-800 border border-purple-600/30 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              <h3 className="text-white font-semibold text-sm">
                Pending Self-Registrations ({pendingRegistrations.length})
              </h3>
            </div>
            <div className="space-y-3">
              {pendingRegistrations.map((reg) => (
                <div key={reg.id} className="flex items-center justify-between bg-gray-900 rounded-lg p-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                      {reg.profileImageUrl ? (
                        <img
                          src={reg.profileImageUrl}
                          alt={reg.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                        />
                      ) : null}
                      <div
                        className="w-full h-full bg-purple-600/20 items-center justify-center text-purple-400 font-bold text-sm"
                        style={{ display: reg.profileImageUrl ? "none" : "flex" }}
                      >
                        {reg.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{reg.name}</p>
                      <p className="text-xs text-gray-400 truncate">{reg.mobile || reg.whatsapp || reg.email || "No contact"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApproveRegistration(reg)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDismissRegistration(reg.id)}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Members List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No members found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member) => (
              <div key={member.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <MemberAvatar name={member.name} imageUrl={member.profileImageUrl} sizeClass="w-10 h-10" textClass="text-sm" />
                  <div className="min-w-0">
                    <div className="text-white font-medium text-sm truncate flex items-center gap-1.5">
                      <span className="truncate">{member.name}</span>
                      {member.isVip && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 flex-shrink-0">VIP</span>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs capitalize">{member.level || "beginner"}</div>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${member.status === "active" ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
                    {member.status}
                  </span>
                </div>
                {member.mobile && (
                  <div className="text-gray-400 text-xs">{member.mobile}</div>
                )}
                {member.memberCode && (
                  <div className="text-gray-500 text-xs mt-1">#{member.memberCode}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* QR Modal */}
        {showQRModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Self-Registration QR</h2>
                <button onClick={() => setShowQRModal(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG value={selfRegUrl} size={200} />
                </div>
                <p className="text-gray-400 text-sm text-center">Members can scan this QR to self-register</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(selfRegUrl); showSuccess("Link copied!"); }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Copy Registration Link
                </button>
                {navigator.share && (
                  <button
                    onClick={() => navigator.share({ title: "Join the gym", url: selfRegUrl })}
                    className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
                  >
                    Share Link
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Add New Member</h2>
                <button onClick={() => setShowAddForm(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleAddMember} className="p-6 space-y-5">
                {/* Profile Photo */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Profile Photo</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center flex-shrink-0">
                      {profileImagePreview ? (
                        <img src={profileImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition inline-block">
                        {profileImagePreview ? "Change Photo" : "Upload Photo"}
                        <input type="file" accept="image/*" onChange={handleProfileImageChange} className="hidden" />
                      </label>
                      {profileImagePreview && (
                        <button type="button" onClick={() => { setProfileImageFile(null); setProfileImagePreview(null); setProfileImageUrlOverride(null); }} className="ml-2 text-sm text-red-400 hover:text-red-300">
                          Remove
                        </button>
                      )}
                      <p className="text-xs text-gray-500 mt-1">JPEG, PNG or WebP, max 5MB</p>
                    </div>
                  </div>
                </div>

                {/* Personal Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Personal Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Full Name *</label>
                      <input required type="text" value={memberForm.name} onChange={(e) => setMemberForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Age</label>
                      <input type="number" value={memberForm.age} onChange={(e) => setMemberForm((p) => ({ ...p, age: e.target.value }))} className={inputClass} placeholder="25" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Mobile</label>
                      <input type="tel" value={memberForm.mobile} onChange={(e) => setMemberForm((p) => ({ ...p, mobile: e.target.value }))} className={inputClass} placeholder="+1234567890" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">WhatsApp</label>
                      <input type="tel" value={memberForm.whatsapp} onChange={(e) => setMemberForm((p) => ({ ...p, whatsapp: e.target.value }))} className={inputClass} placeholder="+1234567890" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-400 mb-1.5">Email</label>
                      <input type="email" value={memberForm.email} onChange={(e) => setMemberForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="john@example.com" />
                    </div>
                  </div>
                </div>

                {/* Membership */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Membership Details</h3>
                  <label className="flex items-center gap-3 cursor-pointer bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 mb-4">
                    <input
                      type="checkbox"
                      checked={memberForm.isVip}
                      onChange={(e) => handleToggleVip(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="text-sm font-medium text-white">
                      VIP Member
                      <span className="text-gray-400 font-normal ml-2">(no membership fee is collected)</span>
                    </span>
                  </label>
                  {(settings.packages || []).length > 0 && (
                    <div className="mb-4">
                      <label className="block text-xs text-gray-400 mb-1.5">Package</label>
                      <select value={memberForm.packageId} onChange={(e) => handleSelectPackage(e.target.value)} className={inputClass}>
                        <option value="">Custom (enter fee manually)</option>
                        {(settings.packages || []).map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} — Rs. {Number(pkg.price).toLocaleString()} ({pkg.duration} Month{pkg.duration > 1 ? "s" : ""})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Join Date</label>
                      <input type="date" value={memberForm.joinDate} onChange={(e) => setMemberForm((p) => ({ ...p, joinDate: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Level</label>
                      <select value={memberForm.level} onChange={(e) => setMemberForm((p) => ({ ...p, level: e.target.value }))} className={inputClass}>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Status</label>
                      <select value={memberForm.status} onChange={(e) => setMemberForm((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Membership Fee {memberForm.isVip && "(VIP — no fee)"}</label>
                      <input type="number" value={memberForm.isVip ? "" : memberForm.membershipFee} disabled={memberForm.isVip} onChange={(e) => setMemberForm((p) => ({ ...p, membershipFee: e.target.value }))} className={`${inputClass} disabled:opacity-50`} placeholder={memberForm.isVip ? "VIP — no fee" : "0.00"} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Package Duration (months)</label>
                      <input type="number" min="1" value={memberForm.packageDuration} onChange={(e) => setMemberForm((p) => ({ ...p, packageDuration: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                </div>

                {/* Physical Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Physical Info</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Weight (kg)</label>
                      <input type="number" value={memberForm.weight} onChange={(e) => setMemberForm((p) => ({ ...p, weight: e.target.value }))} className={inputClass} placeholder="70" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Height (cm)</label>
                      <input type="number" value={memberForm.height} onChange={(e) => setMemberForm((p) => ({ ...p, height: e.target.value }))} className={inputClass} placeholder="175" />
                    </div>
                  </div>
                  {bmiInfo && (
                    <div className="mt-3 bg-gray-900 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-400 mb-1">BMI (Body Mass Index)</div>
                          <div className="text-2xl font-bold text-white">{bmiInfo.bmi}</div>
                        </div>
                        <div className={`text-right ${bmiInfo.color}`}>
                          <div className="text-base font-bold">{bmiInfo.category}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {bmiInfo.bmi < 18.5 && "Below normal range"}
                            {bmiInfo.bmi >= 18.5 && bmiInfo.bmi < 25 && "Healthy weight"}
                            {bmiInfo.bmi >= 25 && bmiInfo.bmi < 30 && "Above normal range"}
                            {bmiInfo.bmi >= 30 && "Significantly above normal"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Medical Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Medical Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Allergies</label>
                      <textarea value={memberForm.allergies} onChange={(e) => setMemberForm((p) => ({ ...p, allergies: e.target.value }))} className={inputClass} rows={2} placeholder="Any known allergies..." />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Medical Conditions / Diseases</label>
                      <textarea value={memberForm.diseases} onChange={(e) => setMemberForm((p) => ({ ...p, diseases: e.target.value }))} className={inputClass} rows={2} placeholder="Any medical conditions, chronic diseases, etc..." />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Emergency Contact</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Contact Name</label>
                      <input type="text" value={memberForm.emergencyName} onChange={(e) => setMemberForm((p) => ({ ...p, emergencyName: e.target.value }))} className={inputClass} placeholder="Contact person name" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Contact Number</label>
                      <input type="tel" value={memberForm.emergencyContact} onChange={(e) => setMemberForm((p) => ({ ...p, emergencyContact: e.target.value }))} className={inputClass} placeholder="+1234567890" />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Additional Notes</label>
                  <textarea value={memberForm.notes} onChange={(e) => setMemberForm((p) => ({ ...p, notes: e.target.value }))} className={inputClass} rows={2} placeholder="Any additional notes..." />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Adding...</>
                    ) : "Add Member"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Credentials Modal */}
        {generatedCredentials && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold">Member Added!</h3>
                  <p className="text-gray-400 text-xs">{generatedCredentials.name}</p>
                </div>
              </div>
              <div className="space-y-3 bg-gray-900 rounded-lg p-4 mb-4">
                {[
                  { label: "Member Code", value: generatedCredentials.memberCode },
                  { label: "Username", value: generatedCredentials.username },
                  { label: "Password", value: generatedCredentials.password },
                  { label: "Device PIN", value: generatedCredentials.devicePIN },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">{label}</div>
                      <div className="text-white text-sm font-mono font-medium">{value}</div>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(value); showSuccess(`${label} copied!`); }}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setGeneratedCredentials(null)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorAddMember;
