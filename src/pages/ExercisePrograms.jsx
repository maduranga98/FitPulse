import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import ExerciseDetailModal from "../components/ExerciseDetailModal";

const ExercisePrograms = () => {
  const { user } = useAuth();
  const currentGymId = user?.gymId;

  const [programs, setPrograms] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [commonExercises, setCommonExercises] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [viewProgram, setViewProgram] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    level: "beginner",
    duration: "",
    exercises: [],
  });

  // Fetch programs
  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const programsRef = collection(db, "exercisePrograms");
      const q = query(
        programsRef,
        where("gymId", "==", currentGymId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const programsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPrograms(programsList);
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch exercises
  const fetchExercises = async () => {
    try {
      // Fetch gym-specific exercises from gym_exercises collection
      const gymExercisesRef = collection(db, "gym_exercises");
      const gymQuery = query(
        gymExercisesRef,
        where("gymId", "==", currentGymId),
        orderBy("name", "asc")
      );
      const gymSnapshot = await getDocs(gymQuery);
      const exercisesList = gymSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setExercises(exercisesList);

      // Fetch common exercises (no gymId) from exercises collection
      const commonExercisesRef = collection(db, "exercises");
      const commonSnapshot = await getDocs(commonExercisesRef);
      const commonExercisesList = commonSnapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return !data.gymId || data.gymId === null || data.gymId === "";
        })
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          isCommon: true,
        }));
      console.log("Programs - Common exercises loaded:", commonExercisesList.length);
      setCommonExercises(commonExercisesList);
    } catch (error) {
      console.error("Error fetching exercises:", error);
    }
  };

  useEffect(() => {
    fetchPrograms();
    fetchExercises();
  }, []);

  // Add exercise to program
  const handleAddExerciseToProgram = (exerciseId) => {
    if (!formData.exercises.find((e) => e.exerciseId === exerciseId)) {
      setFormData({
        ...formData,
        exercises: [
          ...formData.exercises,
          {
            exerciseId,
            sets: 3,
            reps: "10-12",
            rest: "60",
            notes: "",
          },
        ],
      });
    }
  };

  // Remove exercise from program
  const handleRemoveExercise = (index) => {
    const newExercises = formData.exercises.filter((_, i) => i !== index);
    setFormData({ ...formData, exercises: newExercises });
  };

  // Update exercise details in program
  const handleUpdateExercise = (index, field, value) => {
    const newExercises = [...formData.exercises];
    newExercises[index][field] = value;
    setFormData({ ...formData, exercises: newExercises });
  };

  // Submit program
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || formData.exercises.length === 0) {
      alert("Please provide a name and add at least one exercise");
      return;
    }

    try {
      const programData = {
        ...formData,
        gymId: currentGymId,
        updatedAt: Timestamp.now(),
      };

      if (editMode && selectedProgram) {
        await updateDoc(doc(db, "exercisePrograms", selectedProgram.id), programData);
        alert("Program updated successfully!");
      } else {
        programData.createdAt = Timestamp.now();
        await addDoc(collection(db, "exercisePrograms"), programData);
        alert("Program created successfully!");
      }

      setShowAddModal(false);
      resetForm();
      fetchPrograms();
    } catch (error) {
      console.error("Error saving program:", error);
      alert("Failed to save program");
    }
  };

  // Delete program
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this program?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "exercisePrograms", id));
      alert("Program deleted successfully!");
      fetchPrograms();
    } catch (error) {
      console.error("Error deleting program:", error);
      alert("Failed to delete program");
    }
  };

  // Edit program
  const handleEdit = (program) => {
    setFormData({
      name: program.name,
      description: program.description || "",
      level: program.level || "beginner",
      duration: program.duration || "",
      exercises: program.exercises || [],
    });
    setSelectedProgram(program);
    setEditMode(true);
    setShowAddModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      level: "beginner",
      duration: "",
      exercises: [],
    });
    setEditMode(false);
    setSelectedProgram(null);
  };

  // Get exercise details
  const getExerciseDetails = (exerciseId) => {
    return (
      exercises.find((e) => e.id === exerciseId) ||
      commonExercises.find((e) => e.id === exerciseId)
    );
  };

  // Filter programs
  const filteredPrograms = programs.filter((program) =>
    program.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // All available exercises
  const allExercises = [...exercises, ...commonExercises];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Sidebar />
      <div className="flex-1 p-4 sm:p-8 ml-0 sm:ml-64">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Exercise Programs
          </h1>
          <p className="text-gray-400">
            Create reusable exercise lists for easy member assignment
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
            + Create Program
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search programs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Programs Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading programs...</p>
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
            <p className="text-gray-400">No programs found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrograms.map((program) => (
              <div
                key={program.id}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {program.name}
                    </h3>
                    {program.description && (
                      <p className="text-gray-400 text-sm mb-2">
                        {program.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      program.level === "beginner"
                        ? "bg-green-600/20 text-green-600"
                        : program.level === "intermediate"
                        ? "bg-yellow-600/20 text-yellow-600"
                        : "bg-red-600/20 text-red-600"
                    }`}
                  >
                    {program.level}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-gray-400 text-sm mb-2">
                    📋 {program.exercises?.length || 0} exercises
                  </div>
                  {program.duration && (
                    <div className="text-gray-400 text-sm">
                      ⏱️ {program.duration}
                    </div>
                  )}
                </div>

                {/* Exercise List Preview */}
                {program.exercises?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-gray-300 text-sm font-medium mb-2">
                      Exercises:
                    </div>
                    <div className="space-y-1">
                      {program.exercises.slice(0, 3).map((ex, idx) => {
                        const exercise = getExerciseDetails(ex.exerciseId);
                        return exercise ? (
                          <div
                            key={idx}
                            className="text-gray-400 text-xs flex items-center gap-2"
                          >
                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                            <span className="truncate">{exercise.name}</span>
                          </div>
                        ) : null;
                      })}
                      {program.exercises.length > 3 && (
                        <div className="text-gray-500 text-xs">
                          +{program.exercises.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewProgram(program)}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(program)}
                    className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(program.id)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Program Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto my-8">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 z-10">
                <h2 className="text-2xl font-bold text-white">
                  {editMode ? "Edit" : "Create"} Exercise Program
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Program Name *
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

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Level
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({ ...formData, level: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows={3}
                    placeholder="Describe the program goals and target audience..."
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Duration (e.g., 4 weeks, 8 weeks)
                  </label>
                  <input
                    type="text"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g., 4 weeks"
                  />
                </div>

                {/* Exercise Selection */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Add Exercises to Program *
                  </label>
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                    {allExercises.map((exercise) => (
                      <div
                        key={exercise.id}
                        className="flex items-center justify-between py-2 px-3 hover:bg-gray-800 rounded-lg transition"
                      >
                        <div className="flex-1">
                          <div className="text-white font-medium">
                            {exercise.name}
                            {exercise.isCommon && (
                              <span className="ml-2 px-2 py-0.5 bg-purple-600/20 text-purple-600 text-xs rounded">
                                Common
                              </span>
                            )}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {exercise.categoryName} • {exercise.difficulty}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddExerciseToProgram(exercise.id)}
                          disabled={formData.exercises.some(
                            (e) => e.exerciseId === exercise.id
                          )}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {formData.exercises.some(
                            (e) => e.exerciseId === exercise.id
                          )
                            ? "Added"
                            : "Add"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selected Exercises */}
                {formData.exercises.length > 0 && (
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Program Exercises ({formData.exercises.length})
                    </label>
                    <div className="space-y-3">
                      {formData.exercises.map((programEx, idx) => {
                        const exercise = getExerciseDetails(programEx.exerciseId);
                        return exercise ? (
                          <div
                            key={idx}
                            className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="text-white font-medium mb-1">
                                  {idx + 1}. {exercise.name}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedExercise(exercise)}
                                  className="text-blue-600 hover:text-blue-500 text-xs"
                                >
                                  View Details
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveExercise(idx)}
                                className="p-1 text-red-600 hover:bg-red-600/20 rounded"
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
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-gray-400 text-xs mb-1">
                                  Sets
                                </label>
                                <input
                                  type="number"
                                  value={programEx.sets}
                                  onChange={(e) =>
                                    handleUpdateExercise(
                                      idx,
                                      "sets",
                                      parseInt(e.target.value)
                                    )
                                  }
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-gray-400 text-xs mb-1">
                                  Reps
                                </label>
                                <input
                                  type="text"
                                  value={programEx.reps}
                                  onChange={(e) =>
                                    handleUpdateExercise(idx, "reps", e.target.value)
                                  }
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                                  placeholder="10-12"
                                />
                              </div>
                              <div>
                                <label className="block text-gray-400 text-xs mb-1">
                                  Rest (seconds)
                                </label>
                                <input
                                  type="text"
                                  value={programEx.rest}
                                  onChange={(e) =>
                                    handleUpdateExercise(idx, "rest", e.target.value)
                                  }
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                                  placeholder="60"
                                />
                              </div>
                            </div>

                            <div className="mt-3">
                              <label className="block text-gray-400 text-xs mb-1">
                                Notes (optional)
                              </label>
                              <input
                                type="text"
                                value={programEx.notes}
                                onChange={(e) =>
                                  handleUpdateExercise(idx, "notes", e.target.value)
                                }
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                                placeholder="Special instructions for this exercise"
                              />
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition"
                  >
                    {editMode ? "Update Program" : "Create Program"}
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

        {/* View Program Modal */}
        {viewProgram && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 z-10 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {viewProgram.name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        viewProgram.level === "beginner"
                          ? "bg-green-600/20 text-green-600"
                          : viewProgram.level === "intermediate"
                          ? "bg-yellow-600/20 text-yellow-600"
                          : "bg-red-600/20 text-red-600"
                      }`}
                    >
                      {viewProgram.level}
                    </span>
                    {viewProgram.duration && (
                      <span className="px-3 py-1 bg-blue-600/20 text-blue-600 rounded-full text-xs font-medium">
                        {viewProgram.duration}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setViewProgram(null)}
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

              <div className="p-6 space-y-6">
                {viewProgram.description && (
                  <div>
                    <h3 className="text-white font-medium mb-2">Description</h3>
                    <p className="text-gray-400">{viewProgram.description}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-white font-medium mb-3">
                    Exercises ({viewProgram.exercises?.length || 0})
                  </h3>
                  <div className="space-y-3">
                    {viewProgram.exercises?.map((programEx, idx) => {
                      const exercise = getExerciseDetails(programEx.exerciseId);
                      return exercise ? (
                        <div
                          key={idx}
                          className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="text-white font-medium mb-1">
                                {idx + 1}. {exercise.name}
                              </div>
                              <button
                                onClick={() => setSelectedExercise(exercise)}
                                className="text-blue-600 hover:text-blue-500 text-xs"
                              >
                                View Exercise Details
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                            <div>
                              <span className="font-medium">Sets:</span>{" "}
                              {programEx.sets}
                            </div>
                            <div>
                              <span className="font-medium">Reps:</span>{" "}
                              {programEx.reps}
                            </div>
                            <div>
                              <span className="font-medium">Rest:</span>{" "}
                              {programEx.rest}s
                            </div>
                          </div>

                          {programEx.notes && (
                            <div className="mt-2 text-sm text-yellow-600 bg-yellow-600/10 p-2 rounded">
                              💡 {programEx.notes}
                            </div>
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                <button
                  onClick={() => setViewProgram(null)}
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exercise Detail Modal */}
        <ExerciseDetailModal
          exercise={selectedExercise}
          isOpen={!!selectedExercise}
          onClose={() => setSelectedExercise(null)}
        />
      </div>
    </div>
  );
};

export default ExercisePrograms;
