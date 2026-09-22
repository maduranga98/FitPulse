import { useState } from "react";
import ImageZoomModal from "./ImageZoomModal";

/**
 * Shared member avatar: shows the member's profile photo when available,
 * otherwise falls back to the first letter of the name on a colored circle.
 *
 * When a photo exists the avatar is a button: clicking it opens the full
 * screen zoom viewer, because a 48px circle is far too small for an admin to
 * confirm the face of the person standing in front of them. Members without a
 * photo stay inert — there is nothing to enlarge.
 *
 * Props:
 *  - name: member name (used for the fallback initial + alt text)
 *  - imageUrl: member.profileImageUrl (optional)
 *  - sizeClass: tailwind width/height classes (default "w-12 h-12")
 *  - textClass: tailwind font-size class for the fallback initial
 *  - fallbackClass: tailwind background class for the fallback circle
 *  - zoomable: set false where the avatar already sits inside a control that
 *    owns the click (a row that opens a profile, for example)
 *  - caption: line shown above the enlarged photo (defaults to the name)
 */
const MemberAvatar = ({
  name,
  imageUrl,
  sizeClass = "w-12 h-12",
  textClass = "text-lg",
  fallbackClass = "bg-blue-600",
  zoomable = true,
  caption,
}) => {
  const [zoomOpen, setZoomOpen] = useState(false);
  // An image that 404s is swapped for the initial below, and must stop
  // offering a zoom that would open onto a broken image.
  const [imageFailed, setImageFailed] = useState(false);

  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const canZoom = zoomable && !!imageUrl && !imageFailed;

  const circle = (
    <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0`}>
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={name || ""}
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center text-white font-bold ${textClass} ${fallbackClass}`}
        >
          {initial}
        </div>
      )}
    </div>
  );

  if (!canZoom) return circle;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Avatars often sit inside a clickable card or row — opening the
          // photo must not also trigger that row's own action.
          e.stopPropagation();
          setZoomOpen(true);
        }}
        title={`View ${name || "member"}'s photo`}
        aria-label={`View ${name || "member"}'s photo`}
        className="relative group rounded-full flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition active:scale-95"
      >
        {circle}
        {/* Hover affordance: a magnifier over the photo, so it reads as
            something you can open rather than decoration. */}
        <span className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
          <svg className="w-1/2 h-1/2 max-w-5 max-h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0zM11 8v6M8 11h6" />
          </svg>
        </span>
      </button>

      {zoomOpen && (
        <ImageZoomModal
          src={imageUrl}
          alt={name || "Member photo"}
          caption={caption ?? name}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </>
  );
};

export default MemberAvatar;
