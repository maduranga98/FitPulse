import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import Sidebar from "../components/Sidebar";
import ExerciseDetailModal from "../components/ExerciseDetailModal";
import { isSuperAdmin } from "../utils/authUtils";
import { useNavigate } from "react-router-dom";

const CommonExercises = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user"));

  // Check super admin access
  useEffect(() => {
    if (!currentUser || !isSuperAdmin(currentUser)) {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const [exercises, setExercises] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    difficulty: "beginner",
    equipment: "",
    sets: 3,
    repsCount: "",
    duration: 0,
    targetedSections: [""],
    steps: [""],
    notes: "",
    photoURLs: [],
    videoURLs: [],
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    icon: "",
    description: "",
  });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Fetch common exercises (no gymId)
  const fetchExercises = async () => {
    setLoading(true);
    try {
      const exercisesRef = collection(db, "exercises");
      const snapshot = await getDocs(exercisesRef);
      const exercisesList = snapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return !data.gymId || data.gymId === null || data.gymId === "";
        })
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      console.log("Super Admin - Common exercises loaded:", exercisesList.length);
      setExercises(exercisesList);
    } catch (error) {
      console.error("Error fetching common exercises:", error);
      alert("Failed to load exercises");
    } finally {
      setLoading(false);
    }
  };

  // Fetch common categories (no gymId)
  const fetchCategories = async () => {
    try {
      const categoriesRef = collection(db, "exerciseCategories");
      const snapshot = await getDocs(categoriesRef);
      const categoriesList = snapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return !data.gymId || data.gymId === null || data.gymId === "";
        })
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      console.log("Super Admin - Common categories loaded:", categoriesList.length);
      setCategories(categoriesList);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  useEffect(() => {
    fetchExercises();
    fetchCategories();
  }, []);

  // Handle file upload
  const handleFileUpload = async (file, type) => {
    const folder = type === "photo" ? "common-exercises/photos" : "common-exercises/videos";
    const maxSize = type === "photo" ? 5 * 1024 * 1024 : 100 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(
        `File size exceeds ${type === "photo" ? "5MB" : "100MB"} limit`
      );
      return;
    }

    const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress((prev) => ({
            ...prev,
            [file.name]: progress,
          }));
        },
        (error) => {
          console.error("Upload error:", error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[file.name];
            return newProgress;
          });
          resolve(downloadURL);
        }
      );
    });
  };

  // Handle photo upload
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);

    try {
      const uploadPromises = files.map((file) => handleFileUpload(file, "photo"));
      const urls = await Promise.all(uploadPromises);
      setFormData((prev) => ({
        ...prev,
        photoURLs: [...prev.photoURLs, ...urls],
      }));
    } catch (error) {
      console.error("Error uploading photos:", error);
      alert("Failed to upload photos");
    } finally {
      setUploading(false);
    }
  };

  // Handle video upload
  const handleVideoUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);

    try {
      const uploadPromises = files.map((file) => handleFileUpload(file, "video"));
      const urls = await Promise.all(uploadPromises);
      setFormData((prev) => ({
        ...prev,
        videoURLs: [...prev.videoURLs, ...urls],
      }));
    } catch (error) {
      console.error("Error uploading videos:", error);
      alert("Failed to upload videos");
    } finally {
      setUploading(false);
    }
  };

  // Add/Update exercise
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.category) {
      alert("Please fill in all required fields");
      return;
    }

    setUploading(true);

    try {
      const categoryData = categories.find((c) => c.id === formData.category);
      const exerciseData = {
        ...formData,
        categoryName: categoryData?.name || "",
        targetedSections: formData.targetedSections.filter((s) => s),
        steps: formData.steps.filter((s) => s),
        photoURLs: formData.photoURLs.filter((url) => url),
        videoURLs: formData.videoURLs.filter((url) => url),
        updatedAt: Timestamp.now(),
      };

      if (editMode && selectedExercise) {
        // Update existing
        await updateDoc(doc(db, "exercises", selectedExercise.id), exerciseData);
        alert("Exercise updated successfully!");
      } else {
        // Add new - NO gymId for common exercises
        exerciseData.createdAt = Timestamp.now();
        await addDoc(collection(db, "exercises"), exerciseData);
        alert("Exercise added successfully!");
      }

      setShowAddModal(false);
      resetForm();
      fetchExercises();
    } catch (error) {
      console.error("Error saving exercise:", error);
      alert("Failed to save exercise");
    } finally {
      setUploading(false);
    }
  };

  // Add category
  const handleAddCategory = async (e) => {
    e.preventDefault();

    if (!categoryFormData.name) {
      alert("Please enter category name");
      return;
    }

    try {
      // Add category without gymId for common categories
      await addDoc(collection(db, "exerciseCategories"), {
        ...categoryFormData,
        createdAt: Timestamp.now(),
      });
      alert("Category added successfully!");
      setShowCategoryModal(false);
      setCategoryFormData({ name: "", icon: "", description: "" });
      fetchCategories();
    } catch (error) {
      console.error("Error adding category:", error);
      alert("Failed to add category");
    }
  };

  // Delete exercise
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this exercise?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "exercises", id));
      alert("Exercise deleted successfully!");
      fetchExercises();
    } catch (error) {
      console.error("Error deleting exercise:", error);
      alert("Failed to delete exercise");
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      difficulty: "beginner",
      equipment: "",
      sets: 3,
      repsCount: "",
      duration: 0,
      targetedSections: [""],
      steps: [""],
      notes: "",
      photoURLs: [],
      videoURLs: [],
    });
    setEditMode(false);
    setSelectedExercise(null);
  };

  // Edit exercise
  const handleEdit = (exercise) => {
    setFormData({
      name: exercise.name,
      category: exercise.category,
      difficulty: exercise.difficulty || "beginner",
      equipment: exercise.equipment || "",
      sets: exercise.sets || 3,
      repsCount: exercise.repsCount || "",
      duration: exercise.duration || 0,
      targetedSections: exercise.targetedSections?.length > 0 ? exercise.targetedSections : [""],
      steps: exercise.steps?.length > 0 ? exercise.steps : [""],
      notes: exercise.notes || "",
      photoURLs: exercise.photoURLs || [],
      videoURLs: exercise.videoURLs || [],
    });
    setSelectedExercise(exercise);
    setEditMode(true);
    setShowAddModal(true);
  };

  // Filter exercises
  const filteredExercises = exercises.filter((exercise) => {
    const matchesCategory =
      selectedCategory === "all" || exercise.category === selectedCategory;
    const matchesSearch = exercise.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Sidebar />
      <div className="flex-1 p-4 sm:p-8 ml-0 sm:ml-64">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Common Exercise Library
          </h1>
          <p className="text-gray-400">
            Manage global exercises available to all gyms
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/50 transition"
          >
            + Add Common Exercise
          </button>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-green-500/50 transition"
          >
            + Add Category
          </button>
        </div>

        {/* Categories Filter */}
        {categories.length > 0 && (
          <div className="mb-6">
            <h3 className="text-white font-medium mb-3">Filter by Category</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedCategory === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                All ({exercises.length})
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedCategory === category.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {category.icon} {category.name} (
                  {exercises.filter((e) => e.category === category.id).length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Exercises Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading exercises...</p>
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
            <p className="text-gray-400">No exercises found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-blue-500 transition group"
              >
                {/* Exercise Image */}
                {exercise.photoURLs?.[0] && (
                  <img
                    src={exercise.photoURLs[0]}
                    alt={exercise.name}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform"
                  />
                )}

                {/* Exercise Info */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {exercise.name}
                  </h3>

                  <div className="flex flex-wrap gap-2 mb-3">
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
                    {exercise.categoryName && (
                      <span className="px-2 py-1 bg-purple-600/20 text-purple-600 rounded text-xs font-medium">
                        {exercise.categoryName}
                      </span>
                    )}
                  </div>

                  {exercise.targetedSections?.length > 0 && (
                    <p className="text-gray-400 text-sm mb-3">
                      🎯{" "}
                      {exercise.targetedSections.slice(0, 2).join(", ")}
                      {exercise.targetedSections.length > 2 &&
                        ` +${exercise.targetedSections.length - 2}`}
                    </p>
                  )}

                  {exercise.sets && exercise.repsCount && (
                    <p className="text-gray-400 text-sm mb-4">
                      {exercise.sets} sets × {exercise.repsCount} reps
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedExercise(exercise);
                        setShowViewModal(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEdit(exercise)}
                      className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exercise.id)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Exercise Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto my-8">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 z-10">
                <h2 className="text-2xl font-bold text-white">
                  {editMode ? "Edit" : "Add"} Common Exercise
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Exercise Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Difficulty, Sets, Reps */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) =>
                        setFormData({ ...formData, difficulty: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Sets
                    </label>
                    <input
                      type="number"
                      value={formData.sets}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sets: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Reps
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 10-12"
                      value={formData.repsCount}
                      onChange={(e) =>
                        setFormData({ ...formData, repsCount: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Equipment & Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Equipment/Machine
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Barbell, Dumbbells"
                      value={formData.equipment}
                      onChange={(e) =>
                        setFormData({ ...formData, equipment: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Targeted Sections */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Target Muscles
                  </label>
                  {formData.targetedSections.map((section, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="e.g., Chest, Biceps"
                        value={section}
                        onChange={(e) => {
                          const newSections = [...formData.targetedSections];
                          newSections[idx] = e.target.value;
                          setFormData({
                            ...formData,
                            targetedSections: newSections,
                          });
                        }}
                        className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      />
                      {formData.targetedSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newSections = formData.targetedSections.filter(
                              (_, i) => i !== idx
                            );
                            setFormData({
                              ...formData,
                              targetedSections: newSections,
                            });
                          }}
                          className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        targetedSections: [...formData.targetedSections, ""],
                      })
                    }
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition"
                  >
                    + Add Muscle
                  </button>
                </div>

                {/* Steps */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Instructions / Steps
                  </label>
                  {formData.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <textarea
                        placeholder={`Step ${idx + 1}`}
                        value={step}
                        onChange={(e) => {
                          const newSteps = [...formData.steps];
                          newSteps[idx] = e.target.value;
                          setFormData({ ...formData, steps: newSteps });
                        }}
                        className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        rows={2}
                      />
                      {formData.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newSteps = formData.steps.filter(
                              (_, i) => i !== idx
                            );
                            setFormData({ ...formData, steps: newSteps });
                          }}
                          className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, steps: [...formData.steps, ""] })
                    }
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition"
                  >
                    + Add Step
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Notes / Warnings
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows={3}
                    placeholder="Any special notes, warnings, or tips..."
                  />
                </div>

                {/* Photos */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Photos
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  />
                  {formData.photoURLs.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {formData.photoURLs.map((url, idx) => (
                        <div key={idx} className="relative">
                          <img
                            src={url}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newURLs = formData.photoURLs.filter(
                                (_, i) => i !== idx
                              );
                              setFormData({ ...formData, photoURLs: newURLs });
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full"
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Videos */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Videos (Upload or paste YouTube links)
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideoUpload}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700 mb-2"
                  />
                  <input
                    type="url"
                    placeholder="Or paste YouTube/video URL"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const url = e.target.value;
                        if (url) {
                          setFormData({
                            ...formData,
                            videoURLs: [...formData.videoURLs, url],
                          });
                          e.target.value = "";
                        }
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  {formData.videoURLs.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {formData.videoURLs.map((url, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-gray-900 p-3 rounded-lg"
                        >
                          <span className="text-white text-sm truncate flex-1">
                            {url}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newURLs = formData.videoURLs.filter(
                                (_, i) => i !== idx
                              );
                              setFormData({ ...formData, videoURLs: newURLs });
                            }}
                            className="ml-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full"
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload Progress */}
                {Object.keys(uploadProgress).length > 0 && (
                  <div className="space-y-2">
                    {Object.entries(uploadProgress).map(([fileName, progress]) => (
                      <div key={fileName}>
                        <div className="flex justify-between text-sm text-gray-400 mb-1">
                          <span>{fileName}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition disabled:opacity-50"
                  >
                    {uploading ? "Saving..." : editMode ? "Update Exercise" : "Add Exercise"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
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

        {/* Add Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                Add Common Category
              </h2>

              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={categoryFormData.name}
                    onChange={(e) =>
                      setCategoryFormData({
                        ...categoryFormData,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Icon (Emoji)
                  </label>
                  <input
                    type="text"
                    placeholder="💪"
                    value={categoryFormData.icon}
                    onChange={(e) =>
                      setCategoryFormData({
                        ...categoryFormData,
                        icon: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Description
                  </label>
                  <textarea
                    value={categoryFormData.description}
                    onChange={(e) =>
                      setCategoryFormData({
                        ...categoryFormData,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg font-medium hover:shadow-lg transition"
                  >
                    Add Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(false)}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Exercise Modal */}
        <ExerciseDetailModal
          exercise={selectedExercise}
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedExercise(null);
          }}
        />
      </div>
    </div>
  );
};

export default CommonExercises;
