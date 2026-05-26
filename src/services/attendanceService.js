import { supabase } from "./supabaseClient";

// Get today's attendance for a gym
export const getTodayAttendance = async (gymId) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("attendance_events")
    .select("*")
    .eq("gym_id", gymId)
    .gte("event_time", start.toISOString())
    .order("event_time", { ascending: false });

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
