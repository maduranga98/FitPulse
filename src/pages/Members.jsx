import { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNotification } from "../contexts/NotificationContext";
import Sidebar from "../components/Sidebar";
import { isAdmin, validateGymId } from "../utils/authUtils";
import { calculateBMI, validateBMIInputs } from "../utils/validationUtils";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { useGymSettings } from "../contexts/GymSettingsContext";
import { supabase } from "../services/supabaseClient";
import { APP_URL } from "../config/app";

const HikStatus = ({ member, onRetry, retrying }) => {
  if (member.hikCentralSynced === true) {
    return (
      <span
        title="Synced to HikCentral"
        className="flex items-center gap-1.5 text-green-400 text-xs font-medium"
      >
        <span className="w-2 h-2 rounded-full bg-green-500" /> Synced
      </span>
    );
  }
  if (member.hikCentralSynced === false && member.hikCentralSyncError) {
    return (
      <span className="flex items-center gap-2 text-xs font-medium">
        <span
          title={`Sync failed: ${member.hikCentralSyncError}`}
          className="flex items-center gap-1.5 text-red-400"
        >
          <span className="w-2 h-2 rounded-full bg-red-500" /> Sync failed
        </span>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retrying ? "..." : "Retry"}
        </button>
      </span>
    );
  }
  if (member.useHikCentral === true && !member.hikCentralSynced) {
    return (
      <span
        title="Sync pending"
        className="flex items-center gap-1.5 text-yellow-400 text-xs font-medium"
      >
        <span className="w-2 h-2 rounded-full bg-yellow-500" /> Pending
      </span>
    );
  }
  return (
    <span
      title="Not enrolled in HikCentral"
      className="flex items-center gap-1.5 text-gray-500 text-xs font-medium"
    >
      <span className="w-2 h-2 rounded-full bg-gray-600" /> Not enrolled
    </span>
  );
};

