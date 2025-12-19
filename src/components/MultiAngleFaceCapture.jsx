import React, { useState, useRef, useEffect } from "react";
import { Camera, RotateCcw, Check, AlertCircle, User } from "lucide-react";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "../config/firebase";

const MultiAngleFaceCapture = ({
  memberId,
  memberName,
  onComplete,
  onCancel,
}) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [currentStep, setCurrentStep] = useState(0); // 0, 1, 2 for 3 photos
  const [capturedPhotos, setCapturedPhotos] = useState([null, null, null]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Photo capture instructions
  const captureSteps = [
    {
      angle: "front",
      title: "Photo 1 of 3: Front View",
      instruction: "Look straight at the camera",
      icon: "👤",
      headPosition: "center",
    },
    {
      angle: "left_15",
      title: "Photo 2 of 3: Left Turn",
      instruction: "Turn your head slightly to the LEFT",
      icon: "↰",
      headPosition: "slightly left",
    },
    {
      angle: "right_15",
      title: "Photo 3 of 3: Right Turn",
      instruction: "Turn your head slightly to the RIGHT",
      icon: "↱",
      headPosition: "slightly right",
    },
  ];

  // Start camera
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
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
      setError("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraReady(false);
  };

  // Capture photo for current step
  const capturePhoto = () => {
    if (!videoRef.current || !cameraReady) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        const newPhotos = [...capturedPhotos];
        newPhotos[currentStep] = {
          blob: blob,
          url: URL.createObjectURL(blob),
          angle: captureSteps[currentStep].angle,
        };
        setCapturedPhotos(newPhotos);

        // Move to next step or finish
        if (currentStep < 2) {
          setCurrentStep(currentStep + 1);
        }
      },
      "image/jpeg",
      0.95
    );
  };

  // Retake photo for current step
  const retakePhoto = () => {
    const newPhotos = [...capturedPhotos];
    if (newPhotos[currentStep]?.url) {
      URL.revokeObjectURL(newPhotos[currentStep].url);
    }
    newPhotos[currentStep] = null;
    setCapturedPhotos(newPhotos);
  };

  // Retake specific photo
  const retakeSpecificPhoto = (index) => {
    const newPhotos = [...capturedPhotos];
    if (newPhotos[index]?.url) {
      URL.revokeObjectURL(newPhotos[index].url);
    }
    newPhotos[index] = null;
    setCapturedPhotos(newPhotos);
    setCurrentStep(index);
  };

  // Upload all photos and update member
  const uploadAndRegister = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Stop camera before uploading
      stopCamera();

      // If memberId is null, this is for new member registration
      // Just return the photos with blobs to the parent component
      if (!memberId) {
        const photosWithBlobs = capturedPhotos.map((photo, index) => ({
          blob: photo.blob,
          url: photo.url,
          angle: photo.angle,
          index: index,
        }));

        if (onComplete) {
          onComplete(photosWithBlobs);
        }

        setIsProcessing(false);
        return;
      }

      const uploadedPhotos = [];

      // Upload each photo
      for (let i = 0; i < capturedPhotos.length; i++) {
        const photo = capturedPhotos[i];
        if (!photo) continue;

        const timestamp = Date.now();
        const filename = `${memberId}_${photo.angle}_${timestamp}.jpg`;
        const photoRef = storageRef(storage, `faces/${memberId}/${filename}`);

        await uploadBytes(photoRef, photo.blob);
        const downloadURL = await getDownloadURL(photoRef);

        uploadedPhotos.push({
          url: downloadURL,
          angle: photo.angle,
          uploadedAt: new Date().toISOString(),
          index: i,
        });
      }

      // Update member document with all 3 photos
      const memberRef = doc(db, "members", memberId);
      await updateDoc(memberRef, {
        facePhotos: uploadedPhotos,
        faceRegistered: true,
        faceRegistrationDate: new Date().toISOString(),
        faceRegistrationMethod: "multi-angle-capture",
      });

      // Clean up blob URLs
      capturedPhotos.forEach((photo) => {
        if (photo?.url) URL.revokeObjectURL(photo.url);
      });

      if (onComplete) {
        onComplete(uploadedPhotos);
      }

      setIsProcessing(false);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload photos. Please try again.");
      setIsProcessing(false);
      // Restart camera if upload failed
      startCamera();
    }
  };

  // Check if all photos are captured
  const allPhotosCaptured = capturedPhotos.every((photo) => photo !== null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="w-6 h-6" />
            Face Registration - {memberName}
          </h2>
          <p className="text-blue-100 mt-2">
            We'll capture 3 photos from different angles for better recognition
            accuracy
          </p>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Progress Steps */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              {captureSteps.map((step, index) => (
                <React.Fragment key={index}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all ${
                        capturedPhotos[index]
                          ? "bg-green-500 text-white"
                          : index === currentStep
                          ? "bg-blue-600 text-white ring-4 ring-blue-200"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {capturedPhotos[index] ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="text-xs text-gray-600 mt-1">
                      {step.angle}
                    </span>
                  </div>
                  {index < captureSteps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 rounded ${
                        capturedPhotos[index] ? "bg-green-500" : "bg-gray-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camera/Preview Section */}
            <div>
              {!isProcessing && (
                <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                  {!capturedPhotos[currentStep] ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Camera overlay with guide */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="border-2 border-white border-dashed rounded-full w-48 h-48 opacity-30" />
                      </div>

                      {!cameraReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                          <div className="text-white text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                            <p>Starting camera...</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <img
                      src={capturedPhotos[currentStep].url}
                      alt={`Captured - ${captureSteps[currentStep].angle}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}

              {/* Current Step Instructions */}
              {!isProcessing && !allPhotosCaptured && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-4xl">
                      {captureSteps[currentStep].icon}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-bold text-blue-900">
                        {captureSteps[currentStep].title}
                      </h3>
                      <p className="text-blue-700 mt-1">
                        {captureSteps[currentStep].instruction}
                      </p>
                      <div className="mt-3 flex gap-2">
                        {!capturedPhotos[currentStep] ? (
                          <button
                            onClick={capturePhoto}
                            disabled={!cameraReady}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                          >
                            <Camera className="w-4 h-4" />
                            Capture Photo
                          </button>
                        ) : (
                          <button
                            onClick={retakePhoto}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Retake
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnails Section */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <User className="w-5 h-5" />
                Captured Photos
              </h3>
              <div className="space-y-3">
                {captureSteps.map((step, index) => (
                  <div
                    key={index}
                    className={`border-2 rounded-lg p-3 transition-all ${
                      capturedPhotos[index]
                        ? "border-green-500 bg-green-50"
                        : index === currentStep
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {capturedPhotos[index] ? (
                          <img
                            src={capturedPhotos[index].url}
                            alt={`${step.angle}`}
                            className="w-20 h-20 object-cover rounded border-2 border-white shadow-sm"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center">
                            <Camera className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">
                          {step.title}
                        </p>
                        <p className="text-sm text-gray-600">
                          {step.instruction}
                        </p>
                        {capturedPhotos[index] && (
                          <button
                            onClick={() => retakeSpecificPhoto(index)}
                            disabled={isProcessing}
                            className="text-sm text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Retake
                          </button>
                        )}
                      </div>
                      <div>
                        {capturedPhotos[index] ? (
                          <Check className="w-6 h-6 text-green-600" />
                        ) : index === currentStep ? (
                          <div className="w-6 h-6 rounded-full border-2 border-blue-600 animate-pulse" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tips */}
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-bold text-yellow-900 mb-2">
                  📸 Tips for Best Results:
                </h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Ensure good lighting on your face</li>
                  <li>• Look directly at the camera</li>
                  <li>• Keep a neutral expression</li>
                  <li>• Remove glasses if possible</li>
                  <li>• Turn head slightly for angles</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={uploadAndRegister}
              disabled={!allPhotosCaptured || isProcessing}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Complete Registration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiAngleFaceCapture;
