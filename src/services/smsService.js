// src/services/smsService.js
/**
 * SMS Service - uses Firebase Cloud Function (sendSMSNotification) as primary path.
 * Falls back to direct text.lk API call if the Cloud Function is not yet deployed
 * and VITE_API_TOKEN / VITE_HTTP_ENDPOINT are set in the environment.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../config/firebase";
import { APP_URL } from "../config/app";

// Initialise at module level (same pattern as whatsappService.js)
const firebaseFunctions = getFunctions(app);

// Direct-call fallback env vars (set in .env if Cloud Function is not deployed)
const DIRECT_API_TOKEN = import.meta.env.VITE_API_TOKEN;
const DIRECT_ENDPOINT =
  import.meta.env.VITE_HTTP_ENDPOINT || "https://app.text.lk/api/v3/sms/send";
const SENDER_ID = import.meta.env.VITE_TEXTLK_SENDER_ID || "Lumora Tech";

/**
 * Validate phone number (Sri Lankan format) - IMPROVED VERSION
 * Accepts: 0712345678, 712345678, +94712345678, 0094712345678, 071-234-5678, 071 234 5678
 */
const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== "string") {
    console.error("❌ Invalid phone input:", phone, typeof phone);
    return null;
  }

  // Remove ALL non-numeric characters (spaces, dashes, parentheses, plus signs)
  let cleaned = phone.replace(/\D/g, "");

  // console.log("🔍 Validating phone:", phone, "→ Cleaned:", cleaned);

  // Handle different formats
  if (cleaned.startsWith("94")) {
    // Already has country code: 94712345678
    cleaned = cleaned;
  } else if (cleaned.startsWith("0")) {
    // Local format with leading 0: 0712345678
    cleaned = "94" + cleaned.slice(1);
  } else if (cleaned.length === 9) {
    // Missing country code and leading 0: 712345678
    cleaned = "94" + cleaned;
  } else {
    // Invalid format
    console.error("❌ Invalid phone format:", phone, "→", cleaned);
    return null;
  }

  // Validate final format: 94 followed by 9 digits (total 11 digits)
  const phoneRegex = /^94\d{9}$/;

  if (!phoneRegex.test(cleaned)) {
    console.error(
      "❌ Phone validation failed:",
      phone,
      "→",
      cleaned,
      "doesn't match format 94XXXXXXXXX"
    );
    return null;
  }

  // console.log("✅ Phone validated successfully:", phone, "→", cleaned);
  return cleaned;
};

/**
 * Build SMS message for gym registration
 */
const buildGymRegistrationMessage = (gymName, username, password, appLink) => {
  return `🎉 Welcome to PulsedGym!

${gymName} has been successfully registered.

📱 LOGIN DETAILS:
URL: ${appLink}
Username: ${username}
Password: ${password}

⚠️ Keep your credentials safe.
✓ Do not share with anyone.`;
};

/**
 * Build SMS message for member registration
 */
const buildMemberRegistrationMessage = (
  memberName,
  username,
  password,
  appLink
) => {
  return `💪 Welcome to PulsedGym, ${memberName}!

You have been successfully registered as a member.

📱 LOGIN DETAILS:
URL: ${appLink}
Username: ${username}
Password: ${password}

🏋️ Track your progress, view schedules, and more!

⚠️ Keep your credentials safe.
✓ Do not share with anyone.`;
};

/**
 * Build SMS message for payment receipt
 */
const buildPaymentReceiptMessage = (
  memberName,
  amount,
  month,
  paymentMethod
) => {
  const monthName = new Date(month + "-01").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return `💰 Payment Received - PulsedGym

Dear ${memberName},

Your payment has been successfully received!

📅 Month: ${monthName}
💵 Amount: Rs. ${amount.toFixed(2)}
💳 Method: ${paymentMethod}

Thank you for your payment!

For any queries, contact your gym.`;
};

/**
 * Core SMS dispatcher.
 * 1. Tries the Firebase Cloud Function `sendSMSNotification` (server-side, no CORS).
 * 2. Falls back to a direct text.lk API call if the function is unavailable and
 *    VITE_API_TOKEN + VITE_HTTP_ENDPOINT are configured.
 */
const sendSMS = async (recipients, message) => {
  try {
    if (!recipients || !message) {
      throw new Error("Recipients and message are required");
    }

    const recipientList = Array.isArray(recipients) ? recipients : [recipients];
    const formattedPhones = recipientList.map(validatePhoneNumber).filter(Boolean);

    if (formattedPhones.length === 0) {
      throw new Error(
        `No valid phone numbers. Input: ${JSON.stringify(recipientList)}`
      );
    }

    if (message.length > 3000) {
      throw new Error("Message too long (max 3000 characters)");
    }

    const recipientStr = formattedPhones.join(",");

    // ── Path 1: Firebase Cloud Function ──────────────────────────────────────
    try {
      const sendSMSCallable = httpsCallable(firebaseFunctions, "sendSMSNotification");
      const result = await sendSMSCallable({ recipient: recipientStr, message });
      console.log("✅ SMS sent via Cloud Function");
      return { success: true, data: result.data, recipients: formattedPhones, message };
    } catch (cfError) {
      // Function not deployed yet or unavailable — log and fall through
      console.warn(
        "⚠️ Cloud Function sendSMSNotification unavailable, trying direct API:",
        cfError.code || cfError.message
      );
    }

    // ── Path 2: Direct text.lk API call (fallback) ───────────────────────────
    if (!DIRECT_API_TOKEN) {
      throw new Error(
        "SMS not configured: deploy the sendSMSNotification Cloud Function and set " +
        "TEXTLK_API_TOKEN, OR set VITE_API_TOKEN and VITE_HTTP_ENDPOINT in your .env file."
      );
    }

    const response = await fetch(DIRECT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECT_API_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient: recipientStr,
        sender_id: SENDER_ID,
        type: "plain",
        message,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.status === "error") {
      throw new Error(data.message || `SMS API error: ${response.status}`);
    }

    console.log("✅ SMS sent via direct API");
    return { success: true, data, recipients: formattedPhones, message };
  } catch (error) {
    console.error("❌ SMS Service Error:", error.message);
    return { success: false, error: error.message, recipients };
  }
};

