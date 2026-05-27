import { supabase } from "./supabaseClient";
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
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const q = query(
    collection(db, 'attendance'),
    where('gymId', '==', gymId),
    where('eventTime', '>=', Timestamp.fromDate(start)),
    orderBy('eventTime', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Get attendance for a specific member
export const getMemberAttendance = async (gymId, employeeNo, limit = 30) => {
  const q = query(
    collection(db, 'attendance'),
    where('gymId', '==', gymId),
    where('employeeNo', '==', employeeNo),
    orderBy('eventTime', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.slice(0, limit).map(doc => ({ id: doc.id, ...doc.data() }))
}

// Get attendance between date range
export const getAttendanceRange = async (gymId, startDate, endDate) => {
  const q = query(
    collection(db, 'attendance'),
    where('gymId', '==', gymId),
    where('eventTime', '>=', Timestamp.fromDate(startDate)),
    where('eventTime', '<=', Timestamp.fromDate(endDate)),
    orderBy('eventTime', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Realtime subscription — Firestore onSnapshot
export const subscribeToAttendance = (gymId, onNewEvent) => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const q = query(
    collection(db, 'attendance'),
    where('gymId', '==', gymId),
    where('eventTime', '>=', Timestamp.fromDate(start)),
    orderBy('eventTime', 'desc')
  )

  const unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        onNewEvent({ id: change.doc.id, ...change.doc.data() })
      }
    })
  })

  return unsubscribe
}

  // console.log(
  //   "Querying Supabase with gymId:",
  //   gymId,
  //   "from:",
  //   start.toISOString(),
  // ); // ADD THIS

  const { data, error } = await supabase
    .from("attendance_events")
    .select("*")
    .eq("gym_id", gymId)
    .gte("event_time", start.toISOString())
    .order("event_time", { ascending: false });

  // console.log("Supabase result:", data, "error:", error); // ADD THIS

  if (error) throw error;
  return data;
};

// Get attendance for a specific member
export const getMemberAttendance = async (gymId, memberCode, limit = 30) => {
  const { data, error } = await supabase
    .from("attendance_events")
    .select("*")
    .eq("gym_id", gymId)
    .eq("employee_no", memberCode)
    .order("event_time", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

// Get attendance between date range
export const getAttendanceRange = async (gymId, startDate, endDate) => {
  const { data, error } = await supabase
    .from("attendance_events")
    .select("*")
    .eq("gym_id", gymId)
    .gte("event_time", startDate.toISOString())
    .lte("event_time", endDate.toISOString())
    .order("event_time", { ascending: false });

  if (error) throw error;
  return data;
};

// Get attendance count per day for a date range (for analytics)
export const getAttendanceCountByDay = async (gymId, startDate, endDate) => {
  const { data, error } = await supabase
    .from("attendance_events")
    .select("event_time")
    .eq("gym_id", gymId)
    .gte("event_time", startDate.toISOString())
    .lte("event_time", endDate.toISOString());

  if (error) throw error;

  // Group by date
  const counts = {};
  data.forEach((row) => {
    const date = new Date(row.event_time).toISOString().split("T")[0];
    counts[date] = (counts[date] || 0) + 1;
  });

  return counts;
};

// Live updates — replaces Firestore onSnapshot
export const subscribeToAttendance = (gymId, onNewEvent) => {
  const channel = supabase
    .channel(`attendance_${gymId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "attendance_events",
        filter: `gym_id=eq.${gymId}`,
      },
      (payload) => onNewEvent(payload.new),
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};
