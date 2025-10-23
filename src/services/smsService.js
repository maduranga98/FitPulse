// src/services/smsService.js
/**
 * SMS Service for text.lk API
 * Handles sending SMS notifications for gym registrations and payments
 *
 * FIXED: Using POST with form-urlencoded body instead of GET
 * This prevents double-encoding and ensures proper message delivery
 */

// text.lk API Configuration - Using HTTP endpoint
const TEXTLK_HTTP_ENDPOINT = import.meta.env.VITE_HTTP_ENDPOINT;
const API_TOKEN = import.meta.env.VITE_API_TOKEN;
const SENDER_ID = import.meta.env.VITE_TEXTLK_SENDER_ID || "Lumora Tech";

/**
 * Validate phone number (Sri Lankan format)
 * Accepts: 071234567, +94712345678, 0094712345678
 */
const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== "string") return null;

  // Remove spaces and common formatting
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // Convert to +94 format for validation, but API needs without +
  if (cleaned.startsWith("0")) {
    cleaned = "94" + cleaned.slice(1);
  } else if (cleaned.startsWith("0094")) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith("+94")) {
    cleaned = cleaned.slice(1);
  } else if (!cleaned.startsWith("94")) {
    cleaned = "94" + cleaned;
  }

  // Validate format: 94 followed by 9 digits
  const phoneRegex = /^94\d{9}$/;
  return phoneRegex.test(cleaned) ? cleaned : null;
};

/**
 * Build SMS message for gym registration
 */
const buildGymRegistrationMessage = (gymName, username, password, appLink) => {
  return `🎉 Welcome to GymNex!

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
  return `💪 Welcome to GymNex, ${memberName}!

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

  return `💰 Payment Received - GymNex

Dear ${memberName},

Your payment has been successfully received!

📅 Month: ${monthName}
💵 Amount: Rs. ${amount.toFixed(2)}
💳 Method: ${paymentMethod}

Thank you for your payment!

For any queries, contact your gym.`;
};

/**
 * Send SMS via text.lk API
 * @param {string|string[]} recipients - Single phone or array of phones
 * @param {string} message - SMS message content
 * @returns {Promise<Object>} - API response
 */
const sendSMS = async (recipients, message) => {
  try {
    if (!API_TOKEN) {
      throw new Error(
        "SMS API token not configured. Add VITE_TEXTLK_API_TOKEN to environment."
      );
    }

    if (!recipients || !message) {
      throw new Error("Recipients and message are required");
    }

    // Handle single or array
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];

    // Validate and format all
    const formattedPhones = recipientList
      .map(validatePhoneNumber)
      .filter(Boolean);

    if (formattedPhones.length === 0) {
      throw new Error("No valid phone numbers provided");
    }

    if (formattedPhones.length < recipientList.length) {
      console.warn(
        `${
          recipientList.length - formattedPhones.length
        } invalid phone numbers skipped`
      );
    }

    // Validate message length
    if (message.length > 3000) {
      throw new Error("Message too long (max 3000 characters)");
    }

    // ✅ FIXED: Use POST with form-urlencoded body
    // This prevents double-encoding and properly handles multiline messages
    const params = new URLSearchParams();
    params.append("recipient", formattedPhones.join(","));
    params.append("sender_id", SENDER_ID);
    params.append("message", message);
    params.append("api_token", API_TOKEN);

    console.log("📤 Sending SMS via text.lk");
    console.log("  Recipients:", formattedPhones.length);
    console.log("  Message length:", message.length);

    const response = await fetch(TEXTLK_HTTP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    const data = await response.json();

    console.log("📥 SMS Response:", {
      status: data.status,
      message: data.message,
      smsCount: data.data?.sms_count,
    });

    if (!response.ok || data.status === "error") {
      throw new Error(
        data.message ||
          `SMS API error: ${response.status} ${response.statusText}`
      );
    }

    return {
      success: true,
      data,
      recipients: formattedPhones,
      message,
    };
  } catch (error) {
    console.error("❌ SMS Service Error:", error);
    return {
      success: false,
      error: error.message,
      recipients,
    };
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

  const result = await sendSMS(gymData.phone, message);

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
  // Use mobile number, fallback to whatsapp
  const phoneNumber = memberData.mobile || memberData.whatsapp;

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
