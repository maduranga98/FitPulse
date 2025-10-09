import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Exercises from "./pages/Exercises";
import Members from "./pages/Members";
import Schedules from "./pages/Schedules";
import MemberDashboard from "./pages/members/MemberDashboard";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("dashboard");

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem("gymUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    // Navigate based on user role
    if (userData.role === "member") {
      setCurrentPage("member-dashboard");
    } else {
      setCurrentPage("dashboard");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("gymUser");
    setCurrentPage("dashboard");
  };

  const handleNavigate = (page) => {
    // Check permissions before navigation
    const isAdmin = user?.role === "admin" || user?.role === "manager";

    if (user?.role === "member") {
      // Members can only access certain pages
      const allowedPages = ["member-dashboard", "exercises", "schedules"];
      if (allowedPages.includes(page)) {
        setCurrentPage(page);
      } else {
        alert("You don't have permission to access this page");
      }
    } else if (isAdmin) {
      // Admin/Manager can access all pages
      setCurrentPage(page);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render current page based on route and user role
  const isAdmin = user.role === "admin" || user.role === "manager";
  const isMember = user.role === "member";

  // Member routes
  if (isMember) {
    switch (currentPage) {
      case "member-dashboard":
        return (
          <MemberDashboard
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        );
      case "exercises":
        return (
          <Exercises
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        );
      case "schedules":
        return (
          <Schedules
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        );
      default:
        return (
          <MemberDashboard
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        );
    }
  }

  // Admin/Manager routes
  if (isAdmin) {
    switch (currentPage) {
      case "dashboard":
        return (
          <Dashboard
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        );
      case "exercises":
        return (
          <Exercises
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        );
      case "members":
        return (
          <Members
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        );
      case "schedules":
        return (
          <Schedules
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        );
      // Add more cases for other pages (Payments, etc.)
      default:
        return (
          <Dashboard
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        );
    }
  }

  // Fallback
  return <Login onLoginSuccess={handleLoginSuccess} />;
}

export default App;
