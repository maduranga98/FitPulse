import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Exercises from "./pages/Exercises";
import CommonExercises from "./pages/CommonExercises";
import ExercisePrograms from "./pages/ExercisePrograms";
import Schedules from "./pages/Schedules";
import MemberDashboard from "./pages/members/MemberDashboard";
import NotFound from "./pages/NotFound";
import MemberWorkoutTracker from "./pages/members/MemberWorkoutTracker";
import MemberWorkoutSession from "./pages/members/MemberWorkoutSession";
import MemberProgressTracker from "./pages/members/MemberProgressTracker";
import MemberSchedules from "./pages/members/MemberSchedules";
import MemberProfile from "./pages/members/settings/MemberProfile";
import MemberSettings from "./pages/members/MemberSettings";
import AdminComplaints from "./pages/AdminComplaints";
import AdminPayments from "./pages/AdminPayments";
import Supplements from "./pages/Supplements";
import SupplementRequests from "./pages/SupplementRequests";
import MemberSupplements from "./pages/members/MemberSupplements";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import BulkExerciseImport from "./pages/BulkExerciseImport";
import Analytics from "./pages/Analytics";
import MemberAnalytics from "./pages/MemberAnalytics";
import FinancialAnalytics from "./pages/FinancialAnalytics";
import ScheduleAnalytics from "./pages/ScheduleAnalytics";
import ComplaintAnalytics from "./pages/ComplaintAnalytics";
import OperationalAnalytics from "./pages/OperationalAnalytics";
import ExerciseAnalytics from "./pages/ExerciseAnalytics";

// Component to handle root redirect based on user role
function RootRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "super_admin") {
    return <Navigate to="/super-admin" replace />;
  } else if (user.role === "member") {
    return <Navigate to="/member-dashboard" replace />;
  } else {
    return <Navigate to="/dashboard" replace />;
  }
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Super Admin Routes */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["super_admin"]}>
                  <SuperAdminDashboard />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/bulk-exercise-import"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["super_admin"]}>
                  <BulkExerciseImport />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/common-exercises"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["super_admin"]}>
                  <CommonExercises />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Admin/Manager Only */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <Dashboard />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <Members />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <Analytics />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics/members"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <MemberAnalytics />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics/financial"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <FinancialAnalytics />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics/schedules"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <ScheduleAnalytics />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics/complaints"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <ComplaintAnalytics />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics/operational"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <OperationalAnalytics />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics/exercises"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <ExerciseAnalytics />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <AdminComplaints />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <AdminPayments />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/supplements"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <Supplements />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/supplement-requests"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <SupplementRequests />
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
            path="/exercise-programs"
            element={
              <ProtectedRoute>
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "manager",
                    "gym_admin",
                    "gym_manager",
                  ]}
                >
                  <ExercisePrograms />
                </RoleRoute>
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
          <Route
            path="/member/workouts"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["member"]}>
                  <MemberWorkoutTracker />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/member/workout-session"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["member"]}>
                  <MemberWorkoutSession />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/member/progress"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["member"]}>
                  <MemberProgressTracker />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/member-schedules"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["member"]}>
                  <MemberSchedules />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/member-profile"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["member"]}>
                  <MemberProfile />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/member-settings"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["member"]}>
                  <MemberSettings />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/member/supplements"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["member"]}>
                  <MemberSupplements />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Root redirect based on user role */}
          <Route path="/" element={<RootRedirect />} />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
