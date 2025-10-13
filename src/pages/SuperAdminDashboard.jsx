// src/pages/SuperAdminDashboard.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddGym, setShowAddGym] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewGym, setViewGym] = useState(null);

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
      setLoading(false);
    }
  };

  const handleAddGym = async (e) => {
    e.preventDefault();

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      // Create gym
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

      // Create gym admin user
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

      alert("✅ Gym registered successfully!");
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
      alert("Failed to register gym");
    }
  };

  const handleDeleteGym = async (gymId) => {
    if (
      !confirm("Are you sure? This will delete the gym and all related data.")
    )
      return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "gyms", gymId));
      alert("Gym deleted successfully");
      fetchGyms();
    } catch (error) {
      console.error("Error deleting gym:", error);
      alert("Failed to delete gym");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filteredGyms = gyms.filter(
    (gym) =>
      gym.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gym.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gym.email.toLowerCase().includes(searchTerm.toLowerCase())
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
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-1">Total Gyms</p>
            <p className="text-3xl font-bold text-white">{totalGyms}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-1">Active Gyms</p>
            <p className="text-3xl font-bold text-white">{activeGyms}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-1">Inactive Gyms</p>
            <p className="text-3xl font-bold text-white">{inactiveGyms}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-1">Total Active Members</p>
            <p className="text-3xl font-bold text-white">
              {totalActiveMembers}
            </p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <input
            type="text"
            placeholder="Search gyms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
            Register New Gym
          </button>
        </div>

        {/* Gyms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGyms.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-400 text-lg">No gyms found</p>
            </div>
          ) : (
            filteredGyms.map((gym) => (
              <div
                key={gym.id}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {gym.name}
                    </h3>
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

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span>{gym.contactPerson}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
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
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span>{gym.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
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
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
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

            <form onSubmit={handleAddGym} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
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
                    placeholder="e.g., PowerFit Gym"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Location/City *
                  </label>
                  <input
                    type="text"
                    value={gymForm.location}
                    onChange={(e) =>
                      setGymForm({ ...gymForm, location: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., New York"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={gymForm.phone}
                    onChange={(e) =>
                      setGymForm({ ...gymForm, phone: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1 234 567 8900"
                    required
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
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    value={gymForm.contactPerson}
                    onChange={(e) =>
                      setGymForm({ ...gymForm, contactPerson: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Owner/Manager name"
                    required
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
                  />
                </div>

                <div className="md:col-span-2 border-t border-gray-700 pt-6 mt-2">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Admin Credentials
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Admin Username *
                  </label>
                  <input
                    type="text"
                    value={gymForm.adminUsername}
                    onChange={(e) =>
                      setGymForm({ ...gymForm, adminUsername: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="admin_username"
                    required
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
                      setGymForm({ ...gymForm, adminPassword: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="secure_password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status *
                  </label>
                  <select
                    value={gymForm.status}
                    onChange={(e) =>
                      setGymForm({ ...gymForm, status: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Register Gym
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddGym(false)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
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

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Location</p>
                  <p className="text-white font-medium">{viewGym.location}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      viewGym.status === "active"
                        ? "bg-green-600/20 text-green-600"
                        : "bg-red-600/20 text-red-600"
                    }`}
                  >
                    {viewGym.status}
                  </span>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Contact Person</p>
                  <p className="text-white font-medium">
                    {viewGym.contactPerson}
                  </p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Phone</p>
                  <p className="text-white font-medium">{viewGym.phone}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 md:col-span-2">
                  <p className="text-sm text-gray-400 mb-1">Email</p>
                  <p className="text-white font-medium">{viewGym.email}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 md:col-span-2">
                  <p className="text-sm text-gray-400 mb-1">Address</p>
                  <p className="text-white font-medium">{viewGym.address}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Active Members</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {viewGym.activeMembersCount || 0}
                  </p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Gym ID</p>
                  <code className="text-sm text-white font-mono">
                    {viewGym.id}
                  </code>
                </div>
              </div>

              <button
                onClick={() => setViewGym(null)}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
