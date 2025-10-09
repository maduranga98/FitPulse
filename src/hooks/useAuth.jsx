import { useState, useEffect, createContext, useContext } from "react";
import { db } from "../config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem("gymUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
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

      // Don't store password in localStorage
      const { password: _, ...userWithoutPassword } = userData;

      setUser(userWithoutPassword);
      localStorage.setItem("gymUser", JSON.stringify(userWithoutPassword));

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("gymUser");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
