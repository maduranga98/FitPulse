import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

const defaultSettings = {
  features: {
    supplements: true,
    classes: true,
    mealPlans: true,
  },
  notifications: {
    sms: true,
    whatsapp: true,
  },
};

const GymSettingsContext = createContext({
  settings: defaultSettings,
  loading: true,
  updateSettings: async () => {},
});

export const GymSettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const gymId = user?.gymId;
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gymId) {
      setLoading(false);
      return;
    }
    loadSettings();
  }, [gymId]);

  const loadSettings = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, getDoc } = await import("firebase/firestore");
      const gymSnap = await getDoc(doc(db, "gyms", gymId));
      if (gymSnap.exists()) {
        const gymData = gymSnap.data();
        setSettings({
          features: {
            ...defaultSettings.features,
            ...gymData.settings?.features,
          },
          notifications: {
            ...defaultSettings.notifications,
            ...gymData.settings?.notifications,
          },
        });
      }
    } catch (err) {
      console.error("Failed to load gym settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    if (!gymId) return;
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "gyms", gymId), { settings: newSettings });
      setSettings(newSettings);
    } catch (err) {
      console.error("Failed to save gym settings:", err);
      throw err;
    }
  };

  return (
    <GymSettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </GymSettingsContext.Provider>
  );
};

export const useGymSettings = () => useContext(GymSettingsContext);
