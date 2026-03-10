// functions/services/metaWhatsAppService.js
/**
 * ✅ SECURE Meta WhatsApp Business API Service (ES6 Module)
 *
 * This service handles ALL WhatsApp messaging for PulsedGym.
 * Credentials are stored ONLY on the server (never sent to frontend).
 */

import * as functions from "firebase-functions";
import process from "process";

// ========================================
// 🔐 CONFIGURATION (Server-Side Only)
// ========================================

// Get config from environment variables or Firebase config
function getConfig() {
  // Try environment variables first (from .env file)
  const envConfig = {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  };

  // If env vars are set, use them
  if (envConfig.phoneNumberId && envConfig.accessToken) {
    return {
      phoneNumberId: envConfig.phoneNumberId,
      accessToken: envConfig.accessToken,
      verifyToken: envConfig.verifyToken || envConfig.phoneNumberId,
      apiVersion: "v21.0",
      apiUrl: "https://graph.facebook.com",
    };
  }

  // Otherwise, try Firebase config
  const firebaseConfig = functions.config().whatsapp || {};
  return {
    phoneNumberId: firebaseConfig.phone_number_id || "",
    accessToken: firebaseConfig.access_token || "",
    verifyToken: firebaseConfig.verify_token || "",
    apiVersion: "v21.0",
    apiUrl: "https://graph.facebook.com",
  };
}

const WHATSAPP_CONFIG = getConfig();

/**
 * Check if WhatsApp service is properly configured
 */
export function isConfigured() {
  const hasPhoneId = !!WHATSAPP_CONFIG.phoneNumberId;
  const hasToken = !!WHATSAPP_CONFIG.accessToken;

  if (!hasPhoneId || !hasToken) {
    console.warn(
      "⚠️ WhatsApp not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN",
    );
  }

  return hasPhoneId && hasToken;
}

// ========================================
// 📱 PHONE NUMBER FORMATTING
// ========================================

/**
 * Format phone number for WhatsApp API
 * Converts Sri Lankan numbers to international format
 */
export function formatPhoneNumber(phone) {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Handle Sri Lankan numbers
  if (cleaned.startsWith("0")) {
    // Remove leading 0, add country code
    cleaned = "94" + cleaned.slice(1);
  } else if (cleaned.length === 9) {
    // 9 digits without leading 0, add country code
    cleaned = "94" + cleaned;
  } else if (!cleaned.startsWith("94")) {
    // No country code, assume Sri Lankan
    cleaned = "94" + cleaned;
  }

  // Validate length (Sri Lankan: 11 digits with country code)
  if (cleaned.length < 11 || cleaned.length > 15) {
    throw new Error(`Invalid phone number length: ${cleaned}`);
  }

  return cleaned;
}

// ========================================
// 📨 TEMPLATE MESSAGE FUNCTIONS
// ========================================

/**
 * Build template components from parameters
 */
export function buildTemplateComponents(templateName, params) {
  const components = [];

  switch (templateName) {
    case "payment_received":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.amount || "" },
          { type: "text", text: params.gymName || "" },
          { type: "text", text: params.date || "" },
          { type: "text", text: params.receiptId || "" },
        ],
      });
      break;

    case "gym_registration":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.gymName || "" },
          { type: "text", text: params.username || "" },
          { type: "text", text: params.password || "" },
        ],
      });
      break;

    case "member_registration":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.username || "" },
          { type: "text", text: params.password || "" },
          { type: "text", text: params.gymName || "" },
        ],
      });
      break;

    case "class_reminder":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.className || "" },
          { type: "text", text: params.time || "" },
          { type: "text", text: params.instructor || "" },
        ],
      });
      break;

    case "membership_expiry":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.expiryDate || "" },
          { type: "text", text: params.daysRemaining || "" },
        ],
      });
      break;

    case "attendance_checkin":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.time || "" },
          { type: "text", text: params.gymName || "" },
        ],
      });
      break;

    case "supplement_approved":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.supplementName || "" },
          { type: "text", text: params.quantity || "" },
        ],
      });
      break;

    case "supplement_rejected":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.supplementName || "" },
          { type: "text", text: params.reason || "" },
        ],
      });
      break;

    case "schedule_change":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.className || "" },
          { type: "text", text: params.originalTime || "" },
          { type: "text", text: params.newTime || "" },
          { type: "text", text: params.date || "" },
        ],
      });
      break;

    case "payment_reminder":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.month || "" },
          { type: "text", text: params.amount || "" },
          { type: "text", text: params.dueDate || "" },
        ],
      });
      break;

    case "password_reset":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.password || "" },
        ],
      });
      break;

    case "welcome_member":
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: params.gymName || "" },
          { type: "text", text: params.memberName || "" },
          { type: "text", text: params.memberId || "" },
          { type: "text", text: params.startDate || "" },
        ],
      });
      break;

    default:
      console.warn(`⚠️ Unknown template: ${templateName}`);
      return [];
  }

  return components;
}

/**
 * Send a template message (for first contact or >24h since last message)
 */
export async function sendTemplateMessage(
  phone,
  templateName,
  languageCode = "en",
  components = [],
) {
  try {
    if (!isConfigured()) {
      throw new Error("WhatsApp service not configured");
    }

    const formattedPhone = formatPhoneNumber(phone);

    console.log(`📱 Sending template "${templateName}" to ${formattedPhone}`);

    const requestBody = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components: components,
      },
    };

    const url = `${WHATSAPP_CONFIG.apiUrl}/${WHATSAPP_CONFIG.apiVersion}/${WHATSAPP_CONFIG.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_CONFIG.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ WhatsApp API error:", data);
      throw new Error(data.error?.message || `API error: ${response.status}`);
    }

    console.log(
      "✅ Template message sent successfully:",
      data.messages?.[0]?.id,
    );

    return {
      success: true,
      messageId: data.messages?.[0]?.id || null,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ sendTemplateMessage error:", error);
    return {
      success: false,
      error: error.message || "Failed to send template message",
    };
  }
}

/**
 * Send a text message (only works within 24h of last message from user)
 */
export async function sendTextMessage(phone, message) {
  try {
    if (!isConfigured()) {
      throw new Error("WhatsApp service not configured");
    }

    const formattedPhone = formatPhoneNumber(phone);

    console.log(`📱 Sending text message to ${formattedPhone}`);

    const requestBody = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "text",
      text: {
        body: message,
      },
    };

    const url = `${WHATSAPP_CONFIG.apiUrl}/${WHATSAPP_CONFIG.apiVersion}/${WHATSAPP_CONFIG.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_CONFIG.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ WhatsApp API error:", data);
      throw new Error(data.error?.message || `API error: ${response.status}`);
    }

    console.log("✅ Text message sent successfully:", data.messages?.[0]?.id);

    return {
      success: true,
      messageId: data.messages?.[0]?.id || null,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ sendTextMessage error:", error);
    return {
      success: false,
      error: error.message || "Failed to send text message",
    };
  }
}

// Export config for webhook verification
export { WHATSAPP_CONFIG };
