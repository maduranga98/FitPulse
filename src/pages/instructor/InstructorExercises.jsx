import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import {
  Dumbbell,
  ArrowLeft,
  Search,
  Plus,
  X,
  Save,
  Eye,
  UserPlus,
  Filter,
  Trash2,
  Edit2,
} from "lucide-react";

const InstructorExercises = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentGymId = user?.gymId;

  // State management
  const [exercises, setExercises] = useState([]);
  const [commonExercises, setCommonExercises] = useState([]); // All common exercises
  const [selectedCommonIds, setSelectedCommonIds] = useState([]); // Selected exercise IDs
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [browseSearchTerm, setBrowseSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [browseSelectedCategory, setBrowseSelectedCategory] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBrowseModal, setShowBrowseModal] = useState(false); // Browse common exercises
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Form state for creating exercise
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

  useEffect(() => {
    if (currentGymId && user?.id) {
      fetchData();
    }
  }, [currentGymId, user?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, orderBy, query, where } = await import(
        "firebase/firestore"
      );

      // Fetch categories
      const categoriesSnapshot = await getDocs(
        query(
          collection(db, "exerciseCategories"),
          orderBy("name", "asc")
        )
      );
      const categoriesData = categoriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch gym exercises (instructor's custom exercises)
      const gymExercisesSnapshot = await getDocs(
        query(
          collection(db, "gym_exercises"),
          where("gymId", "==", currentGymId),
          orderBy("name", "asc")
        )
      );
      const gymExercisesData = gymExercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        source: "gym",
      }));

      // Fetch ALL common exercises (for browse modal)
      const allCommonExercisesSnapshot = await getDocs(
        query(collection(db, "exercises"), orderBy("name", "asc"))
      );
      const allCommonExercisesData = allCommonExercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        source: "common",
      }));

      // Fetch instructor's selected common exercises (optional - may not exist yet)
      let selectedIds = [];
      try {
        const selectionsSnapshot = await getDocs(
          query(
            collection(db, "instructor_exercise_selections"),
            where("instructorId", "==", user.id),
            where("gymId", "==", currentGymId)
          )
        );
        selectedIds = selectionsSnapshot.docs.map((doc) => doc.data().exerciseId);
      } catch (selectionError) {
        console.log("No selections found or index missing:", selectionError.message);
        // Continue without selections - this is okay for first-time users
      }

      // Filter selected common exercises for main display
      const selectedCommonExercises = allCommonExercisesData.filter(ex => 
        selectedIds.includes(ex.id)
      );

      // Combine gym exercises with selected common exercises for main view
      const allExercises = [...gymExercisesData, ...selectedCommonExercises];

      // Fetch active members
      const membersSnapshot = await getDocs(
        query(
          collection(db, "members"),
          where("gymId", "==", currentGymId),
          where("status", "==", "active")
        )
      );
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setCategories(categoriesData);
      setExercises(allExercises);
      setCommonExercises(allCommonExercisesData); // All common for browsing
      setSelectedCommonIds(selectedIds);
      setMembers(membersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert(`Error loading exercises: ${error.message}. Please check the console for details.`);
      setLoading(false);
    }
  };

  const handleCreateExercise = async (e) => {
    e.preventDefault();

    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      const exerciseData = {
        ...exerciseForm,
        gymId: currentGymId,
        createdBy: user.id,
        createdByName: user.name,
        createdAt: Timestamp.now(),
        repsCount: parseInt(exerciseForm.repsCount) || null,
        sets: parseInt(exerciseForm.sets) || null,
        duration: parseInt(exerciseForm.duration) || null,
      };

      await addDoc(collection(db, "gym_exercises"), exerciseData);

      alert("Exercise created successfully! 🎉");
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error creating exercise:", error);
      alert("Failed to create exercise. Please try again.");
    }
  };

  const handleAssignExercise = async () => {
    if (selectedMembers.length === 0) {
      alert("Please select at least one member");
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      const promises = selectedMembers.map((memberId) =>
        addDoc(collection(db, "exercise_assignments"), {
          exerciseId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          memberId: memberId,
          memberName: members.find((m) => m.id === memberId)?.name,
          assignedBy: user.id,
          assignedByName: user.name,
          gymId: currentGymId,
          assignedAt: Timestamp.now(),
          status: "pending",
          completedAt: null,
        })
      );

      await Promise.all(promises);
      alert(
        `Exercise assigned to ${selectedMembers.length} member(s) successfully! 🎉`
      );
      setShowAssignModal(false);
      setSelectedMembers([]);
    } catch (error) {
      console.error("Error assigning exercise:", error);
      alert("Failed to assign exercise. Please try again.");
    }
  };

  const handleToggleSelection = async (exerciseId) => {
    try {
      const { db } = await import("../../config/firebase");
      const {
        collection,
        addDoc,
        deleteDoc,
        getDocs,
        query,
        where,
        Timestamp,
      } = await import("firebase/firestore");

      const isSelected = selectedCommonIds.includes(exerciseId);
      const selectionsRef = collection(db, "instructor_exercise_selections");

      if (isSelected) {
        // Deselect - remove from selections
        const q = query(
          selectionsRef,
          where("instructorId", "==", user.id),
          where("gymId", "==", currentGymId),
          where("exerciseId", "==", exerciseId)
        );
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        setSelectedCommonIds((prev) => prev.filter((id) => id !== exerciseId));
        
        // Remove from exercises list
        setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
      } else {
        // Select - add to selections
        await addDoc(selectionsRef, {
          instructorId: user.id,
          gymId: currentGymId,
          exerciseId: exerciseId,
          selectedAt: Timestamp.now(),
        });

        setSelectedCommonIds((prev) => [...prev, exerciseId]);
        
        // Add to exercises list
        const selectedExercise = commonExercises.find(ex => ex.id === exerciseId);
        if (selectedExercise) {
          setExercises((prev) => [...prev, selectedExercise]);
        }
      }
    } catch (error) {
      console.error("Error toggling selection:", error);
      alert("Failed to update selection. Please try again.");
    }
  };

  const resetForm = () => {
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
  };

  const addStep = () => {
    setExerciseForm({
      ...exerciseForm,
      steps: [...exerciseForm.steps, ""],
    });
  };

  const removeStep = (index) => {
    const newSteps = exerciseForm.steps.filter((_, i) => i !== index);
    setExerciseForm({ ...exerciseForm, steps: newSteps });
  };

  const updateStep = (index, value) => {
    const newSteps = [...exerciseForm.steps];
    newSteps[index] = value;
    setExerciseForm({ ...exerciseForm, steps: newSteps });
  };

  const addTargetedSection = () => {
    setExerciseForm({
      ...exerciseForm,
      targetedSections: [...exerciseForm.targetedSections, ""],
    });
  };

  const removeTargetedSection = (index) => {
    const newSections = exerciseForm.targetedSections.filter(
      (_, i) => i !== index
    );
    setExerciseForm({ ...exerciseForm, targetedSections: newSections });
  };

  const updateTargetedSection = (index, value) => {
    const newSections = [...exerciseForm.targetedSections];
    newSections[index] = value;
    setExerciseForm({ ...exerciseForm, targetedSections: newSections });
  };

  const getFilteredExercises = () => {
    return exercises.filter((exercise) => {
      const matchesSearch =
        exercise.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exercise.equipment?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Handle both ID-based and name-based categories
      const matchesCategory = selectedCategory === "all" || 
        exercise.category === selectedCategory || 
        categories.find(cat => cat.id === exercise.category)?.name === selectedCategory ||
        categories.find(cat => cat.name === exercise.category)?.id === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-600/20 text-green-600 border-green-600/50";
      case "intermediate":
        return "bg-yellow-600/20 text-yellow-600 border-yellow-600/50";
      case "advanced":
        return "bg-red-600/20 text-red-600 border-red-600/50";
      default:
        return "bg-gray-600/20 text-gray-600 border-gray-600/50";
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading exercises...</p>
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
          <button
            onClick={() => navigate("/instructor-dashboard")}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Exercises</h1>
              <p className="text-gray-400">
                Browse exercises and assign them to your members
              </p>
            </div>
            <div className="flex gap-3">
            <button
              onClick={() => setShowBrowseModal(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Browse Library
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Exercise
            </button>
          </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
            <p className="text-blue-100 text-sm mb-1">Total Exercises</p>
            <p className="text-3xl font-bold">{exercises.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white">
            <p className="text-green-100 text-sm mb-1">Active Members</p>
            <p className="text-3xl font-bold">{members.length}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 text-white">
            <p className="text-purple-100 text-sm mb-1">Categories</p>
            <p className="text-3xl font-bold">{categories.length}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Exercises Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getFilteredExercises().length > 0 ? (
            getFilteredExercises().map((exercise) => {
              // Get category name from ID if needed
              const categoryName = categories.find(cat => cat.id === exercise.category)?.name || exercise.category || "Uncategorized";
              const categoryIcon = categories.find(cat => cat.id === exercise.category)?.icon || categories.find(cat => cat.name === exercise.category)?.icon || "💪";
              
              return (
              <div
                key={exercise.id}
                className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-blue-500/50 transition"
              >
                {/* Image */}
                {exercise.photoURLs && exercise.photoURLs[0] && exercise.photoURLs[0] !== "" && (
                  <div className="w-full h-48 bg-gray-900 overflow-hidden">
                    <img
                      src={exercise.photoURLs[0]}
                      alt={exercise.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg mb-1">
                        {exercise.name}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {categoryIcon} {categoryName}
                      </p>
                    </div>
                    {exercise.source === "gym" && (
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-600 text-xs rounded border border-blue-600/50">
                        Custom
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    {exercise.sets && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Sets:</span>
                        <span className="text-white font-medium">
                          {exercise.sets}
                        </span>
                      </div>
                    )}
                    {exercise.repsCount && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Reps:</span>
                        <span className="text-white font-medium">
                          {exercise.repsCount}
                        </span>
                      </div>
                    )}
                    {exercise.difficulty && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs rounded border ${getDifficultyColor(
                            exercise.difficulty
                          )}`}
                        >
                          {exercise.difficulty}
                        </span>
                      </div>
                    )}
                    
                    {/* Targeted Muscles */}
                    {exercise.targetedSections && exercise.targetedSections.length > 0 && exercise.targetedSections[0] !== "" && (
                      <div className="pt-2">
                        <p className="text-gray-500 text-xs mb-1">Targets:</p>
                        <div className="flex flex-wrap gap-1">
                          {exercise.targetedSections.slice(0, 3).map((muscle, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-purple-600/20 text-purple-400 text-xs rounded"
                            >
                              {muscle}
                            </span>
                          ))}
                          {exercise.targetedSections.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                              +{exercise.targetedSections.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedExercise(exercise);
                        setShowViewModal(true);
                      }}
                      className="flex-1 py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button
                      onClick={() => {
                        setSelectedExercise(exercise);
                        setSelectedMembers([]);
                        setShowAssignModal(true);
                      }}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      Assign
                    </button>
                  </div>
                </div>
              </div>
            );
            })
          ) : (
            <div className="col-span-full text-center py-12">
              <Dumbbell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                No Exercises Found
              </h3>
              <p className="text-gray-400 mb-6">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Create your first exercise to get started"}
              </p>
            </div>
          )}
        </div>


        {/* Browse Common Exercises Modal */}
        {showBrowseModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <div>
                  <h2 className="text-2xl font-bold text-white">Browse Exercise Library</h2>
                  <p className="text-gray-400 text-sm mt-1">Select exercises to add to your collection ({selectedCommonIds.length} selected)</p>
                </div>
                <button onClick={() => setShowBrowseModal(false)} className="text-gray-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 border-b border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" placeholder="Search exercises..." value={browseSearchTerm} onChange={(e) => setBrowseSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <select value={browseSelectedCategory} onChange={(e) => setBrowseSelectedCategory(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="all">All Categories</option>
                      {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {commonExercises.filter((ex) => {
                    const matchesSearch = ex.name?.toLowerCase().includes(browseSearchTerm.toLowerCase()) || ex.equipment?.toLowerCase().includes(browseSearchTerm.toLowerCase());
                    const matchesCategory = browseSelectedCategory === "all" || ex.category === browseSelectedCategory || categories.find(cat => cat.id === ex.category)?.name === browseSelectedCategory;
                    return matchesSearch && matchesCategory;
                  }).map((exercise) => {
                    const isSelected = selectedCommonIds.includes(exercise.id);
                    const categoryName = categories.find(cat => cat.id === exercise.category)?.name || exercise.category || "Uncategorized";
                    const categoryIcon = categories.find(cat => cat.id === exercise.category)?.icon || "💪";
                    return (
                      <div key={exercise.id} className={`bg-gray-900 rounded-lg border p-4 transition ${isSelected ? "border-purple-500 bg-purple-900/20" : "border-gray-700 hover:border-gray-600"}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-white font-bold text-sm mb-1">{exercise.name}</h3>
                            <p className="text-gray-400 text-xs">{categoryIcon} {categoryName}</p>
                          </div>
                          {isSelected && <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">✓</span>}
                        </div>
                        {exercise.difficulty && (
                          <div className="mb-3">
                            <span className={`px-2 py-0.5 text-xs rounded border ${getDifficultyColor(exercise.difficulty)}`}>
                              {exercise.difficulty}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedExercise(exercise);
                              setShowViewModal(true);
                            }}
                            className="flex-1 py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleToggleSelection(exercise.id)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                              isSelected
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-purple-600 hover:bg-purple-700 text-white"
                            }`}
                          >
                            {isSelected ? "Remove" : "Select"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex items-center justify-between">
                <div className="text-gray-400 text-sm">{selectedCommonIds.length} exercise(s) selected</div>
                <button onClick={() => setShowBrowseModal(false)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition">Done</button>
              </div>
            </div>
          </div>
        )}

        {/* Create Exercise Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Create Exercise
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateExercise} className="space-y-4">
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
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Bench Press"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Difficulty *
                    </label>
                    <select
                      value={exerciseForm.difficulty}
                      onChange={(e) =>
                        setExerciseForm({
                          ...exerciseForm,
                          difficulty: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sets
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={exerciseForm.sets}
                      onChange={(e) =>
                        setExerciseForm({
                          ...exerciseForm,
                          sets: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Reps
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={exerciseForm.repsCount}
                      onChange={(e) =>
                        setExerciseForm({
                          ...exerciseForm,
                          repsCount: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={exerciseForm.duration}
                      onChange={(e) =>
                        setExerciseForm({
                          ...exerciseForm,
                          duration: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="20"
                    />
                  </div>
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
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Barbell, Dumbbells"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">
                      Steps
                    </label>
                    <button
                      type="button"
                      onClick={addStep}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      + Add Step
                    </button>
                  </div>
                  <div className="space-y-2">
                    {exerciseForm.steps.map((step, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={step}
                          onChange={(e) => updateStep(index, e.target.value)}
                          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={`Step ${index + 1}`}
                        />
                        {exerciseForm.steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="p-2 text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">
                      Targeted Muscle Groups
                    </label>
                    <button
                      type="button"
                      onClick={addTargetedSection}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      + Add Muscle
                    </button>
                  </div>
                  <div className="space-y-2">
                    {exerciseForm.targetedSections.map((section, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={section}
                          onChange={(e) =>
                            updateTargetedSection(index, e.target.value)
                          }
                          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Chest, Biceps"
                        />
                        {exerciseForm.targetedSections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTargetedSection(index)}
                            className="p-2 text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={exerciseForm.notes}
                    onChange={(e) =>
                      setExerciseForm({ ...exerciseForm, notes: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes or tips..."
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Create Exercise
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Exercise Modal */}
        {showAssignModal && selectedExercise && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Assign "{selectedExercise.name}" to Members
                </h2>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {members.length > 0 ? (
                  members.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-700 transition"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMembers([...selectedMembers, member.id]);
                          } else {
                            setSelectedMembers(
                              selectedMembers.filter((id) => id !== member.id)
                            );
                          }
                        }}
                        className="w-5 h-5 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">{member.name}</p>
                        <p className="text-sm text-gray-400">{member.email}</p>
                      </div>
                    </label>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No active members found</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignExercise}
                  disabled={selectedMembers.length === 0}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign to {selectedMembers.length} Member(s)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Exercise Modal */}
        {showViewModal && selectedExercise && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {selectedExercise.name}
                </h2>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Images */}
              {selectedExercise.photoURLs && selectedExercise.photoURLs.length > 0 && selectedExercise.photoURLs[0] !== "" && (
                <div className="mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedExercise.photoURLs.filter(url => url && url !== "").map((url, index) => (
                      <div key={index} className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                        <img
                          src={url}
                          alt={`${selectedExercise.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.parentElement.style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Videos */}
              {selectedExercise.videoURLs && selectedExercise.videoURLs.length > 0 && selectedExercise.videoURLs[0] !== "" && (
                <div className="mb-6">
                  <p className="text-gray-400 text-sm mb-2">Exercise Videos</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedExercise.videoURLs.filter(url => url && url !== "").map((url, index) => (
                      <div key={index} className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                        <video
                          src={url}
                          controls
                          className="w-full h-full"
                          onError={(e) => {
                            e.target.parentElement.style.display = 'none';
                          }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Category</p>
                  <p className="text-white">
                    {categories.find(cat => cat.id === selectedExercise.category)?.name || selectedExercise.category || "Uncategorized"}
                  </p>
                </div>

                {selectedExercise.difficulty && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Difficulty</p>
                    <span
                      className={`inline-block px-3 py-1 text-sm rounded border ${getDifficultyColor(
                        selectedExercise.difficulty
                      )}`}
                    >
                      {selectedExercise.difficulty}
                    </span>
                  </div>
                )}

                {selectedExercise.equipment && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Equipment</p>
                    <p className="text-white">{selectedExercise.equipment}</p>
                  </div>
                )}

                {(selectedExercise.sets ||
                  selectedExercise.repsCount ||
                  selectedExercise.duration) && (
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Details</p>
                    <div className="flex gap-4">
                      {selectedExercise.sets && (
                        <div className="bg-gray-900 px-4 py-2 rounded">
                          <p className="text-gray-400 text-xs">Sets</p>
                          <p className="text-white font-bold">
                            {selectedExercise.sets}
                          </p>
                        </div>
                      )}
                      {selectedExercise.repsCount && (
                        <div className="bg-gray-900 px-4 py-2 rounded">
                          <p className="text-gray-400 text-xs">Reps</p>
                          <p className="text-white font-bold">
                            {selectedExercise.repsCount}
                          </p>
                        </div>
                      )}
                      {selectedExercise.duration && (
                        <div className="bg-gray-900 px-4 py-2 rounded">
                          <p className="text-gray-400 text-xs">Duration</p>
                          <p className="text-white font-bold">
                            {selectedExercise.duration} min
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedExercise.targetedSections &&
                  selectedExercise.targetedSections.length > 0 &&
                  selectedExercise.targetedSections[0] !== "" && (
                    <div>
                      <p className="text-gray-400 text-sm mb-2">
                        Targeted Muscles
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedExercise.targetedSections.map(
                          (section, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-purple-600/20 text-purple-600 text-sm rounded border border-purple-600/50"
                            >
                              {section}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {selectedExercise.steps &&
                  selectedExercise.steps.length > 0 &&
                  selectedExercise.steps[0] !== "" && (
                    <div>
                      <p className="text-gray-400 text-sm mb-2">Steps</p>
                      <ol className="list-decimal list-inside space-y-2">
                        {selectedExercise.steps.map((step, index) => (
                          <li key={index} className="text-white">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                {selectedExercise.notes && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Notes</p>
                    <p className="text-white">{selectedExercise.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorExercises;
