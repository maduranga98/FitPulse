import { db } from "../config/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  limit,
} from "firebase/firestore";

/**
 * Submit or update a class rating
 */
export const submitRating = async (
  memberId,
  memberName,
  classId,
  className,
  gymId,
  rating,
  review = ""
) => {
  try {
    // Check if member already has a review for this class
    const existingReview = await getMemberReview(memberId, classId);

    if (existingReview) {
      // Update existing review
      await updateDoc(doc(db, "classReviews", existingReview.id), {
        rating,
        review,
        updatedAt: Timestamp.now(),
      });
      return { success: true, updated: true };
    } else {
      // Create new review
      const reviewData = {
        classId,
        className,
        memberId,
        memberName,
        gymId,
        rating,
        review,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, "classReviews"), reviewData);
      return { success: true, updated: false };
    }
  } catch (error) {
    console.error("Error submitting rating:", error);
    throw error;
  }
};

/**
 * Get all reviews for a class
 */
export const getClassReviews = async (classId) => {
  try {
    const reviewsQuery = query(
      collection(db, "classReviews"),
      where("classId", "==", classId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(reviewsQuery);
    const reviews = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return reviews;
  } catch (error) {
    console.error("Error getting class reviews:", error);
    throw error;
  }
};

/**
 * Get member's review for a specific class
 */
export const getMemberReview = async (memberId, classId) => {
  try {
    const reviewQuery = query(
      collection(db, "classReviews"),
      where("memberId", "==", memberId),
      where("classId", "==", classId),
      limit(1)
    );

    const snapshot = await getDocs(reviewQuery);
    
    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    };
  } catch (error) {
    console.error("Error getting member review:", error);
    return null;
  }
};

/**
 * Get average rating for a class
 */
export const getAverageRating = async (classId) => {
  try {
    const reviews = await getClassReviews(classId);
    
    if (reviews.length === 0) {
      return { average: 0, count: 0 };
    }

    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    const average = sum / reviews.length;

    return {
      average: Math.round(average * 10) / 10, // Round to 1 decimal
      count: reviews.length,
    };
  } catch (error) {
    console.error("Error calculating average rating:", error);
    return { average: 0, count: 0 };
  }
};

/**
 * Delete a review
 */
export const deleteReview = async (reviewId) => {
  try {
    await deleteDoc(doc(db, "classReviews", reviewId));
    return { success: true };
  } catch (error) {
    console.error("Error deleting review:", error);
    throw error;
  }
};

/**
 * Update a review
 */
export const updateReview = async (reviewId, rating, review) => {
  try {
    await updateDoc(doc(db, "classReviews", reviewId), {
      rating,
      review,
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating review:", error);
    throw error;
  }
};
