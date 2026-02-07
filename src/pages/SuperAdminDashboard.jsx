// src/pages/SuperAdminDashboard.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { sendGymRegistrationSMS } from "../services/smsService";

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddGym, setShowAddGym] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewGym, setViewGym] = useState(null);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null); // { type: 'success'|'error', message: string }

  const [gymForm, setGymForm] = useState({
    name: "",
    location: "",
    address: "",
    phone: "",
    email: "",
    contactPerson: "",
    adminUsername: "",
    adminPassword: "",
    status: "active",
  });

  useEffect(() => {
    fetchGyms();
  }, []);

  // Clear SMS status after 5 seconds
  useEffect(() => {
    if (smsStatus) {
      const timer = setTimeout(() => setSmsStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [smsStatus]);

  const fetchGyms = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, orderBy, query, where } = await import(
        "firebase/firestore"
      );

      const gymsRef = collection(db, "gyms");
      const gymsQuery = query(gymsRef, orderBy("createdAt", "desc"));
      const gymsSnapshot = await getDocs(gymsQuery);

      const gymsWithStats = await Promise.all(
        gymsSnapshot.docs.map(async (doc) => {
          const gymData = { id: doc.id, ...doc.data() };

          // Fetch active members count
          const membersRef = collection(db, "members");
          const membersQuery = query(
            membersRef,
            where("gymId", "==", doc.id),
            where("status", "==", "active")
          );
          const membersSnapshot = await getDocs(membersQuery);

          return {
            ...gymData,
            activeMembersCount: membersSnapshot.size,
          };
        })
      );

      setGyms(gymsWithStats);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching gyms:", error);
      setSmsStatus({
        type: "error",
        message: "Failed to load gyms",
      });
      setLoading(false);
    }
  };

  const handleAddGym = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (
      !gymForm.name ||
      !gymForm.phone ||
      !gymForm.email ||
      !gymForm.contactPerson ||
      !gymForm.adminUsername ||
      !gymForm.adminPassword
    ) {
      setSmsStatus({
        type: "error",
        message: "Please fill all required fields",
      });
      return;
    }

    setSmsLoading(true);

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      // Step 1: Create gym in Firestore
      const gymRef = await addDoc(collection(db, "gyms"), {
        name: gymForm.name,
        location: gymForm.location,
        address: gymForm.address,
        phone: gymForm.phone,
        email: gymForm.email,
        contactPerson: gymForm.contactPerson,
        status: gymForm.status,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Step 2: Create gym admin user
      await addDoc(collection(db, "users"), {
        username: gymForm.adminUsername,
        password: gymForm.adminPassword,
        name: gymForm.contactPerson,
        email: gymForm.email,
        phone: gymForm.phone,
        role: "gym_admin",
        gymId: gymRef.id,
        createdAt: Timestamp.now(),
      });

      // Step 3: Send SMS with credentials
      try {
        await sendGymRegistrationSMS(
          {
            name: gymForm.name,
            phone: gymForm.phone,
          },
          gymForm.adminUsername,
          gymForm.adminPassword
        );

        setSmsStatus({
          type: "success",
          message: "✓ Gym registered and credentials sent via SMS!",
        });
      } catch (smsError) {
        // SMS failed - delete the created records and throw error
        const { deleteDoc: delDoc, doc: docRef, query: q, where: w } = await import("firebase/firestore");
        await delDoc(docRef(db, "gyms", gymRef.id));

        // Get the user doc to delete it too
        const usersRef = collection(db, "users");
        const userQuery = q(
          usersRef,
          w("username", "==", gymForm.adminUsername)
        );
        const userSnapshot = await getDocs(userQuery);
        if (!userSnapshot.empty) {
          await delDoc(docRef(db, "users", userSnapshot.docs[0].id));
        }

        throw smsError;
      }

      // Reset form and refresh list
      setShowAddGym(false);
      setGymForm({
        name: "",
        location: "",
        address: "",
        phone: "",
        email: "",
        contactPerson: "",
        adminUsername: "",
        adminPassword: "",
        status: "active",
      });
      fetchGyms();
    } catch (error) {
      console.error("Error adding gym:", error);
      setSmsStatus({
        type: "error",
        message: error.message || "Failed to register gym. Please try again.",
      });
    } finally {
      setSmsLoading(false);
    }
  };

  const handleToggleGymStatus = async (gymId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const actionText = newStatus === "inactive" ? "deactivate" : "activate";

    if (
      !confirm(
        `Are you sure you want to ${actionText} this gym? ${
          newStatus === "inactive"
            ? "Gym owners and members will not be able to log in."
            : "Gym owners and members will be able to log in again."
        }`
      )
    )
      return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      await updateDoc(doc(db, "gyms", gymId), {
        status: newStatus,
      });

      setSmsStatus({
        type: "success",
        message: `Gym ${actionText}d successfully`,
      });
      fetchGyms();
    } catch (error) {
      console.error("Error toggling gym status:", error);
      setSmsStatus({
        type: "error",
        message: `Failed to ${actionText} gym`,
      });
    }
  };

  const handleDeleteGym = async (gymId) => {
    if (
      !confirm("Are you sure? This will delete the gym and all related data.")
    )
      return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc, collection, query, where, getDocs } = await import("firebase/firestore");

      // Delete associated admin users first
      const usersRef = collection(db, "users");
      const usersQuery = query(usersRef, where("gymId", "==", gymId));
      const usersSnapshot = await getDocs(usersQuery);
      const deletePromises = usersSnapshot.docs.map((userDoc) =>
        deleteDoc(doc(db, "users", userDoc.id))
      );
      await Promise.all(deletePromises);

      // Delete the gym document
      await deleteDoc(doc(db, "gyms", gymId));
      setSmsStatus({
        type: "success",
        message: "Gym and associated users deleted successfully",
      });
      fetchGyms();
    } catch (error) {
      console.error("Error deleting gym:", error);
      setSmsStatus({
        type: "error",
        message: "Failed to delete gym",
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filteredGyms = gyms.filter(
    (gym) =>
      (gym.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gym.location || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gym.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalGyms = gyms.length;
  const activeGyms = gyms.filter((g) => g.status === "active").length;
  const inactiveGyms = gyms.filter((g) => g.status === "inactive").length;
  const totalActiveMembers = gyms.reduce(
    (sum, gym) => sum + (gym.activeMembersCount || 0),
    0
  );

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Super Admin Dashboard
            </h1>
            <p className="text-sm text-gray-400">Manage all registered gyms</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-gray-400">Super Administrator</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg text-sm font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* SMS Status Alert */}
      {smsStatus && (
        <div
          className={`mx-6 mt-4 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
            smsStatus.type === "success"
              ? "bg-green-600/20 text-green-600 border border-green-600/30"
              : "bg-red-600/20 text-red-600 border border-red-600/30"
          }`}
        >
          {smsStatus.type === "success" ? (
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span>{smsStatus.message}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-gray-400 text-sm mb-1">Total Gyms</p>
          <p className="text-3xl font-bold text-white">{totalGyms}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-gray-400 text-sm mb-1">Active Gyms</p>
          <p className="text-3xl font-bold text-green-600">{activeGyms}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-gray-400 text-sm mb-1">Inactive Gyms</p>
          <p className="text-3xl font-bold text-red-600">{inactiveGyms}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-gray-400 text-sm mb-1">Total Members</p>
          <p className="text-3xl font-bold text-blue-600">
            {totalActiveMembers}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-6 py-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Registered Gyms</h2>
            <p className="text-sm text-gray-400">
              Manage gym registrations and details
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/super-admin/bulk-exercise-import')}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center gap-2"
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Bulk Exercise Import
            </button>
            <button
              onClick={() => setShowAddGym(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Register Gym
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by gym name, location, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Gyms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGyms.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-400">No gyms found</p>
            </div>
          ) : (
            filteredGyms.map((gym) => (
              <div
                key={gym.id}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{gym.name}</h3>
                    <p className="text-sm text-gray-400">{gym.location}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      gym.status === "active"
                        ? "bg-green-600/20 text-green-600"
                        : "bg-red-600/20 text-red-600"
                    }`}
                  >
                    {gym.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-gray-400">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    <span>{gym.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773c.451.727 1.333 2.127 2.959 3.753 1.626 1.626 3.026 2.508 3.753 2.959l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2.57C6.75 18 2 13.25 2 7.43V3z" />
                    </svg>
                    <span>{gym.phone}</span>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-400 mb-1">Active Members</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {gym.activeMembersCount || 0}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewGym(gym)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleDeleteGym(gym.id)}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg text-sm font-medium transition"
                    >
                      Delete
                    </button>
                  </div>
                  <button
                    onClick={() => handleToggleGymStatus(gym.id, gym.status)}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition ${
                      gym.status === "active"
                        ? "bg-orange-600/20 hover:bg-orange-600/30 text-orange-600"
                        : "bg-green-600/20 hover:bg-green-600/30 text-green-600"
                    }`}
                  >
                    {gym.status === "active" ? "Deactivate Gym" : "Activate Gym"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Add Gym Modal */}
      {showAddGym && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                Register New Gym
              </h2>
              <button
                onClick={() => setShowAddGym(false)}
                disabled={smsLoading}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
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

            <form onSubmit={handleAddGym} className="p-6 space-y-6">
              {/* Gym Information */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4">
                  Gym Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Gym Name *
                    </label>
                    <input
                      type="text"
                      value={gymForm.name}
                      onChange={(e) =>
                        setGymForm({ ...gymForm, name: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Elite Fitness"
                      required
                      disabled={smsLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Location *
                    </label>
                    <input
                      type="text"
                      value={gymForm.location}
                      onChange={(e) =>
                        setGymForm({ ...gymForm, location: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Colombo 3"
                      disabled={smsLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={gymForm.phone}
                      onChange={
                        (e) =>
                          setGymForm({
                            ...gymForm,
                            phone: e.target.value.trim(),
                          }) // Add .trim()
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0712345678 or +94712345678"
                      required
                      disabled={smsLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={gymForm.email}
                      onChange={(e) =>
                        setGymForm({ ...gymForm, email: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="contact@gym.com"
                      required
                      disabled={smsLoading}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Full Address *
                    </label>
                    <textarea
                      value={gymForm.address}
                      onChange={(e) =>
                        setGymForm({ ...gymForm, address: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Street address, building, floor..."
                      rows="2"
                      disabled={smsLoading}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      value={gymForm.contactPerson}
                      onChange={(e) =>
                        setGymForm({
                          ...gymForm,
                          contactPerson: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Owner/Manager name"
                      required
                      disabled={smsLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Admin Credentials */}
              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Admin Credentials
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  These credentials will be sent to the gym phone number via SMS
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Admin Username *
                    </label>
                    <input
                      type="text"
                      value={gymForm.adminUsername}
                      onChange={(e) =>
                        setGymForm({
                          ...gymForm,
                          adminUsername: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="gym_admin_001"
                      required
                      disabled={smsLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Admin Password *
                    </label>
                    <input
                      type="text"
                      value={gymForm.adminPassword}
                      onChange={(e) =>
                        setGymForm({
                          ...gymForm,
                          adminPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="SecurePass123"
                      required
                      disabled={smsLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="border-t border-gray-700 pt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={smsLoading}
                  className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  {smsLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Registering & Sending SMS...</span>
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Register Gym
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddGym(false)}
                  disabled={smsLoading}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Gym Modal */}
      {viewGym && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">{viewGym.name}</h2>
              <button
                onClick={() => setViewGym(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
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

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Location</p>
                  <p className="text-white font-medium">{viewGym.location}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      viewGym.status === "active"
                        ? "bg-green-600/20 text-green-600"
                        : "bg-red-600/20 text-red-600"
                    }`}
                  >
                    {viewGym.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Email</p>
                  <p className="text-white font-medium">{viewGym.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Phone</p>
                  <p className="text-white font-medium">{viewGym.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Contact Person</p>
                  <p className="text-white font-medium">
                    {viewGym.contactPerson}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Active Members</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {viewGym.activeMembersCount || 0}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">Address</p>
                <p className="text-white">{viewGym.address}</p>
              </div>

              <div className="border-t border-gray-700 pt-6 flex gap-3">
                <button
                  onClick={() => setViewGym(null)}
                  className="flex-1 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
