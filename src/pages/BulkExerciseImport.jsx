import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isSuperAdmin } from '../utils/authUtils';
import { useNavigate } from 'react-router-dom';

const BulkExerciseImport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedGym, setSelectedGym] = useState('');
  const [gyms, setGyms] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errors, setErrors] = useState([]);
  const [successCount, setSuccessCount] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (!user || !isSuperAdmin(user)) {
      navigate('/');
      return;
    }
    fetchGyms();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedGym) {
      fetchCategories();
    }
  }, [selectedGym]);

  const fetchGyms = async () => {
    try {
      const gymsSnapshot = await getDocs(collection(db, 'gyms'));
      const gymsData = gymsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGyms(gymsData);
    } catch (error) {
      console.error('Error fetching gyms:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const categoriesQuery = query(
        collection(db, 'exerciseCategories'),
        where('gymId', '==', selectedGym)
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/json') {
      setSelectedFile(file);
      setErrors([]);
      setSuccessCount(0);
    } else {
      alert('Please select a valid JSON file');
    }
  };

  const parseAndPreview = async () => {
    if (!selectedFile) {
      alert('Please select a JSON file');
      return;
    }

    if (!selectedGym) {
      alert('Please select a gym');
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
          isValid: validationErrors.length === 0
        };
      });

      setExercises(validatedExercises);
      setPreviewMode(true);
    } catch (error) {
      alert('Error parsing JSON file: ' + error.message);
    }
  };

  const validateExercise = (exercise, index) => {
    const errors = [];

    if (!exercise.name || typeof exercise.name !== 'string') {
      errors.push(`Exercise ${index + 1}: Name is required and must be a string`);
    }

    if (!exercise.categoryName || typeof exercise.categoryName !== 'string') {
      errors.push(`Exercise ${index + 1}: categoryName is required`);
    } else {
      // Check if category exists
      const category = categories.find(
        cat => cat.name.toLowerCase() === exercise.categoryName.toLowerCase()
      );
      if (!category) {
        errors.push(`Exercise ${index + 1}: Category "${exercise.categoryName}" not found`);
      }
    }

    if (!exercise.difficulty || !['beginner', 'intermediate', 'advanced'].includes(exercise.difficulty)) {
      errors.push(`Exercise ${index + 1}: Difficulty must be beginner, intermediate, or advanced`);
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
      cat => cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    return category ? category.id : null;
  };

  const handleBulkImport = async () => {
    if (!selectedGym) {
      alert('Please select a gym');
      return;
    }

    const validExercises = exercises.filter(ex => ex.isValid);

    if (validExercises.length === 0) {
      alert('No valid exercises to import');
      return;
    }

    if (!window.confirm(`Import ${validExercises.length} exercises to the selected gym?`)) {
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
          categoryName: exercise.categoryName,
          gymId: selectedGym,
          difficulty: exercise.difficulty,
          equipment: exercise.equipment || '',
          repsCount: exercise.repsCount || '',
          sets: exercise.sets || '',
          duration: exercise.duration || '',
          steps: exercise.steps || [],
          targetedSections: exercise.targetedSections || [],
          notes: exercise.notes || '',
          photoURLs: exercise.photoURLs || [],
          videoURLs: exercise.videoURLs || [],
          createdAt: Timestamp.now()
        };

        await addDoc(collection(db, 'exercises'), exerciseData);
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
    } else {
      alert(`Imported ${successfulImports} out of ${validExercises.length} exercises. Check errors below.`);
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
          "Keep core tight and shoulder blades retracted throughout"
        ],
        targetedSections: [
          "Chest (Pectorals)",
          "Shoulders (Anterior Deltoids)",
          "Triceps"
        ],
        notes: "Most effective compound exercise for chest development. Maintain proper form to avoid shoulder injury.",
        photoURLs: [
          "https://example.com/bench-press-1.jpg",
          "https://example.com/bench-press-2.jpg"
        ],
        videoURLs: [
          "https://www.youtube.com/watch?v=example1"
        ]
      }
    ];

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exercise-sample.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Bulk Exercise Import</h1>
          <button
            onClick={() => navigate('/super-admin')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Gym Selection */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Gym</h2>
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

          {selectedGym && categories.length > 0 && (
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
              disabled={!selectedGym}
            />
          </div>

          {selectedFile && (
            <div className="mb-4">
              <p className="text-sm text-gray-400">Selected file: {selectedFile.name}</p>
            </div>
          )}

          <button
            onClick={parseAndPreview}
            disabled={!selectedFile || !selectedGym}
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
            <li>Select the gym where you want to import exercises</li>
            <li>Make sure the gym has the required exercise categories created</li>
            <li>Download the sample JSON file to see the required format</li>
            <li>Prepare your JSON file with exercise data (can be an array of exercises or a single exercise)</li>
            <li>Upload the JSON file and click "Parse and Preview"</li>
            <li>Review the exercises and check for any validation errors</li>
            <li>Click "Import" to save valid exercises to the database</li>
          </ol>

          <div className="mt-4 p-4 bg-yellow-900 bg-opacity-20 rounded-lg">
            <h3 className="font-semibold mb-2">Important Notes:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
              <li>The categoryName must match an existing category name for the selected gym</li>
              <li>Category matching is case-insensitive</li>
              <li>Difficulty must be: beginner, intermediate, or advanced</li>
              <li>Steps and targetedSections must be arrays</li>
              <li>photoURLs and videoURLs are optional but must be arrays if provided</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkExerciseImport;
