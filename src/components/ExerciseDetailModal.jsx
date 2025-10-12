import { useState } from "react";

const ExerciseDetailModal = ({ exercise, isOpen, onClose }) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  if (!isOpen || !exercise) return null;

  const photos = exercise.photoURLs?.filter((url) => url) || [];
  const videos = exercise.videoURLs?.filter((url) => url) || [];
  const steps = exercise.steps?.filter((step) => step) || [];
  const targetedSections = exercise.targetedSections?.filter((s) => s) || [];

  const isFirebaseVideo = (url) => {
    return (
      url.includes("firebase") ||
      url.includes("storage.googleapis.com") ||
      url.includes("firebasestorage")
    );
  };

  const isYouTubeVideo = (url) => {
    return url.includes("youtube.com") || url.includes("youtu.be");
  };

  const getYouTubeEmbedUrl = (url) => {
    let videoId = "";
    if (url.includes("youtube.com/watch?v=")) {
      videoId = url.split("v=")[1]?.split("&")[0];
    } else if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
          {/* Header */}
          <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 sm:p-6 z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  {exercise.name}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {exercise.difficulty && (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        exercise.difficulty === "beginner"
                          ? "bg-green-600/20 text-green-600"
                          : exercise.difficulty === "intermediate"
                          ? "bg-yellow-600/20 text-yellow-600"
                          : "bg-red-600/20 text-red-600"
                      }`}
                    >
                      {exercise.difficulty}
                    </span>
                  )}
                  {exercise.equipment && (
                    <span className="px-3 py-1 bg-blue-600/20 text-blue-600 rounded-full text-xs font-medium">
                      {exercise.equipment}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition flex-shrink-0"
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
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 space-y-6">
            {/* Exercise Info Cards */}
            {(exercise.repsCount || exercise.sets || exercise.duration) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {exercise.sets && (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-xs mb-1">Sets</div>
                    <div className="text-white font-bold text-lg">
                      {exercise.sets}
                    </div>
                  </div>
                )}
                {exercise.repsCount && (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-xs mb-1">Reps</div>
                    <div className="text-white font-bold text-lg">
                      {exercise.repsCount}
                    </div>
                  </div>
                )}
                {exercise.duration && (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-xs mb-1">Duration</div>
                    <div className="text-white font-bold text-lg">
                      {exercise.duration} min
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Targeted Sections */}
            {targetedSections.length > 0 && (
              <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border border-purple-600/30 rounded-xl p-4">
                <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Target Muscles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {targetedSections.map((section, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-purple-600/20 text-purple-600 rounded-lg text-sm font-medium"
                    >
                      {section}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Photos Section */}
            {photos.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-600"
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
                  Exercise Photos
                </h3>

                {/* Mobile: Carousel */}
                <div className="sm:hidden">
                  <div className="relative bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
                    <img
                      src={photos[activePhotoIndex]}
                      alt={`${exercise.name} - Photo ${activePhotoIndex + 1}`}
                      className="w-full h-64 object-cover cursor-pointer"
                      onClick={() => setShowLightbox(true)}
                    />
                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={() =>
                            setActivePhotoIndex((prev) =>
                              prev === 0 ? photos.length - 1 : prev - 1
                            )
                          }
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition"
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
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() =>
                            setActivePhotoIndex((prev) =>
                              prev === photos.length - 1 ? 0 : prev + 1
                            )
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition"
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
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {photos.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActivePhotoIndex(idx)}
                              className={`w-2 h-2 rounded-full transition ${
                                idx === activePhotoIndex
                                  ? "bg-white"
                                  : "bg-white/40"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Desktop: Grid */}
                <div className="hidden sm:grid grid-cols-2 gap-4">
                  {photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative bg-gray-900 rounded-xl overflow-hidden border border-gray-700 group cursor-pointer"
                      onClick={() => {
                        setActivePhotoIndex(idx);
                        setShowLightbox(true);
                      }}
                    >
                      <img
                        src={photo}
                        alt={`${exercise.name} - Photo ${idx + 1}`}
                        className="w-full h-64 object-cover transition group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                        <svg
                          className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                          />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Videos Section */}
            {videos.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-purple-600"
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
                  Instructional Videos
                </h3>
                <div className="space-y-4">
                  {videos.map((video, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden"
                    >
                      {isFirebaseVideo(video) ? (
                        // Uploaded video - embedded player
                        <video
                          src={video}
                          className="w-full rounded-lg bg-black"
                          controls
                          preload="metadata"
                        />
                      ) : isYouTubeVideo(video) ? (
                        // YouTube video - embedded iframe
                        <iframe
                          src={getYouTubeEmbedUrl(video)}
                          className="w-full aspect-video rounded-lg"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        // External link - clickable
                        <a
                          href={video}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 hover:bg-gray-800 transition"
                        >
                          <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg
                              className="w-6 h-6 text-purple-600"
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
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm sm:text-base mb-1">
                              External Video Link {videos.length > 1 && idx + 1}
                            </div>
                            <div className="text-gray-400 text-xs truncate">
                              {video}
                            </div>
                          </div>
                          <svg
                            className="w-5 h-5 text-gray-400 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Steps Section */}
            {steps.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  How to Perform
                </h3>
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-5">
                  <div className="space-y-4">
                    {steps.map((step, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                            {step}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notes Section */}
            {exercise.notes && (
              <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-xl p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-yellow-600 mb-2">
                      Important Notes
                    </h3>
                    <p className="text-yellow-600/90 text-sm sm:text-base leading-relaxed">
                      {exercise.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition text-sm sm:text-base active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox for Photos */}
      {showLightbox && photos.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg transition z-10"
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

          <div className="max-w-6xl w-full">
            <img
              src={photos[activePhotoIndex]}
              alt={`${exercise.name} - Photo ${activePhotoIndex + 1}`}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIndex((prev) =>
                      prev === 0 ? photos.length - 1 : prev - 1
                    );
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIndex((prev) =>
                      prev === photos.length - 1 ? 0 : prev + 1
                    );
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                  {activePhotoIndex + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ExerciseDetailModal;
