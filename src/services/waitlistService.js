import { db } from "../config/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  updateDoc,
  limit,
} from "firebase/firestore";
import { notificationService } from "./notificationService";

/**
 * Add member to class waitlist
 */
export const addToWaitlist = async (
  memberId,
  memberName,
  memberEmail,
  classId,
  className,
  gymId
) => {
  try {
    // Check if member is already on waitlist
    const existingQuery = query(
      collection(db, "classWaitlist"),
      where("classId", "==", classId),
      where("memberId", "==", memberId),
      where("status", "==", "waiting")
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      throw new Error("You are already on the waitlist for this class");
    }

    // Get current waitlist size to determine position
    const waitlistQuery = query(
      collection(db, "classWaitlist"),
      where("classId", "==", classId),
      where("status", "==", "waiting")
    );
    const waitlistSnapshot = await getDocs(waitlistQuery);
    const position = waitlistSnapshot.size + 1;

    // Add to waitlist
    const waitlistEntry = {
      classId,
      className,
      memberId,
      memberName,
      memberEmail,
      gymId,
      joinedAt: Timestamp.now(),
      position,
      status: "waiting",
    };

    const docRef = await addDoc(collection(db, "classWaitlist"), waitlistEntry);

    // Send notification
    await notificationService.sendWaitlistJoined(
      memberId,
      { id: classId, name: className },
      position
    );

    return { success: true, waitlistId: docRef.id, position };
  } catch (error) {
    console.error("Error adding to waitlist:", error);
    throw error;
  }
};

/**
 * Remove member from waitlist
 */
export const removeFromWaitlist = async (waitlistId) => {
  try {
    await deleteDoc(doc(db, "classWaitlist", waitlistId));

    // Note: Position updates will happen when viewing the list
    // to avoid complex cascading updates

    return { success: true };
  } catch (error) {
    console.error("Error removing from waitlist:", error);
    throw error;
  }
};

/**
 * Get waitlist for a specific class
 */
export const getClassWaitlist = async (classId) => {
  try {
    const waitlistQuery = query(
      collection(db, "classWaitlist"),
      where("classId", "==", classId),
      where("status", "==", "waiting"),
      orderBy("joinedAt", "asc")
    );

    const snapshot = await getDocs(waitlistQuery);
    const waitlist = snapshot.docs.map((doc, index) => ({
      id: doc.id,
      ...doc.data(),
      position: index + 1, // Calculate position based on order
    }));

    return waitlist;
  } catch (error) {
    console.error("Error getting class waitlist:", error);
    throw error;
  }
};

/**
 * Get member's waitlist entries
 */
export const getMemberWaitlist = async (memberId) => {
  try {
    const waitlistQuery = query(
      collection(db, "classWaitlist"),
      where("memberId", "==", memberId),
      where("status", "==", "waiting"),
      orderBy("joinedAt", "desc")
    );

    const snapshot = await getDocs(waitlistQuery);
    const waitlist = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return waitlist;
  } catch (error) {
    console.error("Error getting member waitlist:", error);
    throw error;
  }
};

/**
 * Get waitlist position for a member in a specific class
 */
export const getWaitlistPosition = async (memberId, classId) => {
  try {
    const waitlist = await getClassWaitlist(classId);
    const memberEntry = waitlist.find((entry) => entry.memberId === memberId);
    return memberEntry ? memberEntry.position : null;
  } catch (error) {
    console.error("Error getting waitlist position:", error);
    return null;
  }
};

/**
 * Promote next member from waitlist (called when a spot opens)
 */
export const promoteFromWaitlist = async (classId, className, gymId) => {
  try {
    // Get the first person in the waitlist
    const waitlistQuery = query(
      collection(db, "classWaitlist"),
      where("classId", "==", classId),
      where("status", "==", "waiting"),
      orderBy("joinedAt", "asc"),
      limit(1)
    );

    const snapshot = await getDocs(waitlistQuery);

    if (snapshot.empty) {
      // No one on waitlist
      return { success: true, promoted: false };
    }

    const firstInLine = snapshot.docs[0];
    const waitlistData = firstInLine.data();

    // Create booking for the promoted member
    const bookingData = {
      classId,
      className,
      memberId: waitlistData.memberId,
      memberName: waitlistData.memberName,
      gymId,
      bookedAt: Timestamp.now(),
      status: "confirmed",
    };

    await addDoc(collection(db, "classBookings"), bookingData);

    // Update waitlist entry status to 'promoted'
    await updateDoc(doc(db, "classWaitlist", firstInLine.id), {
      status: "promoted",
      promotedAt: Timestamp.now(),
    });

    // Send promotion notification
    await notificationService.sendWaitlistPromotion(
      waitlistData.memberId,
      { id: classId, name: className }
    );

    return {
      success: true,
      promoted: true,
      memberName: waitlistData.memberName,
    };
  } catch (error) {
    console.error("Error promoting from waitlist:", error);
    throw error;
  }
};

/**
 * Check if member is on waitlist for a class
 */
export const isOnWaitlist = async (memberId, classId) => {
  try {
    const waitlistQuery = query(
      collection(db, "classWaitlist"),
      where("classId", "==", classId),
      where("memberId", "==", memberId),
      where("status", "==", "waiting")
    );

    const snapshot = await getDocs(waitlistQuery);
    return !snapshot.empty ? snapshot.docs[0].id : null;
  } catch (error) {
    console.error("Error checking waitlist status:", error);
    return null;
  }
};

/**
 * Get waitlist count for a class
 */
export const getWaitlistCount = async (classId) => {
  try {
    const waitlistQuery = query(
      collection(db, "classWaitlist"),
      where("classId", "==", classId),
      where("status", "==", "waiting")
    );

    const snapshot = await getDocs(waitlistQuery);
    return snapshot.size;
  } catch (error) {
    console.error("Error getting waitlist count:", error);
    return 0;
  }
};
