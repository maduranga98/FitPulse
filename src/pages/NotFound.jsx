import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NotFound = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoHome = () => {
    if (user?.role === "member") {
      navigate("/member-dashboard");
    } else if (user?.role === "admin" || user?.role === "manager") {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-8">
          <svg
            className="w-24 h-24 text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h1 className="text-6xl font-bold text-white mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-300 mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-400 mb-8">
            The page you're looking for doesn't exist or you don't have
            permission to access it.
          </p>
        </div>

        <button
          onClick={handleGoHome}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition inline-flex items-center gap-2"
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
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Go to Home
        </button>
      </div>
    </div>
  );
};

export default NotFound;
