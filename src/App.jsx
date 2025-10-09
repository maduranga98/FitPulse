import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Exercises from "./pages/Exercises";

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
    setCurrentPage("dashboard");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("gymUser");
    setCurrentPage("dashboard");
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render current page
  switch (currentPage) {
    case "dashboard":
      return <Dashboard onLogout={handleLogout} onNavigate={handleNavigate} />;
    case "exercises":
      return <Exercises onLogout={handleLogout} onNavigate={handleNavigate} />;
    // Add more cases for other pages
    default:
      return <Dashboard onLogout={handleLogout} onNavigate={handleNavigate} />;
  }
}

export default App;
