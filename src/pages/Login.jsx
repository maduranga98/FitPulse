import { useState } from "react";

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!username || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      const adminsRef = collection(db, "admins");
      const q = query(
        adminsRef,
        where("username", "==", username),
        where("password", "==", password)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Invalid username or password");
      }

      const userData = {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data(),
      };

      const { password: _, ...userWithoutPassword } = userData;

      localStorage.setItem("gymUser", JSON.stringify(userWithoutPassword));

      // Navigate to dashboard
      if (onLoginSuccess) {
        onLoginSuccess(userWithoutPassword);
      }

      setLoading(false);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left Side - Branding (Hidden on mobile, visible on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white w-full">
          <div className="max-w-lg">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <svg
                  className="w-9 h-9 text-white"
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
              </div>
              <span className="text-3xl font-bold">Gym Manager</span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl xl:text-6xl font-bold mb-6 leading-tight">
              Manage Your Gym
              <br />
              <span className="text-blue-200">Effortlessly</span>
            </h1>

            {/* Description */}
            <p className="text-xl text-blue-100 mb-12 leading-relaxed">
              Streamline member management, track payments, and organize
              workouts all in one powerful platform.
            </p>

            {/* Features */}
            <div className="space-y-4">
              {[
                { icon: "👥", text: "Manage members and memberships" },
                { icon: "💰", text: "Track payments and subscriptions" },
                { icon: "💪", text: "Organize workouts and schedules" },
                { icon: "📊", text: "View analytics and reports" },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 text-lg text-blue-50"
                >
                  <span className="text-2xl">{feature.icon}</span>
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center px-6 py-12 bg-gray-900 sm:px-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4">
              <svg
                className="w-7 h-7 text-white"
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
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Gym Manager</h1>
            <p className="text-gray-400">Sign in to your account</p>
          </div>

          {/* Desktop Heading */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-gray-400">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Login Form */}
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
            <div className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                </div>
              )}

              {/* Username Field */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Enter your username"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Enter your password"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>

            {/* Demo Credentials */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-xs text-gray-500 text-center mb-2">
                Demo Credentials
              </p>
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-gray-400">
                  <span className="text-gray-500">Username:</span>{" "}
                  <span className="font-mono text-gray-300">admin</span>
                </span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400">
                  <span className="text-gray-500">Password:</span>{" "}
                  <span className="font-mono text-gray-300">admin123</span>
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-500">
            © 2025 Gym Manager. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
