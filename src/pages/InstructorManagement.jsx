import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import AdminLayout from "../components/AdminLayout";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Mail,
  Phone,
  Award,
  Search,
} from "lucide-react";

const InstructorManagement = () => {
  const { user: currentUser } = useAuth();

  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [instructorForm, setInstructorForm] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    specialization: "",
    experience: "",
    certification: "",
    bio: "",
    isActive: true,
  });

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs, orderBy } = await import("firebase/firestore");

      const instructorsQuery = query(
        collection(db, "users"),
        where("gymId", "==", currentUser.gymId),
        where("role", "==", "trainer"),
        orderBy("name", "asc")
      );
      const snapshot = await getDocs(instructorsQuery);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setInstructors(data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching instructors:", error);
      setLoading(false);
    }
  };

  const handleOpenModal = (instructor = null) => {
    if (instructor) {
      setEditingInstructor(instructor);
      setInstructorForm({
        name: instructor.name || "",
        email: instructor.email || "",
        phone: instructor.phone || "",
        username: instructor.username || "",
        password: "",
        specialization: instructor.specialization || "",
        experience: instructor.experience || "",
        certification: instructor.certification || "",
        bio: instructor.bio || "",
        isActive: instructor.isActive !== false,
      });
    } else {
      setEditingInstructor(null);
      setInstructorForm({
        name: "",
        email: "",
        phone: "",
        username: "",
        password: "",
        specialization: "",
        experience: "",
        certification: "",
        bio: "",
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSaveInstructor = async (e) => {
    e.preventDefault();

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, doc, updateDoc, Timestamp } = await import("firebase/firestore");
      const { auth } = await import("../config/firebase");
      const { createUserWithEmailAndPassword } = await import("firebase/auth");

      const instructorData = {
        name: instructorForm.name,
        email: instructorForm.email,
        phone: instructorForm.phone,
        specialization: instructorForm.specialization,
        experience: instructorForm.experience,
        certification: instructorForm.certification,
        bio: instructorForm.bio,
        isActive: instructorForm.isActive,
        role: "trainer",
        gymId: currentUser.gymId,
      };

      if (editingInstructor) {
        await updateDoc(doc(db, "users", editingInstructor.id), {
          ...instructorData,
          updatedAt: Timestamp.now(),
        });
        alert("Instructor updated successfully! ✓");
      } else {
        try {
          // Create auth user with provided password
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            instructorForm.email,
            instructorForm.password
          );

          // Add instructor to users collection
          await addDoc(collection(db, "users"), {
            ...instructorData,
            uid: userCredential.user.uid,
            username: instructorForm.username,
            password: instructorForm.password,
            createdAt: Timestamp.now(),
          });

          alert(`Instructor created successfully! 🎉\n\nUsername: ${instructorForm.username}\nPassword: ${instructorForm.password}\n\nPlease share these credentials with the instructor.`);
        } catch (authError) {
          if (authError.code === "auth/email-already-in-use") {
            alert("This email is already registered in the system.");
          } else {
            throw authError;
          }
          return;
        }
      }

      setShowModal(false);
      fetchInstructors();
    } catch (error) {
      console.error("Error saving instructor:", error);
      alert("Failed to save instructor. Please try again.");
    }
  };

  const handleDeleteInstructor = async (id) => {
    if (!confirm("Are you sure you want to delete this instructor? This action cannot be undone.")) {
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "users", id));
      fetchInstructors();
      alert("Instructor deleted successfully.");
    } catch (error) {
      console.error("Error deleting instructor:", error);
      alert("Failed to delete instructor. Please try again.");
    }
  };

  const getFilteredInstructors = () => {
    return instructors.filter((instructor) =>
      instructor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instructor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instructor.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading instructors...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Instructor Management</h1>
              <p className="text-gray-400">Manage gym instructors and trainers</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Add Instructor
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5" />
                <p className="text-sm text-blue-100">Total Instructors</p>
              </div>
              <p className="text-3xl font-bold">{instructors.length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-5 h-5" />
                <p className="text-sm text-green-100">Active Instructors</p>
              </div>
              <p className="text-3xl font-bold">
                {instructors.filter((i) => i.isActive !== false).length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5" />
                <p className="text-sm text-purple-100">Specializations</p>
              </div>
              <p className="text-3xl font-bold">
                {new Set(instructors.map((i) => i.specialization).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search instructors by name, email, or specialization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Instructors List */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          {getFilteredInstructors().length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {getFilteredInstructors().map((instructor) => (
                <div
                  key={instructor.id}
                  className="bg-gray-900 rounded-lg border border-gray-700 p-5 hover:border-blue-500/50 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-lg">
                          {instructor.name?.charAt(0) || "I"}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-white font-bold">{instructor.name}</h3>
                        {instructor.isActive === false && (
                          <span className="text-xs text-gray-500">Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {instructor.specialization && (
                    <div className="mb-3">
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                        {instructor.specialization}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{instructor.email}</span>
                    </div>
                    {instructor.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Phone className="w-4 h-4" />
                        <span>{instructor.phone}</span>
                      </div>
                    )}
                    {instructor.experience && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Award className="w-4 h-4" />
                        <span>{instructor.experience} years experience</span>
                      </div>
                    )}
                  </div>

                  {instructor.bio && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      {instructor.bio}
                    </p>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-gray-700">
                    <button
                      onClick={() => handleOpenModal(instructor)}
                      className="flex-1 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteInstructor(instructor.id)}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👨‍🏫</div>
              <h3 className="text-xl font-bold text-white mb-2">No Instructors Found</h3>
              <p className="text-gray-400 mb-6">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Add your first instructor to get started"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => handleOpenModal()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition"
                >
                  Add First Instructor
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingInstructor ? "Edit Instructor" : "Add New Instructor"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveInstructor} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={instructorForm.name}
                      onChange={(e) =>
                        setInstructorForm({ ...instructorForm, name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={instructorForm.email}
                      onChange={(e) =>
                        setInstructorForm({ ...instructorForm, email: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="instructor@example.com"
                      required
                      disabled={editingInstructor}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={instructorForm.phone}
                      onChange={(e) =>
                        setInstructorForm({ ...instructorForm, phone: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+1234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={instructorForm.username}
                      onChange={(e) =>
                        setInstructorForm({ ...instructorForm, username: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="instructor_username"
                      required
                      disabled={editingInstructor}
                    />
                    {!editingInstructor && (
                      <p className="text-xs text-gray-500 mt-1">
                        Instructor will use this username to log in
                      </p>
                    )}
                  </div>

                  {!editingInstructor && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={instructorForm.password}
                        onChange={(e) =>
                          setInstructorForm({ ...instructorForm, password: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Set instructor password"
                        required
                        minLength="6"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Minimum 6 characters. Share this with the instructor.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Specialization *
                    </label>
                    <input
                      type="text"
                      value={instructorForm.specialization}
                      onChange={(e) =>
                        setInstructorForm({ ...instructorForm, specialization: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Yoga, HIIT, Strength Training"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={instructorForm.experience}
                      onChange={(e) =>
                        setInstructorForm({ ...instructorForm, experience: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="5"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Certifications
                    </label>
                    <input
                      type="text"
                      value={instructorForm.certification}
                      onChange={(e) =>
                        setInstructorForm({ ...instructorForm, certification: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., ACE Certified, NASM CPT"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                    <textarea
                      value={instructorForm.bio}
                      onChange={(e) =>
                        setInstructorForm({ ...instructorForm, bio: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Brief bio about the instructor..."
                      rows="3"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={instructorForm.isActive}
                    onChange={(e) =>
                      setInstructorForm({ ...instructorForm, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-300">
                    Instructor is active and available
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingInstructor ? "Update Instructor" : "Add Instructor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorManagement;
