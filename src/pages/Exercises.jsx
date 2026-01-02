import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";

const Exercises = ({ onLogout, onNavigate }) => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;
  const [exercises, setExercises] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [viewExercise, setViewExercise] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Form states
  const [exerciseForm, setExerciseForm] = useState({
    name: "",
    category: "",
    steps: [""],
    targetedSections: [""],
    repsCount: "",
    sets: "",
    duration: "",
    difficulty: "beginner",
    equipment: "",
    notes: "",
    photoURLs: [""],
    videoURLs: [""],
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    icon: "💪",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, orderBy, query, where } = await import(
        "firebase/firestore"
      );

      // Fetch categories - ADD WHERE CLAUSE
      const categoriesRef = collection(db, "exerciseCategories");
      const categoriesQuery = currentGymId
        ? query(
            categoriesRef,
            where("gymId", "==", currentGymId),
            orderBy("name", "asc")
          )
        : query(categoriesRef, orderBy("name", "asc"));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch exercises - ADD WHERE CLAUSE
      const exercisesRef = collection(db, "exercises");
      const exercisesQuery = currentGymId
        ? query(
            exercisesRef,
            where("gymId", "==", currentGymId),
            orderBy("name", "asc")
          )
        : query(exercisesRef, orderBy("name", "asc"));
      const exercisesSnapshot = await getDocs(exercisesQuery);
      const exercisesData = exercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setCategories(categoriesData);
      setExercises(exercisesData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleAddExercise = async (e) => {
    e.preventDefault();
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      // Find the selected category to get its name
      const selectedCategory = categories.find(
        (cat) => cat.id === exerciseForm.category
      );

      // Clean up arrays
      const cleanedForm = {
        ...exerciseForm,
        gymId: currentGymId, // ADD THIS LINE
        categoryName: selectedCategory ? selectedCategory.name : "",
        steps: exerciseForm.steps.filter((s) => s.trim() !== ""),
        targetedSections: exerciseForm.targetedSections.filter(
          (t) => t.trim() !== ""
        ),
        photoURLs: exerciseForm.photoURLs.filter((p) => p.trim() !== ""),
        videoURLs: exerciseForm.videoURLs.filter((v) => v.trim() !== ""),
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "exercises"), cleanedForm);

      setShowAddExercise(false);
      setExerciseForm({
        name: "",
        category: "",
        steps: [""],
        targetedSections: [""],
        repsCount: "",
        sets: "",
        duration: "",
        difficulty: "beginner",
        equipment: "",
        notes: "",
        photoURLs: [""],
        videoURLs: [""],
      });
      fetchData();
    } catch (error) {
      console.error("Error adding exercise:", error);
      alert("Failed to add exercise");
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      await addDoc(collection(db, "exerciseCategories"), {
        ...categoryForm,
        gymId: currentGymId,
        createdAt: Timestamp.now(),
      });

      setShowAddCategory(false);
      setCategoryForm({ name: "", description: "", icon: "💪" });
      fetchData();
    } catch (error) {
      console.error("Error adding category:", error);
      alert("Failed to add category");
    }
  };

  const handleEditExercise = (exercise) => {
    setEditingExercise(exercise);
    setExerciseForm({
      name: exercise.name,
      category: exercise.category,
      steps: exercise.steps?.length > 0 ? exercise.steps : [""],
      targetedSections: exercise.targetedSections?.length > 0 ? exercise.targetedSections : [""],
      repsCount: exercise.repsCount || "",
      sets: exercise.sets || "",
      duration: exercise.duration || "",
      difficulty: exercise.difficulty || "beginner",
      equipment: exercise.equipment || "",
      notes: exercise.notes || "",
      photoURLs: exercise.photoURLs?.length > 0 ? exercise.photoURLs : [""],
      videoURLs: exercise.videoURLs?.length > 0 ? exercise.videoURLs : [""],
    });
    setShowAddExercise(true);
  };

  const handleUpdateExercise = async (e) => {
    e.preventDefault();
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc, Timestamp } = await import("firebase/firestore");

      // Find the selected category to get its name
      const selectedCategory = categories.find(
        (cat) => cat.id === exerciseForm.category
      );

      // Clean up arrays
      const cleanedForm = {
        ...exerciseForm,
        gymId: currentGymId,
        categoryName: selectedCategory ? selectedCategory.name : "",
        steps: exerciseForm.steps.filter((s) => s.trim() !== ""),
        targetedSections: exerciseForm.targetedSections.filter(
          (t) => t.trim() !== ""
        ),
        photoURLs: exerciseForm.photoURLs.filter((p) => p.trim() !== ""),
        videoURLs: exerciseForm.videoURLs.filter((v) => v.trim() !== ""),
        updatedAt: Timestamp.now(),
      };

      await updateDoc(doc(db, "exercises", editingExercise.id), cleanedForm);

      setShowAddExercise(false);
      setEditingExercise(null);
      setExerciseForm({
        name: "",
        category: "",
        steps: [""],
        targetedSections: [""],
        repsCount: "",
        sets: "",
        duration: "",
        difficulty: "beginner",
        equipment: "",
        notes: "",
        photoURLs: [""],
        videoURLs: [""],
      });
      fetchData();
    } catch (error) {
      console.error("Error updating exercise:", error);
      alert("Failed to update exercise");
    }
  };

  const handleDeleteExercise = async (id) => {
    if (!confirm("Are you sure you want to delete this exercise?")) return;

    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "exercises", id));
      fetchData();
    } catch (error) {
      console.error("Error deleting exercise:", error);
      alert("Failed to delete exercise");
    }
  };

  const addArrayField = (field) => {
    setExerciseForm((prev) => ({
      ...prev,
      [field]: [...prev[field], ""],
    }));
  };

  const updateArrayField = (field, index, value) => {
    setExerciseForm((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }));
  };

  const removeArrayField = (field, index) => {
    setExerciseForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  // Handle photo file upload
  const handlePhotoUpload = async (e, index) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (jpg, png, gif, etc.)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    try {
      setUploadingFiles(true);
      const { storage } = await import("../config/firebase");
      const { ref, uploadBytesResumable, getDownloadURL } = await import(
        "firebase/storage"
      );

      // Create a unique filename
      const timestamp = Date.now();
      const fileName = `exercises/photos/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);

      // Upload file with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress((prev) => ({
            ...prev,
            [`photo_${index}`]: progress,
          }));
        },
        (error) => {
          console.error("Upload error:", error);
          alert("Failed to upload photo");
          setUploadingFiles(false);
        },
        async () => {
          // Get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Update form with the URL
          updateArrayField("photoURLs", index, downloadURL);

          setUploadingFiles(false);
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[`photo_${index}`];
            return newProgress;
          });
        }
      );
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo");
      setUploadingFiles(false);
    }
  };

  // Handle video file upload
  const handleVideoUpload = async (e, index) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      alert("Please select a video file (mp4, mov, avi, etc.)");
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      alert("File size must be less than 100MB");
      return;
    }

    try {
      setUploadingFiles(true);
      const { storage } = await import("../config/firebase");
      const { ref, uploadBytesResumable, getDownloadURL } = await import(
        "firebase/storage"
      );

      // Create a unique filename
      const timestamp = Date.now();
      const fileName = `exercises/videos/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);

      // Upload file with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress((prev) => ({
            ...prev,
            [`video_${index}`]: progress,
          }));
        },
        (error) => {
          console.error("Upload error:", error);
          alert("Failed to upload video");
          setUploadingFiles(false);
        },
        async () => {
          // Get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Update form with the URL
          updateArrayField("videoURLs", index, downloadURL);

          setUploadingFiles(false);
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[`video_${index}`];
            return newProgress;
          });
        }
      );
    } catch (error) {
      console.error("Error uploading video:", error);
      alert("Failed to upload video");
      setUploadingFiles(false);
    }
  };

  const filteredExercises = exercises.filter((exercise) => {
    const matchesCategory =
      selectedCategory === "all" || exercise.category === selectedCategory;
    const matchesSearch =
      exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.targetedSections?.some((s) =>
        s.toLowerCase().includes(searchTerm.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("gymUser");
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading exercises...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
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
                Exercises
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddCategory(true)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition hidden sm:flex items-center gap-2"
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
                Category
              </button>
              <button
                onClick={() => setShowAddExercise(true)}
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
                <span className="hidden sm:inline">Add Exercise</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Search and Filter */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search exercises..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Categories Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`p-4 rounded-xl border transition ${
                selectedCategory === "all"
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
              }`}
            >
              <div className="text-2xl mb-2">📋</div>
              <div className="text-sm font-medium">All</div>
              <div className="text-xs mt-1">{exercises.length} exercises</div>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-4 rounded-xl border transition ${
                  selectedCategory === cat.id
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div className="text-2xl mb-2">{cat.icon}</div>
                <div className="text-sm font-medium truncate">{cat.name}</div>
                <div className="text-xs mt-1">
                  {exercises.filter((e) => e.category === cat.id).length}{" "}
                  exercises
                </div>
              </button>
            ))}
          </div>

          {/* Exercises Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExercises.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400 text-lg">No exercises found</p>
                <button
                  onClick={() => setShowAddExercise(true)}
                  className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Add Your First Exercise
                </button>
              </div>
            ) : (
              filteredExercises.map((exercise) => {
                const category = categories.find(
                  (c) => c.id === exercise.category
                );
                return (
                  <div
                    key={exercise.id}
                    className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition"
                  >
                    {exercise.photoURLs?.[0] && (
                      <div className="h-48 bg-gray-900 overflow-hidden">
                        <img
                          src={exercise.photoURLs[0]}
                          alt={exercise.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            {exercise.name}
                          </h3>
                          {category && (
                            <span className="text-xs text-gray-400">
                              {category.icon} {category.name}
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            exercise.difficulty === "beginner"
                              ? "bg-green-600/20 text-green-600"
                              : exercise.difficulty === "intermediate"
                              ? "bg-yellow-600/20 text-yellow-600"
                              : "bg-red-600/20 text-red-600"
                          }`}
                        >
                          {exercise.difficulty}
                        </span>
                      </div>

                      {exercise.targetedSections?.length > 0 && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-2">
                            {exercise.targetedSections
                              .slice(0, 3)
                              .map((section, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-blue-600/20 text-blue-600 text-xs rounded"
                                >
                                  {section}
                                </span>
                              ))}
                            {exercise.targetedSections.length > 3 && (
                              <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded">
                                +{exercise.targetedSections.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                        {exercise.sets && exercise.repsCount && (
                          <span>
                            {exercise.sets} × {exercise.repsCount}
                          </span>
                        )}
                        {exercise.duration && (
                          <span>{exercise.duration} min</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewExercise(exercise)}
                          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEditExercise(exercise)}
                          className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-600 rounded-lg text-sm font-medium transition"
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteExercise(exercise.id)}
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
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Add Exercise Modal */}
      {showAddExercise && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {editingExercise ? "Edit Exercise" : "Add New Exercise"}
              </h2>
              <button
                onClick={() => {
                  setShowAddExercise(false);
                  setEditingExercise(null);
                  setExerciseForm({
                    name: "",
                    category: "",
                    steps: [""],
                    targetedSections: [""],
                    repsCount: "",
                    sets: "",
                    duration: "",
                    difficulty: "beginner",
                    equipment: "",
                    notes: "",
                    photoURLs: [""],
                    videoURLs: [""],
                  });
                }}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Exercise Name *
                  </label>
                  <input
                    type="text"
                    value={exerciseForm.name}
                    onChange={(e) =>
                      setExerciseForm({ ...exerciseForm, name: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Bench Press"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={exerciseForm.category}
                    onChange={(e) =>
                      setExerciseForm({
                        ...exerciseForm,
                        category: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={exerciseForm.difficulty}
                    onChange={(e) =>
                      setExerciseForm({
                        ...exerciseForm,
                        difficulty: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Equipment
                  </label>
                  <input
                    type="text"
                    value={exerciseForm.equipment}
                    onChange={(e) =>
                      setExerciseForm({
                        ...exerciseForm,
                        equipment: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Barbell, Dumbbells"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sets
                  </label>
                  <input
                    type="number"
                    value={exerciseForm.sets}
                    onChange={(e) =>
                      setExerciseForm({ ...exerciseForm, sets: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reps Count
                  </label>
                  <input
                    type="text"
                    value={exerciseForm.repsCount}
                    onChange={(e) =>
                      setExerciseForm({
                        ...exerciseForm,
                        repsCount: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 10-12"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={exerciseForm.duration}
                    onChange={(e) =>
                      setExerciseForm({
                        ...exerciseForm,
                        duration: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 30"
                  />
                </div>

                {/* Targeted Sections */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Targeted Sections
                  </label>
                  {exerciseForm.targetedSections.map((section, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={section}
                        onChange={(e) =>
                          updateArrayField(
                            "targetedSections",
                            idx,
                            e.target.value
                          )
                        }
                        className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Chest, Triceps"
                      />
                      {exerciseForm.targetedSections.length > 1 && (
                        <button
                          onClick={() =>
                            removeArrayField("targetedSections", idx)
                          }
                          className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg"
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
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayField("targetedSections")}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1"
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
                    Add More
                  </button>
                </div>

                {/* Steps */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Steps
                  </label>
                  {exerciseForm.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <div className="flex items-center justify-center w-8 h-10 bg-gray-900 rounded-lg text-gray-400 text-sm font-medium">
                        {idx + 1}
                      </div>
                      <textarea
                        value={step}
                        onChange={(e) =>
                          updateArrayField("steps", idx, e.target.value)
                        }
                        className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Describe this step..."
                        rows="2"
                      />
                      {exerciseForm.steps.length > 1 && (
                        <button
                          onClick={() => removeArrayField("steps", idx)}
                          className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg"
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
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayField("steps")}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1"
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
                    Add Step
                  </button>
                </div>

                {/* Photo URLs */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Photos
                  </label>
                  {exerciseForm.photoURLs.map((url, idx) => (
                    <div key={idx} className="mb-3">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) =>
                            updateArrayField("photoURLs", idx, e.target.value)
                          }
                          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://example.com/image.jpg"
                        />
                        {exerciseForm.photoURLs.length > 1 && (
                          <button
                            onClick={() => removeArrayField("photoURLs", idx)}
                            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg"
                            type="button"
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
                          </button>
                        )}
                      </div>

                      {/* File Upload Button */}
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handlePhotoUpload(e, idx)}
                            className="hidden"
                            disabled={uploadingFiles}
                          />
                          <div className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-600 rounded-lg text-sm font-medium transition inline-flex items-center gap-2">
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
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            Upload from Device
                          </div>
                        </label>

                        {/* Progress Bar */}
                        {uploadProgress[`photo_${idx}`] !== undefined && (
                          <div className="flex-1">
                            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-blue-600 h-full transition-all duration-300"
                                style={{
                                  width: `${uploadProgress[`photo_${idx}`]}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 mt-1">
                              {Math.round(uploadProgress[`photo_${idx}`])}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Preview */}
                      {url && (
                        <div className="mt-2">
                          <img
                            src={url}
                            alt="Preview"
                            className="w-full h-32 object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayField("photoURLs")}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1"
                    type="button"
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
                    Add Photo
                  </button>
                </div>

                {/* Video URLs */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Videos
                  </label>
                  {exerciseForm.videoURLs.map((url, idx) => (
                    <div key={idx} className="mb-3">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) =>
                            updateArrayField("videoURLs", idx, e.target.value)
                          }
                          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://youtube.com/watch?v=... or upload file"
                        />
                        {exerciseForm.videoURLs.length > 1 && (
                          <button
                            onClick={() => removeArrayField("videoURLs", idx)}
                            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded-lg"
                            type="button"
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
                          </button>
                        )}
                      </div>

                      {/* File Upload Button */}
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => handleVideoUpload(e, idx)}
                            className="hidden"
                            disabled={uploadingFiles}
                          />
                          <div className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-600 rounded-lg text-sm font-medium transition inline-flex items-center gap-2">
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
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            Upload from Device
                          </div>
                        </label>

                        {/* Progress Bar */}
                        {uploadProgress[`video_${idx}`] !== undefined && (
                          <div className="flex-1">
                            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-purple-600 h-full transition-all duration-300"
                                style={{
                                  width: `${uploadProgress[`video_${idx}`]}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 mt-1">
                              {Math.round(uploadProgress[`video_${idx}`])}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Video Preview */}
                      {url && url.startsWith("https://") && (
                        <div className="mt-2">
                          <video
                            src={url}
                            className="w-full h-48 rounded-lg bg-gray-900"
                            controls
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayField("videoURLs")}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1"
                    type="button"
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
                    Add Video
                  </button>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Special Notes
                  </label>
                  <textarea
                    value={exerciseForm.notes}
                    onChange={(e) =>
                      setExerciseForm({
                        ...exerciseForm,
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Any special instructions or notes..."
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={editingExercise ? handleUpdateExercise : handleAddExercise}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  {editingExercise ? "Update Exercise" : "Add Exercise"}
                </button>
                <button
                  onClick={() => {
                    setShowAddExercise(false);
                    setEditingExercise(null);
                    setExerciseForm({
                      name: "",
                      category: "",
                      steps: [""],
                      targetedSections: [""],
                      repsCount: "",
                      sets: "",
                      duration: "",
                      difficulty: "beginner",
                      equipment: "",
                      notes: "",
                      photoURLs: [""],
                      videoURLs: [""],
                    });
                  }}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md">
            <div className="border-b border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Add Category</h2>
              <button
                onClick={() => setShowAddCategory(false)}
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

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Chest Exercises"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Icon (Emoji)
                </label>
                <input
                  type="text"
                  value={categoryForm.icon}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, icon: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="💪"
                  maxLength="2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Brief description of this category..."
                  rows="3"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddCategory}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Add Category
                </button>
                <button
                  onClick={() => setShowAddCategory(false)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Exercise Modal */}
      {viewExercise && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {viewExercise.name}
              </h2>
              <button
                onClick={() => setViewExercise(null)}
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
              {/* Images */}
              {viewExercise.photoURLs?.filter((url) => url).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">Images</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {viewExercise.photoURLs
                      .filter((url) => url)
                      .map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`${viewExercise.name} ${idx + 1}`}
                          className="w-full h-64 object-cover rounded-lg"
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Videos */}

              {viewExercise.videoURLs?.filter((url) => url).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">Videos</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {viewExercise.videoURLs
                      .filter((url) => url)
                      .map((url, idx) => (
                        <div key={idx}>
                          {url.includes("firebase") ||
                          url.includes("storage.googleapis.com") ? (
                            // Uploaded video
                            <video
                              src={url}
                              className="w-full rounded-lg bg-gray-900"
                              controls
                            />
                          ) : (
                            // External video link
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-3 bg-gray-900 rounded-lg text-blue-600 hover:text-blue-500 transition"
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
                                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Video {idx + 1}
                            </a>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {/* Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Category</div>
                  <div className="text-white font-medium">
                    {
                      categories.find((c) => c.id === viewExercise.category)
                        ?.icon
                    }{" "}
                    {categories.find((c) => c.id === viewExercise.category)
                      ?.name || "N/A"}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Difficulty</div>
                  <div className="text-white font-medium capitalize">
                    {viewExercise.difficulty}
                  </div>
                </div>
                {viewExercise.equipment && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Equipment</div>
                    <div className="text-white font-medium">
                      {viewExercise.equipment}
                    </div>
                  </div>
                )}
                {viewExercise.sets && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Sets</div>
                    <div className="text-white font-medium">
                      {viewExercise.sets}
                    </div>
                  </div>
                )}
                {viewExercise.repsCount && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Reps</div>
                    <div className="text-white font-medium">
                      {viewExercise.repsCount}
                    </div>
                  </div>
                )}
                {viewExercise.duration && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Duration</div>
                    <div className="text-white font-medium">
                      {viewExercise.duration} min
                    </div>
                  </div>
                )}
              </div>

              {/* Targeted Sections */}
              {viewExercise.targetedSections?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">
                    Targeted Sections
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {viewExercise.targetedSections.map((section, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-2 bg-blue-600/20 text-blue-600 rounded-lg font-medium"
                      >
                        {section}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps */}
              {viewExercise.steps?.filter((s) => s).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">Steps</h3>
                  <div className="space-y-3">
                    {viewExercise.steps
                      .filter((s) => s)
                      .map((step, idx) => (
                        <div key={idx} className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1 pt-1">
                            <p className="text-gray-300">{step}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewExercise.notes && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">
                    Special Notes
                  </h3>
                  <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-4">
                    <p className="text-yellow-600">{viewExercise.notes}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setViewExercise(null)}
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

export default Exercises;
