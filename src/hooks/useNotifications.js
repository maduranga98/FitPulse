import { useState, useEffect } from "react";

export const useNotifications = (userId) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    let unsubscribe;

    const setupListener = async () => {
      try {
        const { db } = await import("../config/firebase");
        const { collection, query, where, orderBy, onSnapshot, limit } = await import(
          "firebase/firestore"
        );

        // Create query for user's notifications
        const notificationsQuery = query(
          collection(db, "classNotifications"),
          where("userId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(20)
        );

        // Set up real-time listener
        unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
          const notificationsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate
              ? doc.data().createdAt.toDate()
              : new Date(doc.data().createdAt),
          }));

          setNotifications(notificationsData);
          setUnreadCount(notificationsData.filter((n) => !n.read).length);
          setLoading(false);
        });
      } catch (error) {
        console.error("Error setting up notifications listener:", error);
        setLoading(false);
      }
    };

    setupListener();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId]);

  const markAsRead = async (notificationId) => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      await updateDoc(doc(db, "classNotifications", notificationId), {
        read: true,
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      const unreadNotifications = notifications.filter((n) => !n.read);
      const updatePromises = unreadNotifications.map((notification) =>
        updateDoc(doc(db, "classNotifications", notification.id), {
          read: true,
        })
      );

      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      await deleteDoc(doc(db, "classNotifications", notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const clearAll = async () => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");

      const deletePromises = notifications.map((notification) =>
        deleteDoc(doc(db, "classNotifications", notification.id))
      );

      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  };

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
};
