// Notification service for creating class-related notifications

export const notificationService = {
  /**
   * Send booking confirmation notification
   */
  async sendBookingConfirmation(memberId, classData) {
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      await addDoc(collection(db, "classNotifications"), {
        userId: memberId,
        type: "booking_confirmation",
        title: "Class Booked Successfully! 🎉",
        message: `You've booked ${classData.className} on ${classData.schedule?.day} at ${classData.schedule?.time}`,
        classId: classData.id,
        className: classData.className,
        read: false,
        createdAt: Timestamp.now(),
        actionUrl: "/member/classes",
      });
    } catch (error) {
      console.error("Error sending booking confirmation:", error);
    }
  },

  /**
   * Send class cancellation notification to all enrolled members
   */
  async sendClassCancellation(classId, className, enrolledMemberIds, reason = "") {
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      const message = reason
        ? `${className} has been cancelled. Reason: ${reason}`
        : `${className} has been cancelled by the instructor.`;

      // Create notification for each enrolled member
      const notificationPromises = enrolledMemberIds.map((memberId) =>
        addDoc(collection(db, "classNotifications"), {
          userId: memberId,
          type: "class_cancelled",
          title: "Class Cancelled ⚠️",
          message,
          classId,
          className,
          read: false,
          createdAt: Timestamp.now(),
          actionUrl: "/member/classes",
        })
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error("Error sending class cancellation notifications:", error);
    }
  },

  /**
   * Send class reminder notification
   */
  async sendClassReminder(memberId, classData, hoursBeforeClass) {
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      const timeText = hoursBeforeClass === 24 ? "tomorrow" : `in ${hoursBeforeClass} hour(s)`;

      await addDoc(collection(db, "classNotifications"), {
        userId: memberId,
        type: "reminder",
        title: `Class Reminder ⏰`,
        message: `Your class ${classData.className} is ${timeText} at ${classData.schedule?.time}`,
        classId: classData.id,
        className: classData.className,
        read: false,
        createdAt: Timestamp.now(),
        actionUrl: "/member/classes",
      });
    } catch (error) {
      console.error("Error sending class reminder:", error);
    }
  },

  /**
   * Send waitlist joined notification
   */
  async sendWaitlistJoined(memberId, classData, position) {
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      await addDoc(collection(db, "classNotifications"), {
        userId: memberId,
        type: "waitlist_joined",
        title: "Added to Waitlist ✅",
        message: `You're #${position} on the waitlist for ${classData.name}. We'll notify you if a spot opens!`,
        classId: classData.id,
        className: classData.name,
        read: false,
        createdAt: Timestamp.now(),
        actionUrl: "/member/classes",
      });
    } catch (error) {
      console.error("Error sending waitlist joined notification:", error);
    }
  },

  /**
   * Send waitlist promotion notification
   */
  async sendWaitlistPromotion(memberId, classData) {
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      await addDoc(collection(db, "classNotifications"), {
        userId: memberId,
        type: "waitlist_promotion",
        title: "Spot Available! 🎊",
        message: `Good news! A spot opened in ${classData.name} and you've been automatically enrolled!`,
        classId: classData.id,
        className: classData.name,
        read: false,
        createdAt: Timestamp.now(),
        actionUrl: "/member/classes",
      });
    } catch (error) {
      console.error("Error sending waitlist promotion:", error);
    }
  },

  /**
   * Send instructor change notification
   */
  async sendInstructorChange(classId, className, enrolledMemberIds, newInstructorName) {
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      const notificationPromises = enrolledMemberIds.map((memberId) =>
        addDoc(collection(db, "classNotifications"), {
          userId: memberId,
          type: "instructor_change",
          title: "Instructor Changed 👨‍🏫",
          message: `${className} will now be taught by ${newInstructorName}`,
          classId,
          className,
          read: false,
          createdAt: Timestamp.now(),
          actionUrl: "/member/classes",
        })
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error("Error sending instructor change notifications:", error);
    }
  },

  /**
   * Send booking cancellation notification
   */
  async sendBookingCancellation(memberId, classData) {
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      await addDoc(collection(db, "classNotifications"), {
        userId: memberId,
        type: "booking_cancelled",
        title: "Booking Cancelled",
        message: `Your booking for ${classData.className} on ${classData.schedule?.day} has been cancelled.`,
        classId: classData.id,
        className: classData.className,
        read: false,
        createdAt: Timestamp.now(),
        actionUrl: "/member/classes",
      });
    } catch (error) {
      console.error("Error sending booking cancellation:", error);
    }
  },
  /**
   * Send custom announcement from owner to enrolled members
   */
  async sendCustomAnnouncement(classId, className, enrolledMemberIds, title, message) {
    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import("firebase/firestore");

      const notificationPromises = enrolledMemberIds.map((memberId) =>
        addDoc(collection(db, "classNotifications"), {
          userId: memberId,
          type: "announcement",
          title: `📢 ${title}`,
          message: `${message}\n\nClass: ${className}`,
          classId,
          className,
          read: false,
          createdAt: Timestamp.now(),
          actionUrl: "/member/classes",
        })
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error("Error sending custom announcement:", error);
      throw error;
    }
  },
};
