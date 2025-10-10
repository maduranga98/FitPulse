import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const RoleRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user's role is in the allowed roles array
  if (!allowedRoles.includes(user.role)) {
    // Redirect based on their actual role
    if (user.role === "member") {
      return <Navigate to="/member-dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default RoleRoute;
