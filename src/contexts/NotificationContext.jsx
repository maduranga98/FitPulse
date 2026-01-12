import { createContext, useContext, useState, useCallback } from "react";

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const showNotification = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };

    setNotifications((prev) => [...prev, notification]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);

    return id;
  }, []);

  const showSuccess = useCallback(
    (message) => showNotification(message, "success"),
    [showNotification]
  );

  const showError = useCallback(
    (message) => showNotification(message, "error"),
    [showNotification]
  );

  const showWarning = useCallback(
    (message) => showNotification(message, "warning"),
    [showNotification]
  );

  const showInfo = useCallback(
    (message) => showNotification(message, "info"),
    [showNotification]
  );

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const value = {
    notifications,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
