import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import {
  Dumbbell,
  Plus,
  X,
  Save,
  Eye,
  Edit2,
  Trash2,
  Users,
  Calendar,
  Clock,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const InstructorWorkouts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentGymId = user?.gymId;

  // State management
  const [templates, setTemplates] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // Template form state
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    difficulty: "beginner",
    estimatedDuration: 30,
  });
  
  // Template exercises state
  const [templateExercises, setTemplateExercises] = useState([]);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  
  // Assignment state
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [dueDate, setDueDate] = useState("");

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

      // Fetch workout templates
      const templatesSnapshot = await getDocs(
        query(
          collection(db, "workout_templates"),
          where("gymId", "==", currentGymId),
          orderBy("createdAt", "desc")
        )
      );
      const templatesData = await Promise.all(
        templatesSnapshot.docs.map(async (doc) => {
          // Fetch exercise count for each template
          const exercisesSnapshot = await getDocs(
            query(
              collection(db, "template_exercises"),
              where("templateId", "==", doc.id)
            )
          );
          return {
            id: doc.id,
            ...doc.data(),
            exerciseCount: exercisesSnapshot.size,
          };
        })
      );

      // Fetch available exercises (gym + selected common)
      const gymExercisesSnapshot = await getDocs(
        query(
          collection(db, "gym_exercises"),
          where("gymId", "==", currentGymId)
        )
      );
      const gymExercises = gymExercisesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        source: "gym",
      }));

      // Fetch instructor's selected common exercises
      let selectedCommonExercises = [];
      try {
        const selectionsSnapshot = await getDocs(
          query(
            collection(db, "instructor_exercise_selections"),
            where("instructorId", "==", user.id),
            where("gymId", "==", currentGymId)
          )
        );
        const selectedIds = selectionsSnapshot.docs.map(
          (doc) => doc.data().exerciseId
        );

        if (selectedIds.length > 0) {
          const commonExercisesSnapshot = await getDocs(
            collection(db, "exercises")
          );
          selectedCommonExercises = commonExercisesSnapshot.docs
            .filter((doc) => selectedIds.includes(doc.id))
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              source: "common",
            }));
        }
      } catch (error) {
        console.log("No selected exercises found:", error.message);
      }

      const allExercises = [...gymExercises, ...selectedCommonExercises];

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

      setTemplates(templatesData);
      setExercises(allExercises);
      setMembers(membersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert(`Error loading data: ${error.message}`);
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();

    if (!templateForm.name.trim()) {
      alert("Please enter a template name");
      return;
    }

    if (templateExercises.length === 0) {
      alert("Please add at least one exercise to the template");
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const {
        collection,
        addDoc,
        Timestamp,
        writeBatch,
        doc,
      } = await import("firebase/firestore");

      const batch = writeBatch(db);

      // Create template document
      const templateRef = doc(collection(db, "workout_templates"));
      batch.set(templateRef, {
        name: templateForm.name,
        description: templateForm.description,
        difficulty: templateForm.difficulty,
        estimatedDuration: parseInt(templateForm.estimatedDuration),
        createdBy: user.id,
        createdByName: user.name,
        gymId: currentGymId,
        totalExercises: templateExercises.length,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isActive: true,
      });

      // Add template exercises
      templateExercises.forEach((exercise, index) => {
        const exerciseRef = doc(collection(db, "template_exercises"));
        batch.set(exerciseRef, {
          templateId: templateRef.id,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          order: index + 1,
          sets: parseInt(exercise.sets),
          reps: parseInt(exercise.reps),
          restSeconds: parseInt(exercise.restSeconds),
          notes: exercise.notes || "",
          addedAt: Timestamp.now(),
        });
      });

      await batch.commit();
      alert("Template created successfully! 🎉");
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error creating template:", error);
      alert(`Error creating template: ${error.message}`);
    }
  };

  const handleAssignTemplate = async () => {
    if (selectedMembers.length === 0) {
      alert("Please select at least one member");
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      const promises = selectedMembers.map((memberId) => {
        const member = members.find((m) => m.id === memberId);
        return addDoc(collection(db, "workout_assignments"), {
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          memberId: memberId,
          memberName: member.name,
          assignedBy: user.id,
          assignedByName: user.name,
          gymId: currentGymId,
          assignedAt: Timestamp.now(),
          dueDate: dueDate ? new Date(dueDate) : null,
          status: "assigned",
          progress: {
            completedExercises: 0,
            totalExercises: selectedTemplate.exerciseCount || 0,
            lastUpdated: Timestamp.now(),
          },
        });
      });

      await Promise.all(promises);
      alert(
        `Template assigned to ${selectedMembers.length} member(s) successfully! 🎉`
      );
      setShowAssignModal(false);
      setSelectedMembers([]);
      setDueDate("");
    } catch (error) {
      console.error("Error assigning template:", error);
      alert(`Error assigning template: ${error.message}`);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const {
        collection,
        deleteDoc,
        doc,
        query,
        where,
        getDocs,
      } = await import("firebase/firestore");

      // Delete template exercises first
      const exercisesQuery = query(
        collection(db, "template_exercises"),
        where("templateId", "==", templateId)
      );
      const exercisesSnapshot = await getDocs(exercisesQuery);
      const deletePromises = exercisesSnapshot.docs.map((doc) =>
        deleteDoc(doc.ref)
      );

      // Delete template
      deletePromises.push(deleteDoc(doc(db, "workout_templates", templateId)));

      await Promise.all(deletePromises);
      alert("Template deleted successfully!");
      fetchData();
    } catch (error) {
      console.error("Error deleting template:", error);
      alert(`Error deleting template: ${error.message}`);
    }
  };

  const addExerciseToTemplate = (exercise) => {
    const newExercise = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets: exercise.setsCount || 3,
      reps: exercise.repsCount || 10,
      restSeconds: 60,
      notes: "",
    };
    setTemplateExercises([...templateExercises, newExercise]);
    setShowExerciseSelector(false);
    setExerciseSearchTerm("");
  };

  const removeExerciseFromTemplate = (index) => {
    setTemplateExercises(templateExercises.filter((_, i) => i !== index));
  };

  const moveExercise = (index, direction) => {
    const newExercises = [...templateExercises];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newExercises.length) return;
    
    [newExercises[index], newExercises[targetIndex]] = [
      newExercises[targetIndex],
      newExercises[index],
    ];
    
    setTemplateExercises(newExercises);
  };

  const updateTemplateExercise = (index, field, value) => {
    const updated = [...templateExercises];
    updated[index][field] = value;
    setTemplateExercises(updated);
  };

  const resetForm = () => {
    setTemplateForm({
      name: "",
      description: "",
      difficulty: "beginner",
      estimatedDuration: 30,
    });
    setTemplateExercises([]);
    setExerciseSearchTerm("");
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-500/20 text-green-400 border-green-500";
      case "intermediate":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500";
      case "advanced":
        return "bg-red-500/20 text-red-400 border-red-500";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500";
    }
  };

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredExercises = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading workout templates...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                <Dumbbell className="w-10 h-10 text-purple-400" />
                Workout Templates
              </h1>
              <p className="text-gray-400 mt-2">
                Create and manage workout templates for your members
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Template
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
            <Dumbbell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-4">
              {searchTerm
                ? "No templates found"
                : "No templates yet. Create your first one!"}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
              >
                Create Template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-purple-500 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">
                      {template.name}
                    </h3>
                    <p className="text-gray-400 text-sm line-clamp-2">
                      {template.description || "No description"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span
                    className={`px-3 py-1 text-xs rounded-full border ${getDifficultyColor(
                      template.difficulty
                    )}`}
                  >
                    {template.difficulty}
                  </span>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500">
                    {template.exerciseCount || 0} exercises
                  </span>
                  <span className="px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded-full">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {template.estimatedDuration}min
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowAssignModal(true);
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Assign
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Template Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl max-w-4xl w-full p-6 my-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Create Workout Template
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

              <form onSubmit={handleCreateTemplate} className="space-y-6">
                {/* Template Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 mb-2">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) =>
                        setTemplateForm({ ...templateForm, name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Monday Upper Body"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={templateForm.difficulty}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          difficulty: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Description</label>
                  <textarea
                    value={templateForm.description}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows="3"
                    placeholder="Brief description of this template..."
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">
                    Estimated Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={templateForm.estimatedDuration}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        estimatedDuration: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="5"
                    max="300"
                  />
                </div>

                {/* Exercise Builder */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-gray-300">
                      Exercises ({templateExercises.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowExerciseSelector(true)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Exercise
                    </button>
                  </div>

                  {/* Exercise List */}
                  {templateExercises.length === 0 ? (
                    <div className="text-center py-8 bg-gray-900 rounded-lg border border-gray-700">
                      <p className="text-gray-400">
                        No exercises added yet. Click "Add Exercise" to start
                        building your template.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templateExercises.map((exercise, index) => (
                        <div
                          key={index}
                          className="bg-gray-900 rounded-lg border border-gray-700 p-4"
                        >
                          <div className="flex items-start gap-4">
                            {/* Order Controls */}
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => moveExercise(index, "up")}
                                disabled={index === 0}
                                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <span className="text-purple-400 font-bold text-sm text-center">
                                {index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => moveExercise(index, "down")}
                                disabled={index === templateExercises.length - 1}
                                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Exercise Details */}
                            <div className="flex-1">
                              <h4 className="text-white font-bold mb-3">
                                {exercise.exerciseName}
                              </h4>
                              <div className="grid grid-cols-3 gap-3 mb-3">
                                <div>
                                  <label className="block text-gray-400 text-xs mb-1">
                                    Sets
                                  </label>
                                  <input
                                    type="number"
                                    value={exercise.sets}
                                    onChange={(e) =>
                                      updateTemplateExercise(
                                        index,
                                        "sets",
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                    min="1"
                                  />
                                </div>
                                <div>
                                  <label className="block text-gray-400 text-xs mb-1">
                                    Reps
                                  </label>
                                  <input
                                    type="number"
                                    value={exercise.reps}
                                    onChange={(e) =>
                                      updateTemplateExercise(
                                        index,
                                        "reps",
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                    min="1"
                                  />
                                </div>
                                <div>
                                  <label className="block text-gray-400 text-xs mb-1">
                                    Rest (sec)
                                  </label>
                                  <input
                                    type="number"
                                    value={exercise.restSeconds}
                                    onChange={(e) =>
                                      updateTemplateExercise(
                                        index,
                                        "restSeconds",
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                    min="0"
                                  />
                                </div>
                              </div>
                              <input
                                type="text"
                                value={exercise.notes}
                                onChange={(e) =>
                                  updateTemplateExercise(
                                    index,
                                    "notes",
                                    e.target.value
                                  )
                                }
                                placeholder="Notes for this exercise..."
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                              />
                            </div>

                            {/* Remove Button */}
                            <button
                              type="button"
                              onClick={() => removeExerciseFromTemplate(index)}
                              className="text-red-400 hover:text-red-300 transition"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Create Template
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Exercise Selector Modal */}
        {showExerciseSelector && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">
                  Select Exercise
                </h3>
                <button
                  onClick={() => {
                    setShowExerciseSelector(false);
                    setExerciseSearchTerm("");
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={exerciseSearchTerm}
                  onChange={(e) => setExerciseSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {filteredExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => addExerciseToTemplate(exercise)}
                    className="w-full text-left px-4 py-3 bg-gray-900 hover:bg-gray-700 rounded-lg border border-gray-700 hover:border-purple-500 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{exercise.name}</p>
                        <p className="text-gray-400 text-sm">
                          {exercise.setsCount || 3} sets × {exercise.repsCount || 10}{" "}
                          reps
                        </p>
                      </div>
                      <Plus className="w-5 h-5 text-purple-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Assign Template Modal */}
        {showAssignModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Assign Template
                  </h2>
                  <p className="text-gray-400 mt-1">{selectedTemplate.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedMembers([]);
                    setDueDate("");
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Member Selection */}
                <div>
                  <label className="block text-gray-300 mb-3">
                    Select Members ({selectedMembers.length} selected)
                  </label>
                  <div className="max-h-64 overflow-y-auto space-y-2 bg-gray-900 rounded-lg p-4">
                    {members.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded cursor-pointer transition"
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
                          className="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <p className="text-white font-medium">{member.name}</p>
                          <p className="text-gray-400 text-sm">{member.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-gray-300 mb-2">
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedMembers([]);
                      setDueDate("");
                    }}
                    className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignTemplate}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <Users className="w-5 h-5" />
                    Assign to {selectedMembers.length} Member(s)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorWorkouts;
