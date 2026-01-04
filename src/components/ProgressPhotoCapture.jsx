import { useState, useRef, useEffect } from "react";
import { Camera, RotateCcw, Check, AlertCircle, X, Upload } from "lucide-react";

const ProgressPhotoCapture = ({ onComplete, onCancel }) => {
  const [captureMethod, setCaptureMethod] = useState(null); // 'camera' or 'upload'
  const videoRef = useRef(null);
  const fileInputRefs = {
    front: useRef(null),
    side: useRef(null),
    back: useRef(null),
  };

  const [stream, setStream] = useState(null);
  const [currentStep, setCurrentStep] = useState(0); // 0, 1, 2 for 3 photos
  const [capturedPhotos, setCapturedPhotos] = useState({
    front: null,
    side: null,
    back: null,
  });
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Body measurements state
  const [measurements, setMeasurements] = useState({
    chest: "",
    waist: "",
    hips: "",
    biceps: "",
    thighs: "",
    calves: "",
    weight: "",
    notes: "",
  });

  const photoTypes = [
    {
      key: "front",
      title: "Front View",
      instruction: "Stand straight, face the camera",
      icon: "📸",
    },
    {
      key: "side",
      title: "Side View",
      instruction: "Turn 90° to your right",
      icon: "➡️",
    },
    {
      key: "back",
      title: "Back View",
      instruction: "Turn your back to the camera",
      icon: "🔄",
    },
  ];

  useEffect(() => {
    return () => {
      stopCamera();
      // Clean up blob URLs
      Object.values(capturedPhotos).forEach((photo) => {
        if (photo?.url) URL.revokeObjectURL(photo.url);
      });
    };
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please check permissions or use file upload.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraReady(false);
  };

  const handleCaptureMethodSelect = (method) => {
    setCaptureMethod(method);
    if (method === "camera") {
      startCamera();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !cameraReady) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob(
      (blob) => {
        const photoType = photoTypes[currentStep].key;
        const newPhotos = { ...capturedPhotos };
        if (newPhotos[photoType]?.url) {
          URL.revokeObjectURL(newPhotos[photoType].url);
        }
        newPhotos[photoType] = {
          blob: blob,
          url: URL.createObjectURL(blob),
          type: photoType,
        };
        setCapturedPhotos(newPhotos);

        if (currentStep < 2) {
          setCurrentStep(currentStep + 1);
        }
      },
      "image/jpeg",
      0.95
    );
  };

  const handleFileUpload = (photoType, event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    const newPhotos = { ...capturedPhotos };
    if (newPhotos[photoType]?.url) {
      URL.revokeObjectURL(newPhotos[photoType].url);
    }
    newPhotos[photoType] = {
      blob: file,
      url: URL.createObjectURL(file),
      type: photoType,
    };
    setCapturedPhotos(newPhotos);
    setError(null);
  };

  const retakePhoto = (photoType) => {
    const newPhotos = { ...capturedPhotos };
    if (newPhotos[photoType]?.url) {
      URL.revokeObjectURL(newPhotos[photoType].url);
    }
    newPhotos[photoType] = null;
    setCapturedPhotos(newPhotos);

    // If using camera, go back to that photo step
    if (captureMethod === "camera") {
      const stepIndex = photoTypes.findIndex((p) => p.key === photoType);
      setCurrentStep(stepIndex);
    }
  };

  const handleComplete = () => {
    // Validate at least one photo
    const hasPhotos = Object.values(capturedPhotos).some((photo) => photo !== null);
    if (!hasPhotos) {
      setError("Please capture or upload at least one progress photo");
      return;
    }

    // Validate measurements (at least weight is recommended)
    if (!measurements.weight) {
      setError("Please enter your current weight");
      return;
    }

    stopCamera();
    onComplete({
      photos: capturedPhotos,
      measurements: {
        chest: parseFloat(measurements.chest) || null,
        waist: parseFloat(measurements.waist) || null,
        hips: parseFloat(measurements.hips) || null,
        biceps: parseFloat(measurements.biceps) || null,
        thighs: parseFloat(measurements.thighs) || null,
        calves: parseFloat(measurements.calves) || null,
        weight: parseFloat(measurements.weight),
        notes: measurements.notes,
      },
    });
  };

  const allPhotosC aptured =
    capturedPhotos.front && capturedPhotos.side && capturedPhotos.back;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl max-w-5xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Camera className="w-6 h-6" />
                Progress Photo Capture
              </h2>
              <p className="text-blue-100 mt-2">
                Capture your transformation with photos and measurements
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-200 font-medium">Error</p>
                <p className="text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Method Selection */}
          {!captureMethod && (
            <div className="text-center py-12">
              <h3 className="text-2xl font-bold text-white mb-6">
                Choose Capture Method
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <button
                  onClick={() => handleCaptureMethodSelect("camera")}
                  className="p-8 bg-gray-700 hover:bg-gray-600 rounded-xl transition border-2 border-transparent hover:border-blue-500"
                >
                  <Camera className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <h4 className="text-xl font-bold text-white mb-2">
                    Use Camera
                  </h4>
                  <p className="text-gray-400 text-sm">
                    Capture photos in real-time
                  </p>
                </button>
                <button
                  onClick={() => handleCaptureMethodSelect("upload")}
                  className="p-8 bg-gray-700 hover:bg-gray-600 rounded-xl transition border-2 border-transparent hover:border-blue-500"
                >
                  <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                  <h4 className="text-xl font-bold text-white mb-2">
                    Upload Photos
                  </h4>
                  <p className="text-gray-400 text-sm">
                    Upload existing photos from device
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Camera Capture Mode */}
          {captureMethod === "camera" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Camera Preview */}
              <div>
                <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video mb-4">
                  {!capturedPhotos[photoTypes[currentStep].key] ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {!cameraReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                          <div className="text-white text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                            <p>Starting camera...</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <img
                      src={capturedPhotos[photoTypes[currentStep].key].url}
                      alt={`Captured - ${photoTypes[currentStep].title}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Current Step Instructions */}
                <div className="p-4 bg-blue-900/30 border border-blue-500 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-4xl">
                      {photoTypes[currentStep].icon}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-lg">
                        {photoTypes[currentStep].title}
                      </h3>
                      <p className="text-blue-200 mt-1">
                        {photoTypes[currentStep].instruction}
                      </p>
                      <div className="mt-3 flex gap-2">
                        {!capturedPhotos[photoTypes[currentStep].key] ? (
                          <button
                            onClick={capturePhoto}
                            disabled={!cameraReady}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2 transition"
                          >
                            <Camera className="w-4 h-4" />
                            Capture
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              retakePhoto(photoTypes[currentStep].key)
                            }
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Retake
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Photo Thumbnails */}
              <div>
                <h3 className="font-bold text-white mb-3">Progress Photos</h3>
                <div className="space-y-3">
                  {photoTypes.map((photo, index) => (
                    <div
                      key={photo.key}
                      className={`border-2 rounded-lg p-3 transition ${
                        capturedPhotos[photo.key]
                          ? "border-green-500 bg-green-900/20"
                          : index === currentStep
                          ? "border-blue-500 bg-blue-900/20"
                          : "border-gray-600 bg-gray-700/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {capturedPhotos[photo.key] ? (
                            <img
                              src={capturedPhotos[photo.key].url}
                              alt={photo.title}
                              className="w-20 h-20 object-cover rounded border-2 border-white/20"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gray-700 rounded flex items-center justify-center">
                              <Camera className="w-8 h-8 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">{photo.title}</p>
                          <p className="text-sm text-gray-400">
                            {photo.instruction}
                          </p>
                          {capturedPhotos[photo.key] && (
                            <button
                              onClick={() => retakePhoto(photo.key)}
                              className="text-sm text-blue-400 hover:text-blue-300 mt-1 flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Retake
                            </button>
                          )}
                        </div>
                        <div>
                          {capturedPhotos[photo.key] ? (
                            <Check className="w-6 h-6 text-green-400" />
                          ) : index === currentStep ? (
                            <div className="w-6 h-6 rounded-full border-2 border-blue-500 animate-pulse" />
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-gray-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upload Mode */}
          {captureMethod === "upload" && (
            <div>
              <h3 className="font-bold text-white mb-4 text-lg">
                Upload Progress Photos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {photoTypes.map((photo) => (
                  <div key={photo.key} className="bg-gray-700 rounded-lg p-4">
                    <div className="text-center mb-3">
                      <p className="font-medium text-white mb-1">
                        {photo.title}
                      </p>
                      <p className="text-sm text-gray-400">{photo.instruction}</p>
                    </div>

                    {capturedPhotos[photo.key] ? (
                      <div className="relative">
                        <img
                          src={capturedPhotos[photo.key].url}
                          alt={photo.title}
                          className="w-full h-48 object-cover rounded-lg mb-2"
                        />
                        <button
                          onClick={() => retakePhoto(photo.key)}
                          className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Replace
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          ref={fileInputRefs[photo.key]}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(photo.key, e)}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRefs[photo.key].current?.click()}
                          className="w-full h-48 border-2 border-dashed border-gray-500 hover:border-blue-500 rounded-lg flex flex-col items-center justify-center gap-2 transition bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-blue-400"
                        >
                          <Upload className="w-12 h-12" />
                          <span className="text-sm font-medium">
                            Click to Upload
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Body Measurements */}
          {captureMethod && (
            <div className="mt-6 border-t border-gray-700 pt-6">
              <h3 className="font-bold text-white mb-4 text-lg">
                Body Measurements (cm)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={measurements.weight}
                    onChange={(e) =>
                      setMeasurements({ ...measurements, weight: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="75.5"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Chest
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={measurements.chest}
                    onChange={(e) =>
                      setMeasurements({ ...measurements, chest: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="95.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Waist
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={measurements.waist}
                    onChange={(e) =>
                      setMeasurements({ ...measurements, waist: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="80.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Hips
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={measurements.hips}
                    onChange={(e) =>
                      setMeasurements({ ...measurements, hips: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="90.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Biceps
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={measurements.biceps}
                    onChange={(e) =>
                      setMeasurements({ ...measurements, biceps: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="35.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Thighs
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={measurements.thighs}
                    onChange={(e) =>
                      setMeasurements({ ...measurements, thighs: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="55.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Calves
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={measurements.calves}
                    onChange={(e) =>
                      setMeasurements({ ...measurements, calves: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="37.0"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={measurements.notes}
                  onChange={(e) =>
                    setMeasurements({ ...measurements, notes: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="How are you feeling? Any observations?"
                  rows="3"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {captureMethod && (
            <div className="mt-6 flex justify-between gap-3 pt-4 border-t border-gray-700">
              {captureMethod === "camera" && (
                <button
                  onClick={() => {
                    stopCamera();
                    setCaptureMethod(null);
                    setCurrentStep(0);
                  }}
                  className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition"
                >
                  Change Method
                </button>
              )}
              {captureMethod === "upload" && (
                <button
                  onClick={() => {
                    setCaptureMethod(null);
                  }}
                  className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition"
                >
                  Change Method
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={onCancel}
                  className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleComplete}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition"
                >
                  <Check className="w-5 h-5" />
                  Save Progress
                </button>
              </div>
            </div>
          )}

          {/* Tips */}
          {captureMethod && (
            <div className="mt-6 p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg">
              <h4 className="font-bold text-yellow-300 mb-2">
                📸 Tips for Best Results:
              </h4>
              <ul className="text-sm text-yellow-200 space-y-1">
                <li>• Wear fitted clothing or workout gear</li>
                <li>• Use consistent lighting for all photos</li>
                <li>• Stand in the same location each time</li>
                <li>• Keep the same distance from camera</li>
                <li>• Take photos at the same time of day</li>
                <li>• Measure in the morning before eating</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressPhotoCapture;
