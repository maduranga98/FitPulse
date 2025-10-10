import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Exercises from "./pages/Exercises";
import Schedules from "./pages/Schedules";
import MemberDashboard from "./pages/members/MemberDashboard";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes - Admin/Manager Only */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["admin", "manager"]}>
                  <Dashboard />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["admin", "manager"]}>
                  <Members />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - All Authenticated Users */}
          <Route
            path="/exercises"
            element={
              <ProtectedRoute>
                <Exercises />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedules"
            element={
              <ProtectedRoute>
                <Schedules />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Members Only */}
          <Route
            path="/member-dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["member"]}>
                  <MemberDashboard />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Root redirect based on user role */}
          <Route path="/" element={<RootRedirect />} />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Component to handle root redirect based on user role
function RootRedirect() {
  const storedUser = localStorage.getItem("gymUser");

  if (!storedUser) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(storedUser);

  if (user.role === "member") {
    return <Navigate to="/member-dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export default App;
