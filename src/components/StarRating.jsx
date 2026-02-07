import { Star } from "lucide-react";

const StarRating = ({ rating, onRatingChange, readonly = false, size = "md" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onRatingChange && onRatingChange(star)}
          disabled={readonly}
          className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition ${
            star <= rating ? "text-yellow-400" : "text-gray-600"
          }`}
        >
          <Star
            className={`${sizeClasses[size]} ${star <= rating ? "fill-yellow-400" : "fill-gray-600"}`}
          />
        </button>
      ))}
    </div>
  );
};

export default StarRating;
