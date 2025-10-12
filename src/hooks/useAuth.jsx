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
      // First, try to find user in admins collection
      const adminsRef = collection(db, "admins");
      const adminQuery = query(
        adminsRef,
        where("username", "==", username),
        where("password", "==", password)
      );

      let querySnapshot = await getDocs(adminQuery);

      // If not found in admins, try members collection
      if (querySnapshot.empty) {
        const membersRef = collection(db, "members");
        const memberQuery = query(
          membersRef,
          where("username", "==", username),
          where("password", "==", password)
        );

        querySnapshot = await getDocs(memberQuery);

        // If still not found, invalid credentials
        if (querySnapshot.empty) {
          throw new Error("Invalid username or password");
        }

        // Check if member status is active
        const memberData = querySnapshot.docs[0].data();
        if (memberData.status !== "active") {
          throw new Error(
            "Your account is inactive. Please contact the gym administrator."
          );
        }
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