const Members = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();
  const currentGymId = user?.gymId;
  const { settings } = useGymSettings();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [viewMember, setViewMember] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [showQRModal, setShowQRModal] = useState(false);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [hikSyncingId, setHikSyncingId] = useState(null);
  const qrCanvasRef = useRef(null);

  const userIsAdmin = isAdmin(user);
  const gymValidation = validateGymId(user);

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

  const [activeTab, setActiveTab] = useState("members");
  const [blockingId, setBlockingId] = useState(null);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [bmiInfo, setBmiInfo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [profileImageUrlOverride, setProfileImageUrlOverride] = useState(null);

  useEffect(() => {
    fetchMembers();
    fetchPendingRegistrations();
  }, [currentGymId]);

  useEffect(() => {
    if (memberForm.weight && memberForm.height) {
      const bmiData = calculateBMI(memberForm.weight, memberForm.height);
      setBmiInfo(bmiData);
    } else {
      setBmiInfo(null);
    }
  }, [memberForm.weight, memberForm.height]);

  // Auto-calculate nextPaymentDate when joinDate or packageDuration changes
  useEffect(() => {
    if (memberForm.joinDate && memberForm.packageDuration) {
      const joinDate = new Date(memberForm.joinDate);
      joinDate.setMonth(
        joinDate.getMonth() + parseInt(memberForm.packageDuration),
      );
      const nextDate = joinDate.toISOString().slice(0, 10);
      setMemberForm((prev) => ({ ...prev, nextPaymentDate: nextDate }));
    }
  }, [memberForm.joinDate, memberForm.packageDuration]);

  const fetchMembers = async () => {
    if (!currentGymId) {
      setLoading(false);
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, orderBy, query, where } =
        await import("firebase/firestore");

      const membersRef = collection(db, "members");
      const membersQuery = query(
        membersRef,
        where("gymId", "==", currentGymId),
        orderBy("joinDate", "desc"),
      );
      const snapshot = await getDocs(membersQuery);
      const membersData = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((m) => !m.role || m.role === "member");

      setMembers(membersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching members:", error);
      setLoading(false);
    }
  };

  const fetchPendingRegistrations = async () => {
    if (!currentGymId) return;
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, query, where, orderBy } =
        await import("firebase/firestore");
      const regRef = collection(db, "self_registrations");
      const regQuery = query(
        regRef,
        where("gymId", "==", currentGymId),
        where("status", "==", "pending_approval"),
        orderBy("submittedAt", "desc"),
      );
      const snapshot = await getDocs(regQuery);
      setPendingRegistrations(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    } catch (error) {
      console.error("Error fetching pending registrations:", error);
    }
  };

  const handleApproveRegistration = (registration) => {
    // Pre-fill the add member form with self-registration data
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
      notes: `Self-registered`,
    });
    // Pre-fill profile image preview from self-registration
    if (registration.profileImageUrl) {
      setProfileImagePreview(registration.profileImageUrl);
      setProfileImageUrlOverride(registration.profileImageUrl);
    }
    setShowAddMember(true);

    // Mark as processed
    (async () => {
      try {
        const { db } = await import("../config/firebase");
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "self_registrations", registration.id), {
          status: "approved",
        });
        fetchPendingRegistrations();
      } catch (err) {
        console.error("Error updating registration status:", err);
      }
    })();
  };

  const handleDismissRegistration = async (registrationId) => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "self_registrations", registrationId), {
        status: "dismissed",
      });
      showSuccess("Registration dismissed");
      fetchPendingRegistrations();
    } catch (err) {
      console.error("Error dismissing registration:", err);
      showError("Failed to dismiss registration");
    }
  };

  const generateUsername = (name) => {
    const cleanName = name.toLowerCase().replace(/\s+/g, "");
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${cleanName}${randomNum}`;
  };

  const generateMemberCode = (docId) => {
    return `PG${docId.substring(0, 6).toUpperCase()}`;
  };

  const generateDevicePIN = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Image must be smaller than 5MB");
      return;
    }
    setProfileImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfileImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

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
      // VIP members don't pay, so clear the fee. Otherwise restore the
      // selected package's fee (if any).
      membershipFee: isVip
        ? "0"
        : (settings.packages || []).find((p) => p.id === prev.packageId)?.price?.toString() || prev.membershipFee,
    }));
  };

  const handleBlockMember = async (member) => {
    if (!userIsAdmin) {
      showError("You don't have permission to block members");
      return;
    }
    const newStatus = member.status === "blocked" ? "active" : "blocked";
    setBlockingId(member.id);
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "members", member.id), { status: newStatus });
      showSuccess(
        newStatus === "blocked"
          ? `${member.name}'s access has been blocked`
          : `${member.name}'s access has been restored`,
      );
      fetchMembers();
    } catch (error) {
      console.error("Error updating block status:", error);
      showError("Failed to update access");
    } finally {
      setBlockingId(null);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();

    if (!userIsAdmin) {
      showError("You don't have permission to add members");
      return;
    }

    // Validation
    if (!memberForm.mobile && !memberForm.whatsapp) {
      showError(
        "At least one phone number (Mobile or WhatsApp) is required for SMS",
      );
      return;
    }

    // Validate BMI inputs if provided
    if (memberForm.weight && memberForm.height) {
      const bmiValidation = validateBMIInputs(
        memberForm.weight,
        memberForm.height,
      );
      if (!bmiValidation.isValid) {
        showError("Invalid measurements: " + bmiValidation.errors.join(", "));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { db, storage } = await import("../config/firebase");
      const { collection, addDoc, Timestamp, updateDoc, doc } =
        await import("firebase/firestore");
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import("firebase/storage");

      const username = generateUsername(memberForm.name);
      const password = generatePassword();
      const hikvisionUserId = `${currentGymId.slice(-4).toUpperCase()}${Date.now().toString().slice(-6)}`;

      // Create member data
      const memberData = {
        ...memberForm,
        gymId: currentGymId,
        username,
        password,
        membershipFee: memberForm.membershipFee
          ? parseFloat(memberForm.membershipFee)
          : 0,
        packageDuration: parseInt(memberForm.packageDuration) || 1,
        nextPaymentDate: memberForm.nextPaymentDate || "",
        bmi: bmiInfo?.bmi || null,
        bmiCategory: bmiInfo?.category || null,
        role: "member",
        hikvisionUserId,
        enrolledDevices: [],
        createdAt: Timestamp.now(),
        joinDate: Timestamp.fromDate(new Date(memberForm.joinDate)),
      };

      const memberRef = await addDoc(collection(db, "members"), memberData);

      const memberCode = generateMemberCode(memberRef.id);
      const devicePIN = generateDevicePIN();

      // Upload profile image if provided, or keep existing URL from self-registration
      let profileImageUrl = profileImageUrlOverride || null;
      if (profileImageFile) {
        try {
          const imgRef = ref(storage, `members/${currentGymId}/${memberRef.id}/profile.jpg`);
          const imgMetadata = { contentType: profileImageFile.type };
          await new Promise((resolve, reject) => {
            const uploadTask = uploadBytesResumable(imgRef, profileImageFile, imgMetadata);
            uploadTask.on("state_changed", null, reject, () => resolve(uploadTask.snapshot));
          });
          profileImageUrl = await getDownloadURL(imgRef);
        } catch (imgErr) {
          console.warn("Profile image upload failed:", imgErr);
        }
      }

      await updateDoc(doc(db, "members", memberRef.id), {
        memberCode,
        firestoreId: memberRef.id,
        devicePIN,
        ...(profileImageUrl ? { profileImageUrl } : {}),
      });
      if (supabase) {
        const { error: supabaseError } = await supabase.from("members").insert({
          employee_no: memberCode,
          name: memberForm.name,
          gym_id: currentGymId,
          pin: devicePIN,
        });
        if (supabaseError) {
          console.error("Supabase member save error:", supabaseError);
        }
      }
      // Auto-sync to HikCentral if enabled for this gym
      try {
        const { doc, getDoc, updateDoc } = await import("firebase/firestore");
        const gymSnap = await getDoc(doc(db, "gyms", currentGymId));
        const autoSync =
          gymSnap.exists() &&
          gymSnap.data().hikCentralConfig?.autoSync === true;
        if (autoSync) {
          await updateDoc(doc(db, "members", memberRef.id), {
            useHikCentral: true,
          });
          showSuccess("Member will be synced to HikCentral automatically");
        }
      } catch (syncErr) {
        console.warn("⚠️ HikCentral auto-sync flag failed:", syncErr);
      }

      setGeneratedCredentials({
        username,
        password,
        name: memberForm.name,
        memberCode,
        devicePIN,
        profileImageUrl,
      });

      // SMS and WhatsApp are sent automatically by the onMemberCreated Cloud Function

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
      setProfileImageFile(null);
      setProfileImagePreview(null);
      setProfileImageUrlOverride(null);

      fetchMembers();
    } catch (error) {
      console.error("❌ Error adding member:", error);
      showError("Failed to add member: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadQR = async () => {
    const qrCanvas = qrCanvasRef.current?.querySelector("canvas");
    if (!qrCanvas) return;

    const gymName = user?.gymName || user?.name || "PulsedGym";
    const appName = "PulsedGym";

    // Card dimensions
    const W = 600;
    const H = 780;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background gradient
    ctx.fillStyle = "#111827"; // gray-900
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#7c3aed"); // purple-600
    grad.addColorStop(1, "#db2777"); // pink-600
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 8);

    // Draw logo
    await new Promise((resolve) => {
      const logo = new Image();
      logo.onload = () => {
        const logoSize = 72;
        ctx.drawImage(logo, (W - logoSize) / 2, 36, logoSize, logoSize);
        resolve();
      };
      logo.onerror = resolve;
      logo.src = "/logo.png";
    });

    // App name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(appName, W / 2, 140);

    // Divider
    ctx.strokeStyle = "#374151"; // gray-700
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 158);
    ctx.lineTo(W - 60, 158);
    ctx.stroke();

    // Instruction label
    ctx.fillStyle = "#9ca3af"; // gray-400
    ctx.font = "16px system-ui, -apple-system, sans-serif";
    ctx.fillText("Scan to register as a member", W / 2, 186);

    // QR code on white card
    const qrSize = 260;
    const qrX = (W - qrSize) / 2;
    const qrY = 210;
    const radius = 16;
    // White rounded rect behind QR
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, radius);
    ctx.fill();
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // Second divider
    ctx.strokeStyle = "#374151";
    ctx.beginPath();
    ctx.moveTo(60, qrY + qrSize + 60);
    ctx.lineTo(W - 60, qrY + qrSize + 60);
    ctx.stroke();

    // Gym name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
    ctx.fillText(gymName, W / 2, qrY + qrSize + 100);

    // Footer tagline
    ctx.fillStyle = "#6b7280"; // gray-500
    ctx.font = "14px system-ui, -apple-system, sans-serif";
    ctx.fillText("Track your progress • View schedules • Stay fit", W / 2, qrY + qrSize + 132);

    // Bottom accent bar
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - 8, W, 8);

    // Trigger download
    const link = document.createElement("a");
    link.download = `${gymName.replace(/\s+/g, "_")}_registration_qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleSyncToHikCentral = async (member) => {
    setHikSyncingId(member.id);
    try {
      const { getFunctions, httpsCallable } =
        await import("firebase/functions");
      const { app } = await import("../config/firebase");
      const functions = getFunctions(app);
      const hikAddPerson = httpsCallable(functions, "hikAddPerson");

      await hikAddPerson({
        gymId: currentGymId,
        personCode: member.id,
        personName: member.name,
        gender: member.gender || "male",
        phoneNo: member.phone || member.mobile || "",
        email: member.email || "",
      });

      const { db } = await import("../config/firebase");
      const { doc, updateDoc, serverTimestamp } =
        await import("firebase/firestore");
      await updateDoc(doc(db, "members", member.id), {
        useHikCentral: true,
        hikCentralSynced: true,
        hikCentralSyncError: null,
        hikCentralSyncedAt: serverTimestamp(),
      });

      showSuccess("Member synced to HikCentral");
      if (viewMember?.id === member.id) {
        setViewMember({
          ...viewMember,
          useHikCentral: true,
          hikCentralSynced: true,
        });
      }
      fetchMembers();
    } catch (error) {
      console.error("HikCentral sync failed:", error);
      try {
        const { db } = await import("../config/firebase");
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "members", member.id), {
          useHikCentral: true,
          hikCentralSynced: false,
          hikCentralSyncError: error.message || String(error),
        });
        fetchMembers();
      } catch {
        // ignore secondary failure
      }
      showError("HikCentral sync failed: " + error.message);
    } finally {
      setHikSyncingId(null);
    }
  };

  const handleDeleteMember = async (id) => {
    if (!userIsAdmin) {
      showError("You don't have permission to delete members");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this member?")) return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "members", id));
      showSuccess("Member deleted successfully");
      fetchMembers();
    } catch (error) {
      console.error("Error deleting member:", error);
      showError("Failed to delete member");
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    if (!userIsAdmin) {
      showError("You don't have permission to update member status");
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      await updateDoc(doc(db, "members", id), {
        status: newStatus,
      });

      showSuccess(`Member status updated to ${newStatus}`);
      fetchMembers();

      if (viewMember && viewMember.id === id) {
        setViewMember({ ...viewMember, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showError("Failed to update status");
    }
  };

  // Mark/unmark an existing member as VIP (no fee collected, excluded from
  // payment reminders) — used for special-case members the gym doesn't charge.
  const handleToggleVipExisting = async (member) => {
    if (!userIsAdmin) {
      showError("You don't have permission to update members");
      return;
    }
    const newVip = !member.isVip;
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "members", member.id), {
        isVip: newVip,
        ...(newVip ? { membershipFee: 0 } : {}),
      });
      showSuccess(
        newVip
          ? `${member.name} marked as VIP — no fee or payment reminders`
          : `${member.name} is no longer VIP`,
      );
      fetchMembers();
      if (viewMember && viewMember.id === member.id) {
        setViewMember({ ...viewMember, isVip: newVip, ...(newVip ? { membershipFee: 0 } : {}) });
      }
    } catch (error) {
      console.error("Error updating VIP status:", error);
      showError("Failed to update VIP status");
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

  // Show error if gymId validation fails
  if (!gymValidation.isValid) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-yellow-600/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-yellow-600"
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
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Configuration Error
          </h2>
          <p className="text-gray-400 mb-4">{gymValidation.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
            {userIsAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQRModal(true)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                  title="Share QR for self-registration"
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
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Share QR</span>
                </button>
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
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-700">
            <button
              onClick={() => setActiveTab("members")}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === "members"
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Members
            </button>
            {userIsAdmin && (
              <button
                onClick={() => setActiveTab("blocked")}
                className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                  activeTab === "blocked"
                    ? "border-blue-500 text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                Block Access
              </button>
            )}
          </div>

          {activeTab === "members" && (
          <>
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

          {/* Pending Self-Registrations */}
          {pendingRegistrations.length > 0 && (
            <div className="mb-6 bg-gray-800 border border-purple-600/30 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                <h3 className="text-white font-semibold text-sm">
                  Pending Self-Registrations ({pendingRegistrations.length})
                </h3>
              </div>
              <div className="space-y-3">
                {pendingRegistrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-center justify-between bg-gray-900 rounded-lg p-3 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                        {reg.profileImageUrl ? (
                          <img
                            src={reg.profileImageUrl}
                            alt={reg.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
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
                        <p className="text-white font-medium text-sm truncate">
                          {reg.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {reg.mobile ||
                            reg.whatsapp ||
                            reg.email ||
                            "No contact"}
                        </p>
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
              <option value="blocked">Blocked</option>
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
                {userIsAdmin && (
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
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                        {member.profileImageUrl ? (
                          <img src={member.profileImageUrl} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                            {member.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          {member.name}
                          {member.isVip && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                              VIP
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-400">{member.mobile}</p>
                        {member.memberCode && (
                          <p className="text-xs text-blue-400 font-mono mt-0.5">#{member.memberCode}</p>
                        )}
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
                    {userIsAdmin && (
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
          </>
          )}

          {/* Block Access Tab */}
          {activeTab === "blocked" && userIsAdmin && (
            <div>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Blocked members cannot log in to the app. Use this to revoke or restore access per member.
              </p>
              <div className="space-y-2">
                {members
                  .filter(
                    (m) =>
                      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      m.memberCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      m.mobile?.includes(searchTerm),
                  )
                  .map((member) => {
                    const isBlocked = member.status === "blocked";
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
                            {member.profileImageUrl ? (
                              <img
                                src={member.profileImageUrl}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold">
                                {member.name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-medium truncate">{member.name}</p>
                            {member.memberCode && (
                              <p className="text-xs text-blue-400 font-mono">#{member.memberCode}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              isBlocked
                                ? "bg-red-600/20 text-red-500"
                                : "bg-green-600/20 text-green-500"
                            }`}
                          >
                            {isBlocked ? "Blocked" : "Allowed"}
                          </span>
                          <button
                            onClick={() => handleBlockMember(member)}
                            disabled={blockingId === member.id}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                              isBlocked
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "bg-red-600 hover:bg-red-700 text-white"
                            }`}
                          >
                            {blockingId === member.id
                              ? "..."
                              : isBlocked
                                ? "Unblock"
                                : "Block"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {members.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No members found.</p>
                )}
              </div>
            </div>
          )}
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

                {/* Profile Image */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Profile Photo (optional)
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center flex-shrink-0">
                      {profileImagePreview ? (
                        <img
                          src={profileImagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentNode.querySelector("svg").style.display = "block";
                          }}
                        />
                      ) : null}
                      <svg
                        className="w-8 h-8 text-gray-500"
                        style={{ display: profileImagePreview ? "none" : "block" }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <label className="cursor-pointer px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition inline-block">
                        {profileImagePreview ? "Change Photo" : "Upload Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfileImageChange}
                          className="hidden"
                        />
                      </label>
                      {profileImagePreview && (
                        <button
                          type="button"
                          onClick={() => { setProfileImageFile(null); setProfileImagePreview(null); setProfileImageUrlOverride(null); }}
                          className="ml-2 text-sm text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      )}
                      <p className="text-xs text-gray-500 mt-1">JPEG, PNG or WebP, max 5MB</p>
                    </div>
                  </div>
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

                {/* VIP toggle */}
                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
                    <input
                      type="checkbox"
                      checked={memberForm.isVip}
                      onChange={(e) => handleToggleVip(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="text-sm font-medium text-white">
                      VIP Member
                      <span className="text-gray-400 font-normal ml-2">
                        (no membership fee is collected)
                      </span>
                    </span>
                  </label>
                </div>

                {/* Package selector (from gym settings) */}
                {(settings.packages || []).length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Package
                    </label>
                    <select
                      value={memberForm.packageId}
                      onChange={(e) => handleSelectPackage(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Custom (enter fee manually)</option>
                      {(settings.packages || []).map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} — Rs. {Number(pkg.price).toLocaleString()} ({pkg.duration} Month{pkg.duration > 1 ? "s" : ""})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Package Fee (Rs.) {!memberForm.isVip && "*"}
                  </label>
                  <input
                    type="number"
                    value={memberForm.isVip ? "" : memberForm.membershipFee}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        membershipFee: e.target.value,
                      })
                    }
                    disabled={memberForm.isVip}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={memberForm.isVip ? "VIP — no fee" : "Enter package fee"}
                    required={!memberForm.isVip}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Package Duration *
                  </label>
                  <select
                    value={memberForm.packageDuration}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        packageDuration: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value={1}>1 Month</option>
                    <option value={2}>2 Months</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Next Payment Date *
                  </label>
                  <input
                    type="date"
                    value={memberForm.nextPaymentDate}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        nextPaymentDate: e.target.value,
                      })
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
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Adding Member...
                    </>
                  ) : (
                    "Add Member & Generate Credentials"
                  )}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setShowAddMember(false);
                  }}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-medium transition"
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md max-h-[90vh] overflow-y-auto my-auto">
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
                            generatedCredentials.username,
                          );
                          showSuccess("Username copied!");
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
                            generatedCredentials.password,
                          );
                          showSuccess("Password copied!");
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4 mb-4 text-center">
                <label className="block text-xs font-medium text-blue-400 mb-2">
                  Device Code
                </label>
                <div className="text-3xl font-bold text-blue-500 tracking-widest mb-3">
                  {generatedCredentials.memberCode}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      generatedCredentials.memberCode,
                    );
                    showSuccess("Device code copied!");
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition"
                >
                  Copy Code
                </button>
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
                    showSuccess("Credentials copied to clipboard!");
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
                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                  {viewMember.profileImageUrl ? (
                    <img src={viewMember.profileImageUrl} alt={viewMember.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                      {viewMember.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {viewMember.name}
                  </h2>
                  <p className="text-gray-400">Member ID: {viewMember.id}</p>
                  {viewMember.memberCode && (
                    <p className="text-blue-400 font-mono text-sm mt-0.5">#{viewMember.memberCode}</p>
                  )}
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
              {userIsAdmin && (
                <>
                  <div className="mb-4 flex gap-3">
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
                  <div className="mb-6 flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        VIP / Fee Exempt
                        {viewMember.isVip && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">VIP</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        No membership fee is collected and no payment reminders are sent.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleVipExisting(viewMember)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${viewMember.isVip ? "bg-amber-500" : "bg-gray-600"}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${viewMember.isVip ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Personal Information
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {viewMember.memberCode && (
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="text-gray-400 text-sm mb-1">Member Code</div>
                      <div className="text-blue-400 font-mono font-medium">#{viewMember.memberCode}</div>
                    </div>
                  )}
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
                  {viewMember.membershipFee != null && (
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="text-gray-400 text-sm mb-1">
                        Package Fee
                      </div>
                      <div className="text-white font-medium">
                        Rs. {viewMember.membershipFee}
                      </div>
                    </div>
                  )}
                  {viewMember.packageDuration && (
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="text-gray-400 text-sm mb-1">
                        Package Duration
                      </div>
                      <div className="text-white font-medium">
                        {viewMember.packageDuration} Month
                        {viewMember.packageDuration > 1 ? "s" : ""}
                      </div>
                    </div>
                  )}
                  {viewMember.nextPaymentDate && (
                    <div className="bg-gray-900 rounded-lg p-4 col-span-2">
                      <div className="text-gray-400 text-sm mb-1">
                        Next Payment Date
                      </div>
                      <div className="text-white font-medium">
                        {new Date(
                          viewMember.nextPaymentDate,
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  )}
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

              {userIsAdmin && viewMember.username && (
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

      {/* QR Code Self-Registration Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setShowQRModal(false)}
          />
          <div className="relative bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm text-center">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Branding header */}
            <div className="flex items-center justify-center gap-2 mb-1">
              <img src="/logo.png" alt="PulsedGym" className="w-7 h-7 object-contain" />
              <span className="text-white font-bold text-base">PulsedGym</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-0.5">
              {user?.gymName || user?.name || "Your Gym"}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Share this QR code with new members. They can scan it to fill in their own details.
            </p>

            <div className="bg-white rounded-xl p-4 inline-block mb-4">
              <QRCodeSVG
                value={`${APP_URL}/register/${currentGymId}?gym=${encodeURIComponent(user?.gymName || user?.name || "PulsedGym")}`}
                size={200}
                level="M"
              />
            </div>

            {/* Hidden canvas-based QR for download */}
            <div ref={qrCanvasRef} className="hidden">
              <QRCodeCanvas
                value={`${APP_URL}/register/${currentGymId}?gym=${encodeURIComponent(user?.gymName || user?.name || "PulsedGym")}`}
                size={500}
                level="M"
              />
            </div>

            <div className="space-y-3">
              {/* Download for print */}
              <button
                onClick={handleDownloadQR}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download for Print
              </button>

              <button
                onClick={() => {
                  const url = `${APP_URL}/register/${currentGymId}?gym=${encodeURIComponent(user?.gymName || user?.name || "PulsedGym")}`;
                  navigator.clipboard.writeText(url);
                  showSuccess("Registration link copied to clipboard!");
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Registration Link
              </button>

              {navigator.share && (
                <button
                  onClick={async () => {
                    const url = `${APP_URL}/register/${currentGymId}?gym=${encodeURIComponent(user?.gymName || user?.name || "PulsedGym")}`;
                    try {
                      await navigator.share({ title: "Join Our Gym", text: "Register as a member by filling in your details:", url });
                    } catch (err) {
                      if (err.name !== "AbortError") console.error("Share failed:", err);
                    }
                  }}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share Link
                </button>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Submitted registrations will appear in a pending list for your approval.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
