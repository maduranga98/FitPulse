// // src/services/whatsappService.js
// /**
//  * WhatsApp Service for Meta Cloud API via Firebase Cloud Function
//  * Handles sending WhatsApp notifications for gym registrations and payments
//  *
//  * Uses Firebase Cloud Function as CORS proxy to call Meta's WhatsApp API.
//  * Mirrors the smsService.js API for consistent usage across the app.
//  */

// import { validatePhoneNumber } from "./smsService";

// // WhatsApp API credentials from .env
// const WA_PHONE_NUMBER_ID = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
// const WA_ACCESS_TOKEN = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;

// /**
//  * Send a WhatsApp message via the Cloud Function proxy
//  * @param {string} phoneNumber - Recipient phone number
//  * @param {string} message - Text message content
//  * @param {string} [templateName] - Optional WhatsApp template name
//  * @param {string[]} [templateParams] - Optional template parameters
//  * @returns {Promise<Object>} - { success, messageId, timestamp } or { success: false, error }
//  */
// const sendWhatsApp = async (
//   phoneNumber,
//   message,
//   templateName = null,
//   templateParams = null
// ) => {
//   try {
//     if (!phoneNumber) {
//       throw new Error("Phone number is required");
//     }

//     if (!message && !templateName) {
//       throw new Error("Either message or templateName is required");
//     }

//     // Validate phone number
//     const validatedPhone = validatePhoneNumber(phoneNumber);
//     if (!validatedPhone) {
//       throw new Error(`Invalid phone number: ${phoneNumber}`);
//     }

//     // Import Firebase Functions SDK
//     const { getFunctions, httpsCallable } = await import(
//       "firebase/functions"
//     );
//     const { app } = await import("../config/firebase");

//     const functions = getFunctions(app);
//     const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

//     console.log("📱 Sending WhatsApp message to:", validatedPhone);

//     const result = await sendWhatsAppMessage({
//       phoneNumber: validatedPhone,
//       message,
//       templateName,
//       templateParams,
//       phoneNumberId: WA_PHONE_NUMBER_ID,
//       accessToken: WA_ACCESS_TOKEN,
//     });

//     console.log("✅ WhatsApp sent successfully:", result.data);

//     return {
//       success: true,
//       messageId: result.data?.messageId || null,
//       timestamp: result.data?.timestamp || new Date().toISOString(),
//     };
//   } catch (error) {
//     console.error("❌ WhatsApp Service Error:", error);
//     return {
//       success: false,
//       error: error.message || "Failed to send WhatsApp message",
//     };
//   }
// };

// // ========================================
// // 📝 MESSAGE BUILDERS (same content as SMS)
// // ========================================

// const buildGymRegistrationMessage = (gymName, username, password, appLink) => {
//   return `🎉 *Welcome to PulsedGym!*

// ${gymName} has been successfully registered.

// 📱 *LOGIN DETAILS:*
// URL: ${appLink}
// Username: ${username}
// Password: ${password}

// ⚠️ Keep your credentials safe.
// ✓ Do not share with anyone.`;
// };

// const buildMemberRegistrationMessage = (
//   memberName,
//   username,
//   password,
//   appLink
// ) => {
//   return `💪 *Welcome to PulsedGym, ${memberName}!*

// You have been successfully registered as a member.

// 📱 *LOGIN DETAILS:*
// URL: ${appLink}
// Username: ${username}
// Password: ${password}

// 🏋️ Track your progress, view schedules, and more!

// ⚠️ Keep your credentials safe.
// ✓ Do not share with anyone.`;
// };

// const buildPaymentReceiptMessage = (memberName, amount, month, paymentMethod) => {
//   const monthName = new Date(month + "-01").toLocaleDateString("en-US", {
//     year: "numeric",
//     month: "long",
//   });

//   return `💰 *Payment Received - PulsedGym*

// Dear ${memberName},

// Your payment has been successfully received!

// 📅 Month: ${monthName}
// 💵 Amount: Rs. ${amount.toFixed(2)}
// 💳 Method: ${paymentMethod}

// Thank you for your payment!

// For any queries, contact your gym.`;
// };

// // ========================================
// // 📤 EXPORTED FUNCTIONS
// // ========================================

// /**
//  * Send gym registration credentials via WhatsApp
//  * @param {Object} gymData - Gym registration data (must include phone)
//  * @param {string} username - Admin username
//  * @param {string} password - Admin password
//  * @returns {Promise<Object>} - WhatsApp sending result
//  */
// export const sendGymRegistrationWhatsApp = async (
//   gymData,
//   username,
//   password
// ) => {
//   console.log("📱 sendGymRegistrationWhatsApp called for:", gymData.name);

