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
    where("checkInTime", ">=", Timestamp.fromDate(start)),
    orderBy("checkInTime", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Get attendance for a specific member
export const getMemberAttendance = async (gymId, memberId, limit = 30) => {
  const q = query(
    collection(db, "attendance"),
    where("gymId", "==", gymId),
    where("memberId", "==", memberId),
    orderBy("checkInTime", "desc"),
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
    where("checkInTime", ">=", Timestamp.fromDate(startDate)),
    where("checkInTime", "<=", Timestamp.fromDate(endDate)),
    orderBy("checkInTime", "desc"),
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
    where("checkInTime", ">=", Timestamp.fromDate(start)),
    orderBy("checkInTime", "desc"),
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