/**
 * Send gym registration credentials via SMS
 * @param {Object} gymData - Gym registration data
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<Object>} - SMS sending result
 */
export const sendGymRegistrationSMS = async (gymData, username, password) => {
  // console.log("🔵 sendGymRegistrationSMS called with:", {
  //   name: gymData.name,
  //   phone: gymData.phone,
  //   phoneType: typeof gymData.phone,
  //   phoneLength: gymData.phone?.length,
  // });

  if (!gymData.phone) {
    throw new Error("Gym phone number is required");
  }

  const appLink = `${APP_URL}/login`;
  const message = buildGymRegistrationMessage(
    gymData.name,
    username,
    password,
    appLink
  );

  // console.log("📝 Message prepared, length:", message.length);

  const result = await sendSMS(gymData.phone, message);

  if (!result.success) {
    console.error("🔴 SMS sending failed:", result.error);
    throw new Error(result.error);
  }

  console.log("🟢 SMS sent successfully!");
  return {
    success: true,
    message: "SMS sent successfully",
    smsId: result.data?.data?.id || null,
    timestamp: new Date(),
  };
};

/**
 * Send member registration credentials via SMS
 * @param {Object} memberData - Member registration data
 * @param {string} username - Member username
 * @param {string} password - Member password
 * @returns {Promise<Object>} - SMS sending result
 */
export const sendMemberRegistrationSMS = async (
  memberData,
  username,
  password
) => {
  console.log("🔵 sendMemberRegistrationSMS called with:", {
    name: memberData.name,
    mobile: memberData.mobile,
    whatsapp: memberData.whatsapp,
  });

  // Use mobile number, fallback to whatsapp
  const phoneNumber = memberData.mobile || memberData.whatsapp;

  if (!phoneNumber) {
    throw new Error("Member phone number (mobile or whatsapp) is required");
  }

  const appLink = `${APP_URL}/login`;
  const message = buildMemberRegistrationMessage(
    memberData.name,
    username,
    password,
    appLink
  );

  const result = await sendSMS(phoneNumber, message);

  if (!result.success) {
    throw new Error(result.error);
  }

  return {
    success: true,
    message: "SMS sent successfully",
    smsId: result.data?.data?.id || null,
    timestamp: new Date(),
  };
};

/**
 * Send payment receipt SMS to member
 * @param {Object} memberData - Member data with phone
 * @param {Object} paymentData - Payment details
 * @returns {Promise<Object>} - SMS sending result
 */
export const sendPaymentReceiptSMS = async (memberData, paymentData) => {
  console.log("🔵 sendPaymentReceiptSMS called with:", {
    name: memberData.name,
    mobile: memberData.mobile,
    whatsapp: memberData.whatsapp,
    amount: paymentData.amount,
  });

  // Use mobile number, fallback to whatsapp
  const phoneNumber = memberData.mobile || memberData.whatsapp;

  if (!phoneNumber) {
    throw new Error("Member phone number (mobile or whatsapp) is required");
  }

  const message = buildPaymentReceiptMessage(
    memberData.name,
    paymentData.amount,
    paymentData.month,
    paymentData.paymentMethod
  );

  const result = await sendSMS(phoneNumber, message);

  if (!result.success) {
    throw new Error(result.error);
  }

  return {
    success: true,
    message: "Payment receipt SMS sent successfully",
    smsId: result.data?.data?.id || null,
    timestamp: new Date(),
  };
};

/**
 * Send bulk SMS (for member notifications, etc.)
 * @param {Array<string>} phoneNumbers - Array of phone numbers
 * @param {string} message - SMS message content
 * @returns {Promise<Object>} - Bulk SMS result
 */
export const sendBulkSMS = async (phoneNumbers, message) => {
  console.log("🔵 sendBulkSMS called with:", {
    phoneCount: phoneNumbers.length,
    phones: phoneNumbers,
  });

  const result = await sendSMS(phoneNumbers, message);

  if (!result.success) {
    throw new Error(result.error);
  }

  return {
    success: true,
    totalRequested: phoneNumbers.length,
    totalValid: result.recipients.length,
    smsData: result.data,
    timestamp: new Date(),
  };
};

export { validatePhoneNumber };