//   if (!gymData.phone) {
//     throw new Error("Gym phone number is required");
//   }

//   const appLink = "https://gymnex-65440.web.app/login";
//   const message = buildGymRegistrationMessage(
//     gymData.name,
//     username,
//     password,
//     appLink
//   );

//   const result = await sendWhatsApp(gymData.phone, message);

//   if (!result.success) {
//     console.error("🔴 WhatsApp sending failed:", result.error);
//     throw new Error(result.error);
//   }

//   console.log("🟢 WhatsApp sent successfully!");
//   return {
//     success: true,
//     message: "WhatsApp sent successfully",
//     messageId: result.messageId || null,
//     timestamp: new Date(),
//   };
// };

// /**
//  * Send member registration credentials via WhatsApp
//  * @param {Object} memberData - Member data (must include mobile or whatsapp)
//  * @param {string} username - Member username
//  * @param {string} password - Member password
//  * @returns {Promise<Object>} - WhatsApp sending result
//  */
// export const sendMemberRegistrationWhatsApp = async (
//   memberData,
//   username,
//   password
// ) => {
//   console.log("📱 sendMemberRegistrationWhatsApp called for:", memberData.name);

//   // Prefer WhatsApp number, fallback to mobile
//   const phoneNumber = memberData.whatsapp || memberData.mobile;

//   if (!phoneNumber) {
//     throw new Error("Member phone number (mobile or whatsapp) is required");
//   }

//   const appLink = "https://gymnex-65440.web.app/login";
//   const message = buildMemberRegistrationMessage(
//     memberData.name,
//     username,
//     password,
//     appLink
//   );

//   const result = await sendWhatsApp(phoneNumber, message);

//   if (!result.success) {
//     throw new Error(result.error);
//   }

//   return {
//     success: true,
//     message: "WhatsApp sent successfully",
//     messageId: result.messageId || null,
//     timestamp: new Date(),
//   };
// };

// /**
//  * Send payment receipt via WhatsApp
//  * @param {Object} memberData - Member data with phone
//  * @param {Object} paymentData - Payment details
//  * @returns {Promise<Object>} - WhatsApp sending result
//  */
// export const sendPaymentReceiptWhatsApp = async (memberData, paymentData) => {
//   console.log("📱 sendPaymentReceiptWhatsApp called for:", memberData.name);

//   // Prefer WhatsApp number, fallback to mobile
//   const phoneNumber = memberData.whatsapp || memberData.mobile;

//   if (!phoneNumber) {
//     throw new Error("Member phone number (mobile or whatsapp) is required");
//   }

//   const message = buildPaymentReceiptMessage(
//     memberData.name,
//     paymentData.amount,
//     paymentData.month,
//     paymentData.paymentMethod
//   );

//   const result = await sendWhatsApp(phoneNumber, message);

//   if (!result.success) {
//     throw new Error(result.error);
//   }

//   return {
//     success: true,
//     message: "Payment receipt WhatsApp sent successfully",
//     messageId: result.messageId || null,
//     timestamp: new Date(),
//   };
// };

// /**
//  * Send bulk WhatsApp messages
//  * @param {Array<string>} phoneNumbers - Array of phone numbers
//  * @param {string} message - Message content
//  * @returns {Promise<Object>} - Bulk WhatsApp result
//  */
// export const sendBulkWhatsApp = async (phoneNumbers, message) => {
//   console.log("📱 sendBulkWhatsApp called for:", phoneNumbers.length, "recipients");

//   const results = [];
//   let successCount = 0;
//   let failCount = 0;

//   // WhatsApp API requires individual messages (no bulk endpoint)
//   for (const phone of phoneNumbers) {
//     try {
//       const result = await sendWhatsApp(phone, message);
//       if (result.success) {
//         successCount++;
//       } else {
//         failCount++;
//       }
//       results.push({ phone, ...result });
//     } catch (error) {
//       failCount++;
//       results.push({ phone, success: false, error: error.message });
//     }
//   }

//   return {
//     success: failCount === 0,
//     totalRequested: phoneNumbers.length,
//     totalSent: successCount,
//     totalFailed: failCount,
//     results,
//     timestamp: new Date(),
//   };
// };

