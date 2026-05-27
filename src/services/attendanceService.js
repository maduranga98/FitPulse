import { db } from "../config/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

// Get today's attendance for a gym
export const getTodayAttendance = async (gymId) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, "attendance"),
    where("gymId", "==", gymId),
    where("eventTime", ">=", Timestamp.fromDate(start)),
    orderBy("eventTime", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Get attendance for a specific member
export const getMemberAttendance = async (gymId, employeeNo, limit = 30) => {
  const q = query(
    collection(db, "attendance"),
    where("gymId", "==", gymId),
    where("employeeNo", "==", employeeNo),
    orderBy("eventTime", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .slice(0, limit)
    .map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Get attendance between date range
export const getAttendanceRange = async (gymId, startDate, endDate) => {
  const q = query(
    collection(db, "attendance"),
    where("gymId", "==", gymId),
    where("eventTime", ">=", Timestamp.fromDate(startDate)),
    where("eventTime", "<=", Timestamp.fromDate(endDate)),
    orderBy("eventTime", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Realtime subscription — Firestore onSnapshot
export const subscribeToAttendance = (gymId, onNewEvent) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, "attendance"),
    where("gymId", "==", gymId),
    where("eventTime", ">=", Timestamp.fromDate(start)),
    orderBy("eventTime", "desc"),
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        onNewEvent({ id: change.doc.id, ...change.doc.data() });
      }
    });
  });

  return unsubscribe;
};
