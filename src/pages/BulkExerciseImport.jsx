import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../hooks/useAuth";
import { isSuperAdmin } from "../utils/authUtils";
import { useNavigate } from "react-router-dom";

const BulkExerciseImport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedGym, setSelectedGym] = useState("");
  const [gyms, setGyms] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errors, setErrors] = useState([]);
  const [successCount, setSuccessCount] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [isCommon, setIsCommon] = useState(true);
  const [existingExercises, setExistingExercises] = useState([]);
  const [viewMode, setViewMode] = useState('import'); // 'import' or 'view'
  const [editingExercise, setEditingExercise] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!user || !isSuperAdmin(user)) {
      navigate("/");
      return;
    }
    fetchGyms();
    fetchExistingExercises();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedGym || isCommon) {
      fetchCategories();
    }
  }, [selectedGym, isCommon]);

  const fetchGyms = async () => {
    try {
      const gymsSnapshot = await getDocs(collection(db, "gyms"));
      const gymsData = gymsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGyms(gymsData);
    } catch (error) {
      console.error("Error fetching gyms:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      let categoriesData = [];

      if (isCommon) {
        // Fetch common categories (where gymId is 'common' or doesn't exist)
        const commonCategoriesQuery = query(
          collection(db, 'exerciseCategories'),
          where('gymId', '==', 'common')
        );
        const commonSnapshot = await getDocs(commonCategoriesQuery);
        categoriesData = commonSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } else if (selectedGym) {
        // Fetch gym-specific categories
        const categoriesQuery = query(
          collection(db, 'exerciseCategories'),
          where('gymId', '==', selectedGym)
        );
        const categoriesSnapshot = await getDocs(categoriesQuery);
        categoriesData = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchExistingExercises = async () => {
    try {
      const exercisesQuery = query(
        collection(db, 'exercises'),
        where('gymId', '==', 'common')
      );
      const exercisesSnapshot = await getDocs(exercisesQuery);
      const exercisesData = exercisesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setExistingExercises(exercisesData);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/json") {
      setSelectedFile(file);
      setErrors([]);
      setSuccessCount(0);
    } else {
      alert("Please select a valid JSON file");
    }
  };

  const parseAndPreview = async () => {
    if (!selectedFile) {
      alert("Please select a JSON file");
      return;
    }

    if (!isCommon && !selectedGym) {
      alert('Please select a gym or mark as common');
      return;
    }

    try {
      const fileContent = await selectedFile.text();
      const jsonData = JSON.parse(fileContent);

      // Handle both array and single object
      const exercisesArray = Array.isArray(jsonData) ? jsonData : [jsonData];

      // Validate and map exercises
      const validatedExercises = exercisesArray.map((exercise, index) => {
        const validationErrors = validateExercise(exercise, index);
        return {
          ...exercise,
          index,
          validationErrors,
          isValid: validationErrors.length === 0,
        };
      });

      setExercises(validatedExercises);
      setPreviewMode(true);
    } catch (error) {
      alert("Error parsing JSON file: " + error.message);
    }
  };

  const validateExercise = (exercise, index) => {
    const errors = [];

    if (!exercise.name || typeof exercise.name !== "string") {
      errors.push(
        `Exercise ${index + 1}: Name is required and must be a string`
      );
    }

    if (!exercise.categoryName || typeof exercise.categoryName !== "string") {
      errors.push(`Exercise ${index + 1}: categoryName is required`);
    } else {
      // Check if category exists - trim whitespace and do case-insensitive comparison
      const category = categories.find(
        cat => cat.name.toLowerCase().trim() === exercise.categoryName.toLowerCase().trim()
      );
      if (!category) {
        errors.push(`Exercise ${index + 1}: Category "${exercise.categoryName}" not found. Available: ${categories.map(c => c.name).join(', ')}`);
      }
    }

    if (
      !exercise.difficulty ||
      !["beginner", "intermediate", "advanced"].includes(exercise.difficulty)
    ) {
      errors.push(
        `Exercise ${
          index + 1
        }: Difficulty must be beginner, intermediate, or advanced`
      );
    }

    if (!Array.isArray(exercise.steps) || exercise.steps.length === 0) {
      errors.push(`Exercise ${index + 1}: Steps must be a non-empty array`);
    }

    if (!Array.isArray(exercise.targetedSections)) {
      errors.push(`Exercise ${index + 1}: targetedSections must be an array`);
    }

    return errors;
  };

  const getCategoryId = (categoryName) => {
    const category = categories.find(
      cat => cat.name.toLowerCase().trim() === categoryName.toLowerCase().trim()
    );
    return category ? category.id : null;
  };

  const handleBulkImport = async () => {
    if (!isCommon && !selectedGym) {
      alert('Please select a gym or mark as common');
      return;
    }

    const validExercises = exercises.filter((ex) => ex.isValid);

    if (validExercises.length === 0) {
      alert("No valid exercises to import");
      return;
    }

    if (!window.confirm(`Import ${validExercises.length} exercises as ${isCommon ? 'common' : 'gym-specific'}?`)) {
      return;
    }

    setImporting(true);
    setProgress({ current: 0, total: validExercises.length });
    setErrors([]);
    setSuccessCount(0);

    const importErrors = [];
    let successfulImports = 0;

    for (let i = 0; i < validExercises.length; i++) {
      const exercise = validExercises[i];

      try {
        const categoryId = getCategoryId(exercise.categoryName);

        const exerciseData = {
          name: exercise.name,
          category: categoryId,
          categoryName: exercise.categoryName.trim(),
          gymId: isCommon ? 'common' : selectedGym,
          difficulty: exercise.difficulty,
          equipment: exercise.equipment || "",
          repsCount: exercise.repsCount || "",
          sets: exercise.sets || "",
          duration: exercise.duration || "",
          steps: exercise.steps || [],
          targetedSections: exercise.targetedSections || [],
          notes: exercise.notes || "",
          photoURLs: exercise.photoURLs || [],
          videoURLs: exercise.videoURLs || [],
          createdAt: Timestamp.now(),
        };

        await addDoc(collection(db, "exercises"), exerciseData);
        successfulImports++;
      } catch (error) {
        importErrors.push(`Exercise "${exercise.name}": ${error.message}`);
      }

      setProgress({ current: i + 1, total: validExercises.length });
    }

    setSuccessCount(successfulImports);
    setErrors(importErrors);
    setImporting(false);

    if (successfulImports === validExercises.length) {
      alert(`Successfully imported ${successfulImports} exercises!`);
      resetForm();
      fetchExistingExercises();
    } else {
      alert(
        `Imported ${successfulImports} out of ${validExercises.length} exercises. Check errors below.`
      );
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setExercises([]);
    setPreviewMode(false);
    setErrors([]);
    setSuccessCount(0);
    setProgress({ current: 0, total: 0 });
  };

  const handleExportExercises = () => {
    const exportData = existingExercises.map(ex => ({
      name: ex.name,
      categoryName: ex.categoryName,
      difficulty: ex.difficulty,
      equipment: ex.equipment,
      repsCount: ex.repsCount,
      sets: ex.sets,
      duration: ex.duration,
      steps: ex.steps,
      targetedSections: ex.targetedSections,
      notes: ex.notes,
      photoURLs: ex.photoURLs,
      videoURLs: ex.videoURLs
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exercises-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSampleJSON = () => {
    const sample = [
      {
        name: "Barbell Bench Press",
        categoryName: "Chest",
        difficulty: "intermediate",
        equipment: "Barbell, Bench",
        repsCount: "8-12",
        sets: "3-4",
        duration: "",
        steps: [
          "Lie flat on bench with feet firmly on ground",
          "Grip barbell slightly wider than shoulder width",
          "Lower bar to mid-chest with controlled motion",
          "Press bar up until arms are fully extended",
          "Keep core tight and shoulder blades retracted throughout",
        ],
        targetedSections: [
          "Chest (Pectorals)",
          "Shoulders (Anterior Deltoids)",
          "Triceps",
        ],
        notes:
          "Most effective compound exercise for chest development. Maintain proper form to avoid shoulder injury.",
        photoURLs: [
          "https://example.com/bench-press-1.jpg",
          "https://example.com/bench-press-2.jpg",
        ],
        videoURLs: ["https://www.youtube.com/watch?v=example1"],
      },
    ];

    const blob = new Blob([JSON.stringify(sample, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exercise-sample.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEditExercise = (exercise) => {
    setEditingExercise({ ...exercise });
    setShowEditModal(true);
  };

  const handleUpdateExercise = async () => {
    try {
      const categoryId = getCategoryId(editingExercise.categoryName);

      const updatedData = {
        name: editingExercise.name,
        category: categoryId,
        categoryName: editingExercise.categoryName.trim(),
        difficulty: editingExercise.difficulty,
        equipment: editingExercise.equipment || '',
        repsCount: editingExercise.repsCount || '',
        sets: editingExercise.sets || '',
        duration: editingExercise.duration || '',
        steps: editingExercise.steps || [],
        targetedSections: editingExercise.targetedSections || [],
        notes: editingExercise.notes || '',
        photoURLs: editingExercise.photoURLs || [],
        videoURLs: editingExercise.videoURLs || [],
        updatedAt: Timestamp.now()
      };

      await updateDoc(doc(db, 'exercises', editingExercise.id), updatedData);
      alert('Exercise updated successfully!');
      setShowEditModal(false);
      setEditingExercise(null);
      fetchExistingExercises();
    } catch (error) {
      console.error('Error updating exercise:', error);
      alert('Failed to update exercise: ' + error.message);
    }
  };

  const handleDeleteExercise = async (exerciseId) => {
    if (!window.confirm('Are you sure you want to delete this exercise?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'exercises', exerciseId));
      alert('Exercise deleted successfully!');
      fetchExistingExercises();
    } catch (error) {
      console.error('Error deleting exercise:', error);
      alert('Failed to delete exercise: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Bulk Exercise Import</h1>
          <button
            onClick={() => navigate("/super-admin")}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setViewMode('import')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              viewMode === 'import'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Import Exercises
          </button>
          <button
            onClick={() => setViewMode('view')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              viewMode === 'view'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            View & Edit Exercises ({existingExercises.length})
          </button>
        </div>

        {viewMode === 'import' ? (
          <>
            {/* Common or Gym-Specific Toggle */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Exercise Type</h2>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={isCommon}
                    onChange={() => setIsCommon(true)}
                    className="w-4 h-4"
                  />
                  <span className="text-white">Common (Available to all gyms)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!isCommon}
                    onChange={() => setIsCommon(false)}
                    className="w-4 h-4"
                  />
                  <span className="text-white">Gym-Specific</span>
                </label>
              </div>

              {!isCommon && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Gym
                  </label>
                  <select
                    value={selectedGym}
                    onChange={(e) => {
                      setSelectedGym(e.target.value);
                      resetForm();
                    }}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a gym...</option>
                    {gyms.map(gym => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name} - {gym.location}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(isCommon || selectedGym) && categories.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold mb-2">Available Categories:</h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <span key={cat.id} className="px-3 py-1 bg-blue-600 rounded-full text-sm">
                        {cat.icon} {cat.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* File Upload Section */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Upload JSON File</h2>

              <div className="mb-4">
                <button
                  onClick={downloadSampleJSON}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm"
                >
                  Download Sample JSON
                </button>
              </div>

              <div className="mb-4">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  disabled={!isCommon && !selectedGym}
                />
              </div>

              {selectedFile && (
                <div className="mb-4">
                  <p className="text-sm text-gray-400">Selected file: {selectedFile.name}</p>
                </div>
              )}

              <button
                onClick={parseAndPreview}
                disabled={!selectedFile || (!isCommon && !selectedGym)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Parse and Preview
              </button>
            </div>

            {/* Preview Section */}
            {previewMode && exercises.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Preview Exercises</h2>

                <div className="mb-4 p-4 bg-gray-700 rounded-lg">
                  <p className="text-sm">
                    Total: {exercises.length} |
                    Valid: <span className="text-green-500">{exercises.filter(ex => ex.isValid).length}</span> |
                    Invalid: <span className="text-red-500">{exercises.filter(ex => !ex.isValid).length}</span>
                  </p>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">#</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Category</th>
                        <th className="px-4 py-2 text-left">Difficulty</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercises.map((exercise, idx) => (
                        <tr key={idx} className={`border-b border-gray-700 ${!exercise.isValid ? 'bg-red-900 bg-opacity-20' : ''}`}>
                          <td className="px-4 py-2">{idx + 1}</td>
                          <td className="px-4 py-2">{exercise.name}</td>
                          <td className="px-4 py-2">{exercise.categoryName}</td>
                          <td className="px-4 py-2">{exercise.difficulty}</td>
                          <td className="px-4 py-2">
                            {exercise.isValid ? (
                              <span className="text-green-500">✓ Valid</span>
                            ) : (
                              <div>
                                <span className="text-red-500">✗ Invalid</span>
                                <div className="text-xs text-red-400 mt-1">
                                  {exercise.validationErrors.map((err, i) => (
                                    <div key={i}>{err}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex gap-4">
                  <button
                    onClick={handleBulkImport}
                    disabled={importing || exercises.filter(ex => ex.isValid).length === 0}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {importing ? 'Importing...' : `Import ${exercises.filter(ex => ex.isValid).length} Valid Exercises`}
                  </button>
                  <button
                    onClick={resetForm}
                    disabled={importing}
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Progress Section */}
            {importing && (
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Import Progress</h2>
                <div className="w-full bg-gray-700 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-center mt-2">
                  {progress.current} / {progress.total} exercises processed
                </p>
              </div>
            )}

            {/* Results Section */}
            {successCount > 0 && !importing && (
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4 text-green-500">Import Complete</h2>
                <p className="mb-4">Successfully imported {successCount} exercises</p>

                {errors.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-red-500">Errors ({errors.length})</h3>
                    <div className="bg-red-900 bg-opacity-20 p-4 rounded-lg max-h-60 overflow-y-auto">
                      {errors.map((error, idx) => (
                        <p key={idx} className="text-sm text-red-400 mb-1">{error}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Instructions</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Choose if exercises should be common (all gyms) or gym-specific</li>
                <li>If gym-specific, select the target gym</li>
                <li>Make sure the required categories exist (check available categories above)</li>
                <li>Download the sample JSON file to see the required format</li>
                <li>Prepare your JSON file with exercise data (can be an array of exercises or a single exercise)</li>
                <li>Upload the JSON file and click "Parse and Preview"</li>
                <li>Review the exercises and check for any validation errors</li>
                <li>Click "Import" to save valid exercises to the database</li>
              </ol>

              <div className="mt-4 p-4 bg-yellow-900 bg-opacity-20 rounded-lg">
                <h3 className="font-semibold mb-2">Important Notes:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                  <li>The categoryName must match an existing category name exactly</li>
                  <li>Category matching is case-insensitive and trims whitespace</li>
                  <li>Difficulty must be: beginner, intermediate, or advanced</li>
                  <li>Steps and targetedSections must be arrays</li>
                  <li>photoURLs and videoURLs are optional but must be arrays if provided</li>
                  <li>Multi-word categories like "Core / Abs" or "Mobility & Flexibility" are supported</li>
                </ul>
              </div>
            </div>
          </>
        ) : (
          /* View & Edit Exercises */
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Added Common Exercises</h2>
              <button
                onClick={handleExportExercises}
                disabled={existingExercises.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export All ({existingExercises.length})
              </button>
            </div>

            {existingExercises.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>No common exercises found</p>
                <p className="text-sm mt-2">Import some exercises to see them here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Difficulty</th>
                      <th className="px-4 py-3 text-left">Equipment</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingExercises.map((exercise) => (
                      <tr key={exercise.id} className="border-b border-gray-700 hover:bg-gray-750">
                        <td className="px-4 py-3">{exercise.name}</td>
                        <td className="px-4 py-3">{exercise.categoryName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            exercise.difficulty === 'beginner' ? 'bg-green-600/20 text-green-600' :
                            exercise.difficulty === 'intermediate' ? 'bg-yellow-600/20 text-yellow-600' :
                            'bg-red-600/20 text-red-600'
                          }`}>
                            {exercise.difficulty}
                          </span>
                        </td>
                        <td className="px-4 py-3">{exercise.equipment || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditExercise(exercise)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteExercise(exercise.id)}
                              className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-600 rounded text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Exercise Modal */}
      {showEditModal && editingExercise && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full my-8">
            <h2 className="text-2xl font-bold mb-4">Edit Exercise</h2>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={editingExercise.name}
                  onChange={(e) => setEditingExercise({...editingExercise, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Category Name</label>
                <input
                  type="text"
                  value={editingExercise.categoryName}
                  onChange={(e) => setEditingExercise({...editingExercise, categoryName: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Difficulty</label>
                <select
                  value={editingExercise.difficulty}
                  onChange={(e) => setEditingExercise({...editingExercise, difficulty: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Equipment</label>
                <input
                  type="text"
                  value={editingExercise.equipment || ''}
                  onChange={(e) => setEditingExercise({...editingExercise, equipment: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Sets</label>
                  <input
                    type="text"
                    value={editingExercise.sets || ''}
                    onChange={(e) => setEditingExercise({...editingExercise, sets: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Reps Count</label>
                  <input
                    type="text"
                    value={editingExercise.repsCount || ''}
                    onChange={(e) => setEditingExercise({...editingExercise, repsCount: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Steps (one per line)</label>
                <textarea
                  value={editingExercise.steps?.join('\n') || ''}
                  onChange={(e) => setEditingExercise({...editingExercise, steps: e.target.value.split('\n')})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Targeted Sections (one per line)</label>
                <textarea
                  value={editingExercise.targetedSections?.join('\n') || ''}
                  onChange={(e) => setEditingExercise({...editingExercise, targetedSections: e.target.value.split('\n')})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={editingExercise.notes || ''}
                  onChange={(e) => setEditingExercise({...editingExercise, notes: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateExercise}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
              >
                Update Exercise
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingExercise(null);
                }}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkExerciseImport;