// src/services/whatsappService.js
/**
 * ✅ SECURE Frontend WhatsApp Service for PulsedGym
 *
 * This service calls Firebase Cloud Functions to send WhatsApp messages.
 * NO CREDENTIALS are stored in the frontend - everything happens server-side.
 *
 * Features:
 * - Member registration notifications
 * - Payment receipt messages
 * - Class reminders
 * - Attendance confirmations
 * - Supplement request updates
 * - Membership expiry warnings
 *
 * All messages use approved Meta WhatsApp templates.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../config/firebase";

const functions = getFunctions(app);

// ========================================
// 🔧 HELPER FUNCTIONS
// ========================================

/**
 * Format date for WhatsApp messages
 */
function formatDate(date) {
  if (!date) return new Date().toISOString().split("T")[0];

  if (typeof date === "string") {
    return date.split("T")[0];
  }

  if (date.toDate) {
    // Firestore Timestamp
    return date.toDate().toISOString().split("T")[0];
  }

  return new Date(date).toISOString().split("T")[0];
}

/**
 * Format time for WhatsApp messages
 */
function formatTime(date) {
  if (!date)
    return new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  let dateObj;

  if (date.toDate) {
    dateObj = date.toDate();
  } else if (typeof date === "string") {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  return dateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get phone number from member data (prefer WhatsApp, fallback to mobile)
 */
function getPhoneNumber(memberData) {
  const phone = memberData.whatsapp || memberData.mobile;

  if (!phone) {
    throw new Error("Member has no phone number");
  }

  return phone;
}

// ========================================
// 📱 WHATSAPP MESSAGE FUNCTIONS
// ========================================

/**
 * Send gym registration credentials via WhatsApp
 * Uses template: gym_registration
 *
 * @param {Object} gymData - Gym data (must include name and phone)
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendGymRegistrationWhatsApp(gymData, username, password) {
  try {
    console.log("📱 Sending gym registration WhatsApp to:", gymData.name);

    const phone = gymData.phone;
    if (!phone) {
      throw new Error("Gym phone number is required");
    }

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "gym_registration",
      params: {
        gymName: gymData.name,
        username,
        password,
      },
    });

    console.log("✅ Gym registration WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send gym registration WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send member registration credentials via WhatsApp
 * Uses template: member_registration
 *
 * @param {Object} memberData - Member data
 * @param {string} username - Generated username
 * @param {string} password - Generated password
 * @param {string} gymName - Gym name
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendMemberRegistrationWhatsApp(
  memberData,
  username,
  password,
  gymName,
) {
  try {
    console.log("📱 Sending member registration WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "member_registration",
      params: {
        memberName: memberData.name,
        username,
        password,
        gymName,
      },
    });

    console.log("✅ Member registration WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send member registration WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send welcome message to new member via WhatsApp
 * Uses template: welcome_member
 *
 * @param {Object} memberData - Member data (must include name, phone, id)
 * @param {string} gymName - Gym name
 * @param {string} startDate - Membership start date
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendWelcomeMemberWhatsApp(memberData, gymName, startDate) {
  try {
    console.log("📱 Sending welcome member WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "welcome_member",
      params: {
        gymName,
        memberName: memberData.name,
        memberId: memberData.id || "",
        startDate,
      },
    });

    console.log("✅ Welcome member WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send welcome member WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send payment receipt via WhatsApp
 * Uses template: payment_received (APPROVED ✅)
 *
 * @param {Object} memberData - Member data
 * @param {Object} paymentData - Payment details
 * @param {string} gymName - Gym name
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendPaymentReceiptWhatsApp(
  memberData,
  paymentData,
  gymName,
) {
  try {
    console.log("📱 Sending payment receipt WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    // Generate receipt ID (you can customize this format)
    const receiptId = `RCP-${Date.now().toString().slice(-8)}`;

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "payment_received",
      params: {
        memberName: memberData.name,
        amount: paymentData.amount.toString(),
        gymName,
        date: formatDate(paymentData.paidAt),
        receiptId,
      },
    });

    console.log("✅ Payment receipt WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send payment receipt WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send class reminder via WhatsApp
 * Uses template: class_reminder
 *
 * @param {Object} memberData - Member data
 * @param {Object} classData - Class details
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendClassReminderWhatsApp(memberData, classData) {
  try {
    console.log("📱 Sending class reminder WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "class_reminder",
      params: {
        memberName: memberData.name,
        className: classData.name,
        time: classData.time,
        instructor: classData.instructor || "TBA",
      },
    });

    console.log("✅ Class reminder WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send class reminder WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send attendance check-in confirmation via WhatsApp
 * Uses template: attendance_checkin
 *
 * @param {Object} memberData - Member data
 * @param {string} checkInTime - Check-in time
 * @param {string} gymName - Gym name
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendAttendanceCheckinWhatsApp(
  memberData,
  checkInTime,
  gymName,
) {
  try {
    console.log("📱 Sending attendance check-in WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "attendance_checkin",
      params: {
        memberName: memberData.name,
        time: formatTime(checkInTime),
        gymName,
      },
    });

    console.log("✅ Attendance check-in WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send attendance check-in WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send membership expiry warning via WhatsApp
 * Uses template: membership_expiry
 *
 * @param {Object} memberData - Member data
 * @param {string} expiryDate - Membership expiry date
 * @param {number} daysRemaining - Days until expiry
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendMembershipExpiryWhatsApp(
  memberData,
  expiryDate,
  daysRemaining,
) {
  try {
    console.log("📱 Sending membership expiry WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "membership_expiry",
      params: {
        memberName: memberData.name,
        expiryDate: formatDate(expiryDate),
        daysRemaining: daysRemaining.toString(),
      },
    });

    console.log("✅ Membership expiry WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send membership expiry WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send supplement request approved notification via WhatsApp
 * Uses template: supplement_approved
 *
 * @param {Object} memberData - Member data
 * @param {string} supplementName - Supplement name
 * @param {string} quantity - Quantity approved
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendSupplementApprovedWhatsApp(
  memberData,
  supplementName,
  quantity,
) {
  try {
    console.log("📱 Sending supplement approved WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "supplement_approved",
      params: {
        memberName: memberData.name,
        supplementName,
        quantity,
      },
    });

    console.log("✅ Supplement approved WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send supplement approved WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send supplement request rejected notification via WhatsApp
 * Uses template: supplement_rejected
 *
 * @param {Object} memberData - Member data
 * @param {string} supplementName - Supplement name
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendSupplementRejectedWhatsApp(
  memberData,
  supplementName,
  reason,
) {
  try {
    console.log("📱 Sending supplement rejected WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "supplement_rejected",
      params: {
        memberName: memberData.name,
        supplementName,
        reason,
      },
    });

    console.log("✅ Supplement rejected WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send supplement rejected WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send payment reminder via WhatsApp
 * Uses template: payment_reminder
 *
 * @param {Object} memberData - Member data
 * @param {string} month - Payment month
 * @param {number} amount - Amount due
 * @param {string} dueDate - Payment due date
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendPaymentReminderWhatsApp(
  memberData,
  month,
  amount,
  dueDate,
) {
  try {
    console.log("📱 Sending payment reminder WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "payment_reminder",
      params: {
        memberName: memberData.name,
        month,
        amount: amount.toString(),
        dueDate: formatDate(dueDate),
      },
    });

    console.log("✅ Payment reminder WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send payment reminder WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

/**
 * Send schedule change notification via WhatsApp
 * Uses template: schedule_change
 *
 * @param {Object} memberData - Member data
 * @param {string} className - Class name
 * @param {string} originalTime - Original class time
 * @param {string} newTime - New class time
 * @param {string} date - Class date
 * @returns {Promise<Object>} - Result { success, messageId }
 */
export async function sendScheduleChangeWhatsApp(
  memberData,
  className,
  originalTime,
  newTime,
  date,
) {
  try {
    console.log("📱 Sending schedule change WhatsApp to:", memberData.name);

    const phone = getPhoneNumber(memberData);

    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    const result = await sendWhatsAppMessage({
      phone,
      templateName: "schedule_change",
      params: {
        memberName: memberData.name,
        className,
        originalTime,
        newTime,
        date: formatDate(date),
      },
    });

    console.log("✅ Schedule change WhatsApp sent successfully");

    return {
      success: true,
      messageId: result.data.messageId,
      timestamp: result.data.timestamp,
    };
  } catch (error) {
    console.error("❌ Failed to send schedule change WhatsApp:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}

// ========================================
// 🧪 TESTING FUNCTION
// ========================================

/**
 * Test WhatsApp functionality with approved template
 *
 * @param {string} phone - Test phone number
 * @returns {Promise<Object>} - Test result
 */
export async function testWhatsAppConnection(phone) {
  try {
    console.log("🧪 Testing WhatsApp connection...");

    const testWhatsAppMessage = httpsCallable(functions, "testWhatsAppMessage");

    const result = await testWhatsAppMessage({
      phone,
      templateName: "payment_received",
      params: {
        memberName: "Test User",
        amount: "5000",
        gymName: "Test Gym",
        date: formatDate(new Date()),
        receiptId: "TEST-001",
      },
    });

    console.log("✅ WhatsApp test successful:", result.data);

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("❌ WhatsApp test failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
