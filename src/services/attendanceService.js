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

// Get attendance for a specific member.
// Equality-only filters (no orderBy) so no composite index is required;
// sorted newest-first client-side.
export const getMemberAttendance = async (gymId, memberId, limit = 30) => {
  const q = query(
    collection(db, "attendance"),
    where("gymId", "==", gymId),
    where("memberId", "==", memberId),
  );

  const snapshot = await getDocs(q);
  const toMillis = (record) => {
    if (record.checkInTime?.toMillis) return record.checkInTime.toMillis();
    if (record.checkInTime?.seconds) return record.checkInTime.seconds * 1000;
    return 0;
  };
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => toMillis(b) - toMillis(a))
    .slice(0, limit);
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
