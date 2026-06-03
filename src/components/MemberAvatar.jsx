/**
 * Shared member avatar: shows the member's profile photo when available,
 * otherwise falls back to the first letter of the name on a colored circle.
 *
 * Props:
 *  - name: member name (used for the fallback initial + alt text)
 *  - imageUrl: member.profileImageUrl (optional)
 *  - sizeClass: tailwind width/height classes (default "w-12 h-12")
 *  - textClass: tailwind font-size class for the fallback initial
 *  - fallbackClass: tailwind background class for the fallback circle
 */
const MemberAvatar = ({
  name,
  imageUrl,
  sizeClass = "w-12 h-12",
  textClass = "text-lg",
  fallbackClass = "bg-blue-600",
}) => {
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name || ""}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = "none";
            if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
          }}
        />
      ) : null}
      <div
        className={`w-full h-full items-center justify-center text-white font-bold ${textClass} ${fallbackClass}`}
        style={{ display: imageUrl ? "none" : "flex" }}
      >
        {initial}
      </div>
    </div>
  );
};

export default MemberAvatar;
