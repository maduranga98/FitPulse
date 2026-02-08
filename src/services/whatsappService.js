// src/services/whatsappService.js
/**
 * WhatsApp Service for Meta Cloud API via Firebase Cloud Function
 * Handles sending WhatsApp notifications for gym registrations and payments
 *
 * Uses Firebase Cloud Function as CORS proxy to call Meta's WhatsApp API.
 * Mirrors the smsService.js API for consistent usage across the app.
 */

import { validatePhoneNumber } from "./smsService";

// WhatsApp API credentials from .env
const WA_PHONE_NUMBER_ID = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
const WA_ACCESS_TOKEN = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;

/**
 * Send a WhatsApp message via the Cloud Function proxy
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - Text message content
 * @param {string} [templateName] - Optional WhatsApp template name
 * @param {string[]} [templateParams] - Optional template parameters
 * @returns {Promise<Object>} - { success, messageId, timestamp } or { success: false, error }
 */
const sendWhatsApp = async (
  phoneNumber,
  message,
  templateName = null,
  templateParams = null
) => {
  try {
    if (!phoneNumber) {
      throw new Error("Phone number is required");
    }

    if (!message && !templateName) {
      throw new Error("Either message or templateName is required");
    }

    // Validate phone number
    const validatedPhone = validatePhoneNumber(phoneNumber);
    if (!validatedPhone) {
      throw new Error(`Invalid phone number: ${phoneNumber}`);
    }

    // Import Firebase Functions SDK
    const { getFunctions, httpsCallable } = await import(
      "firebase/functions"
    );
    const { app } = await import("../config/firebase");

    const functions = getFunctions(app);
    const sendWhatsAppMessage = httpsCallable(functions, "sendWhatsAppMessage");

    console.log("📱 Sending WhatsApp message to:", validatedPhone);

    const result = await sendWhatsAppMessage({
      phoneNumber: validatedPhone,
      message,
      templateName,
      templateParams,
      phoneNumberId: WA_PHONE_NUMBER_ID,
      accessToken: WA_ACCESS_TOKEN,
    });

    console.log("✅ WhatsApp sent successfully:", result.data);

    return {
      success: true,
      messageId: result.data?.messageId || null,
      timestamp: result.data?.timestamp || new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ WhatsApp Service Error:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
};

// ========================================
// 📝 MESSAGE BUILDERS (same content as SMS)
// ========================================

const buildGymRegistrationMessage = (gymName, username, password, appLink) => {
  return `🎉 *Welcome to PulsedGym!*

${gymName} has been successfully registered.

📱 *LOGIN DETAILS:*
URL: ${appLink}
Username: ${username}
Password: ${password}

⚠️ Keep your credentials safe.
✓ Do not share with anyone.`;
};

const buildMemberRegistrationMessage = (
  memberName,
  username,
  password,
  appLink
) => {
  return `💪 *Welcome to PulsedGym, ${memberName}!*

You have been successfully registered as a member.

📱 *LOGIN DETAILS:*
URL: ${appLink}
Username: ${username}
Password: ${password}

🏋️ Track your progress, view schedules, and more!

⚠️ Keep your credentials safe.
✓ Do not share with anyone.`;
};

const buildPaymentReceiptMessage = (memberName, amount, month, paymentMethod) => {
  const monthName = new Date(month + "-01").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return `💰 *Payment Received - PulsedGym*

Dear ${memberName},

Your payment has been successfully received!

📅 Month: ${monthName}
💵 Amount: Rs. ${amount.toFixed(2)}
💳 Method: ${paymentMethod}

Thank you for your payment!

For any queries, contact your gym.`;
};

// ========================================
// 📤 EXPORTED FUNCTIONS
// ========================================

/**
 * Send gym registration credentials via WhatsApp
 * @param {Object} gymData - Gym registration data (must include phone)
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<Object>} - WhatsApp sending result
 */
export const sendGymRegistrationWhatsApp = async (
  gymData,
  username,
  password
) => {
  console.log("📱 sendGymRegistrationWhatsApp called for:", gymData.name);

  if (!gymData.phone) {
    throw new Error("Gym phone number is required");
  }

  const appLink = "https://gymnex-65440.web.app/login";
  const message = buildGymRegistrationMessage(
    gymData.name,
    username,
    password,
    appLink
  );

  const result = await sendWhatsApp(gymData.phone, message);

  if (!result.success) {
    console.error("🔴 WhatsApp sending failed:", result.error);
    throw new Error(result.error);
  }

  console.log("🟢 WhatsApp sent successfully!");
  return {
    success: true,
    message: "WhatsApp sent successfully",
    messageId: result.messageId || null,
    timestamp: new Date(),
  };
};

/**
 * Send member registration credentials via WhatsApp
 * @param {Object} memberData - Member data (must include mobile or whatsapp)
 * @param {string} username - Member username
 * @param {string} password - Member password
 * @returns {Promise<Object>} - WhatsApp sending result
 */
export const sendMemberRegistrationWhatsApp = async (
  memberData,
  username,
  password
) => {
  console.log("📱 sendMemberRegistrationWhatsApp called for:", memberData.name);

  // Prefer WhatsApp number, fallback to mobile
  const phoneNumber = memberData.whatsapp || memberData.mobile;

  if (!phoneNumber) {
    throw new Error("Member phone number (mobile or whatsapp) is required");
  }

  const appLink = "https://gymnex-65440.web.app/login";
  const message = buildMemberRegistrationMessage(
    memberData.name,
    username,
    password,
    appLink
  );

  const result = await sendWhatsApp(phoneNumber, message);

  if (!result.success) {
    throw new Error(result.error);
  }

  return {
    success: true,
    message: "WhatsApp sent successfully",
    messageId: result.messageId || null,
    timestamp: new Date(),
  };
};

/**
 * Send payment receipt via WhatsApp
 * @param {Object} memberData - Member data with phone
 * @param {Object} paymentData - Payment details
 * @returns {Promise<Object>} - WhatsApp sending result
 */
export const sendPaymentReceiptWhatsApp = async (memberData, paymentData) => {
  console.log("📱 sendPaymentReceiptWhatsApp called for:", memberData.name);

  // Prefer WhatsApp number, fallback to mobile
  const phoneNumber = memberData.whatsapp || memberData.mobile;

  if (!phoneNumber) {
    throw new Error("Member phone number (mobile or whatsapp) is required");
  }

  const message = buildPaymentReceiptMessage(
    memberData.name,
    paymentData.amount,
    paymentData.month,
    paymentData.paymentMethod
  );

  const result = await sendWhatsApp(phoneNumber, message);

  if (!result.success) {
    throw new Error(result.error);
  }

  return {
    success: true,
    message: "Payment receipt WhatsApp sent successfully",
    messageId: result.messageId || null,
    timestamp: new Date(),
  };
};

/**
 * Send bulk WhatsApp messages
 * @param {Array<string>} phoneNumbers - Array of phone numbers
 * @param {string} message - Message content
 * @returns {Promise<Object>} - Bulk WhatsApp result
 */
export const sendBulkWhatsApp = async (phoneNumbers, message) => {
  console.log("📱 sendBulkWhatsApp called for:", phoneNumbers.length, "recipients");

  const results = [];
  let successCount = 0;
  let failCount = 0;

  // WhatsApp API requires individual messages (no bulk endpoint)
  for (const phone of phoneNumbers) {
    try {
      const result = await sendWhatsApp(phone, message);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
      results.push({ phone, ...result });
    } catch (error) {
      failCount++;
      results.push({ phone, success: false, error: error.message });
    }
  }

  return {
    success: failCount === 0,
    totalRequested: phoneNumbers.length,
    totalSent: successCount,
    totalFailed: failCount,
    results,
    timestamp: new Date(),
  };
};
