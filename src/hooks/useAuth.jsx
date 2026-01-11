// src/hooks/useAuth.js
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("gymUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      // Check for Super Admin
      const SUPER_ADMIN_USERNAME =
        import.meta.env.VITE_SUPER_ADMIN_USERNAME || "superadmin";
      const SUPER_ADMIN_PASSWORD =
        import.meta.env.VITE_SUPER_ADMIN_PASSWORD || "SuperAdmin@2025";

      if (
        username === SUPER_ADMIN_USERNAME &&
        password === SUPER_ADMIN_PASSWORD
      ) {
        const superAdminUser = {
          id: "super_admin_001",
          username: SUPER_ADMIN_USERNAME,
          name: "Super Administrator",
          role: "super_admin",
          email: "superadmin@gymsystem.com",
        };

        localStorage.setItem("gymUser", JSON.stringify(superAdminUser));
        setUser(superAdminUser);
        return { success: true };
      }

      const { db } = await import("../config/firebase");
      const { collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      // ✅ First, try to find user in 'users' collection (gym_admin/manager)
      const usersRef = collection(db, "users");
      const usersQuery = query(usersRef, where("username", "==", username));
      const usersSnapshot = await getDocs(usersQuery);

      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userData = { id: userDoc.id, ...userDoc.data() };

        if (userData.password !== password) {
          return { success: false, error: "Invalid username or password" };
        }

        // Check if gym is active (if user belongs to a gym)
        if (userData.gymId) {
          const { doc, getDoc } = await import("firebase/firestore");
          const gymDoc = await getDoc(doc(db, "gyms", userData.gymId));

          if (gymDoc.exists()) {
            const gymData = gymDoc.data();
            if (gymData.status === "inactive") {
              return {
                success: false,
                error: "This gym has been deactivated. Please contact the super admin.",
              };
            }
          }
        }

        // Map old roles to new roles for backward compatibility
        let role = userData.role;
        if (role === "admin") {
          role = "gym_admin";
        } else if (role === "manager") {
          role = "gym_manager";
        }

        const userToStore = {
          id: userData.id,
          username: userData.username,
          name: userData.name,
          email: userData.email,
          role: role,
          gymId: userData.gymId || null,
        };

        localStorage.setItem("gymUser", JSON.stringify(userToStore));
        setUser(userToStore);

        return { success: true };
      }

      // ✅ If not found in 'users', try 'members' collection
      const membersRef = collection(db, "members");
      const membersQuery = query(membersRef, where("username", "==", username));
      const membersSnapshot = await getDocs(membersQuery);

      if (!membersSnapshot.empty) {
        const memberDoc = membersSnapshot.docs[0];
        const memberData = { id: memberDoc.id, ...memberDoc.data() };

        // ✅ Check password for member
        if (memberData.password !== password) {
          return { success: false, error: "Invalid username or password" };
        }

        // ✅ Check if member is active
        if (memberData.status !== "active") {
          return {
            success: false,
            error: "Your membership is not active. Please contact the gym.",
          };
        }

        // Check if gym is active (if member belongs to a gym)
        if (memberData.gymId) {
          const { doc, getDoc } = await import("firebase/firestore");
          const gymDoc = await getDoc(doc(db, "gyms", memberData.gymId));

          if (gymDoc.exists()) {
            const gymData = gymDoc.data();
            if (gymData.status === "inactive") {
              return {
                success: false,
                error: "This gym has been deactivated. Please contact the gym administrator.",
              };
            }
          }
        }

        const memberToStore = {
          id: memberData.id,
          username: memberData.username,
          name: memberData.name,
          email: memberData.email,
          phone: memberData.phone,
          role: "member",
          gymId: memberData.gymId || null,
          membershipType: memberData.membershipType,
          status: memberData.status,
        };

        localStorage.setItem("gymUser", JSON.stringify(memberToStore));
        setUser(memberToStore);

        return { success: true };
      }

      // ✅ User not found in either collection
      return { success: false, error: "Invalid username or password" };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem("gymUser");
    setUser(null);
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
