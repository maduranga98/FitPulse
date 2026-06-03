/* eslint-disable no-unused-vars */

// ⚠️ LOAD ENVIRONMENT VARIABLES FIRST!
import "dotenv/config.js";

import * as functions from "firebase-functions";
import admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import process from "process";
import * as metaWhatsAppService from "./services/metaWhatsAppService.js";
import * as hik from "./services/hikCentralService.js";
// import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import express from "express";

admin.initializeApp();

const app = express();
app.use(express.raw({ type: "*/*", limit: "10mb" }));
// ========================================
// 🔒 SECURITY HELPER FUNCTIONS
// ========================================

/**
 * Validate if gym exists and is active
 */
async function validateGymStatus(gymId) {
  if (!gymId) {
    console.warn("⚠️ No gymId provided for validation");
    return false;
  }

  try {
    const db = admin.firestore();
    const gymDoc = await db.collection("gyms").doc(gymId).get();

    if (!gymDoc.exists) {
      console.warn(`⚠️ Gym ${gymId} does not exist`);
      return false;
    }

    const gymData = gymDoc.data();
    if (gymData.status !== "active") {
      console.warn(`⚠️ Gym ${gymId} is not active (status: ${gymData.status})`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Error validating gym status:", error);
    return false;
  }
}

export const enrichAttendance = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }

  if (req.method !== "POST") return res.status(405).send("Not Allowed");

  try {
    const { record } = req.body;

    if (!record) return res.status(400).send("No record provided");

    const {
      id,
      employee_no,
      event_time,
      event_type,
      verify_mode,
      device_serial,
    } = record;

    console.log(`Processing attendance for employeeNo: ${employee_no}`);

    // Look up member from Supabase members table (fast lookup)
    const memberResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/members?employee_no=eq.${employee_no}&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      },
    );

    const members = await memberResponse.json();

    if (!members || members.length === 0) {
      console.log(`No member found for code: ${employee_no}`);
      return res.status(200).send("Member not found");
    }

    const member = members[0];
    console.log(`Found member: ${member.name} gymId: ${member.gym_id}`);

    // Write attendance to Firestore
    const today = new Date(event_time).toISOString().split("T")[0];

    await admin
      .firestore()
      .collection("attendance")
      .add({
        employeeNo: employee_no,
        memberName: member.name,
        gymId: member.gym_id,
        eventTime: admin.firestore.Timestamp.fromDate(
          new Date(event_time || Date.now()),
        ),
        eventType: event_type || "check_in",
        verifyMode: verify_mode || "face",
        deviceSerial: device_serial || null,
        date: today,
        source: "hikvision",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log(`✅ Attendance saved to Firestore: ${member.name}`);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("enrichAttendance error:", err);
    return res.status(500).send("Error");
  }
});
/**
 * Validate member exists, is active, and belongs to specified gym
 */
async function validateMemberStatus(memberId, gymId) {
  if (!memberId || !gymId) {
    console.warn("⚠️ Missing memberId or gymId for validation");
    return false;
  }

  try {
    const db = admin.firestore();
    const memberDoc = await db.collection("members").doc(memberId).get();

    if (!memberDoc.exists) {
      console.warn(`⚠️ Member ${memberId} does not exist`);
      return false;
    }

    const memberData = memberDoc.data();

    if (memberData.gymId !== gymId) {
      console.warn(
        `⚠️ Member ${memberId} does not belong to gym ${gymId} (actual: ${memberData.gymId})`,
      );
      return false;
    }

    if (memberData.status !== "active") {
      console.warn(
        `⚠️ Member ${memberId} is not active (status: ${memberData.status})`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Error validating member status:", error);
    return false;
  }
}

/**
 * Rate limiting: Check if too many operations for this entity recently
 */
const operationCounts = new Map();

function checkRateLimit(key, maxOperations = 10, timeWindowMs = 60000) {
  const now = Date.now();
  const operations = operationCounts.get(key) || [];

  const recentOps = operations.filter((time) => now - time < timeWindowMs);

  if (recentOps.length >= maxOperations) {
    console.warn(
      `⚠️ Rate limit exceeded for ${key}: ${recentOps.length} operations in ${
        timeWindowMs / 1000
      }s`,
    );
    return false;
  }

  recentOps.push(now);
  operationCounts.set(key, recentOps);
  return true;
}

// ========================================
// 🔍 FACE RECOGNITION WITH MULTI-PHOTO SUPPORT
// ========================================

export const recognizeFace = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const bucketName = object.bucket;

    console.log("📸 New image uploaded:", filePath);

    if (!filePath || !filePath.startsWith("temp-captures/")) {
      console.log("⏭️  Skipping - not in temp-captures folder");
      return null;
    }

    const filename = filePath.split("/")[1];
    const deviceId = filename.split("_").slice(0, 2).join("_");

    if (!checkRateLimit(`face_recognition_${deviceId}`, 10, 60000)) {
      console.warn(`⚠️ Rate limit exceeded for device ${deviceId}`);
      await admin.storage().bucket(bucketName).file(filePath).delete();
      return null;
    }

    try {
      const client = new ImageAnnotatorClient();
      const gcsUri = `gs://${bucketName}/${filePath}`;

      console.log("🔍 Detecting face in image...");
      const [result] = await client.faceDetection(gcsUri);
      const faces = result.faceAnnotations;

      if (!faces || faces.length === 0) {
        console.log("❌ No face detected in image");
        await admin.storage().bucket(bucketName).file(filePath).delete();
        return null;
      }

      console.log(`✅ Detected ${faces.length} face(s)`);
      const detectedFace = faces[0];

      console.log("📱 Device ID:", deviceId);
      console.log("👥 Fetching registered members...");

      const db = admin.firestore();
      const membersSnapshot = await db
        .collection("members")
        .where("faceRegistered", "==", true)
        .get();

      if (membersSnapshot.empty) {
        console.log("⚠️  No registered members found");
        await admin.storage().bucket(bucketName).file(filePath).delete();
        return null;
      }

      console.log(`📋 Found ${membersSnapshot.size} registered members`);

      let bestMatch = null;
      let highestConfidence = 0;
      let bestMatchDetails = null;

      for (const memberDoc of membersSnapshot.docs) {
        const member = memberDoc.data();

        const facePhotos =
          member.facePhotos ||
          (member.facePhotoURL ? [{ url: member.facePhotoURL }] : []);

        if (!facePhotos || facePhotos.length === 0) {
          console.log(`  ⚠️  ${member.name}: No face photos registered`);
          continue;
        }

        const confidences = [];

        for (let i = 0; i < facePhotos.length; i++) {
          const facePhoto = facePhotos[i];
          const photoUrl = facePhoto.url || facePhoto;

          if (!photoUrl) continue;

          try {
            const [compareResult] = await client.faceDetection(photoUrl);
            const memberFaces = compareResult.faceAnnotations;

            if (!memberFaces || memberFaces.length === 0) {
              console.log(`  ⚠️  ${member.name}: No face in photo ${i + 1}`);
              continue;
            }

            const memberFace = memberFaces[0];
            const similarity = compareAdvancedFaces(detectedFace, memberFace);

            confidences.push({
              photoIndex: i,
              angle: facePhoto.angle || "unknown",
              confidence: similarity,
            });

            console.log(
              `    Photo ${i + 1} (${facePhoto.angle || "single"}): ${(
                similarity * 100
              ).toFixed(1)}%`,
            );
          } catch (error) {
            console.error(
              `  ❌ Error comparing with ${member.name} photo ${i + 1}:`,
              error.message,
            );
          }
        }

        if (confidences.length === 0) {
          console.log(`  ⚠️  ${member.name}: No valid comparisons`);
          continue;
        }

        const bestPhotoMatch = Math.max(
          ...confidences.map((c) => c.confidence),
        );

        let avgTopTwo = bestPhotoMatch;
        if (confidences.length >= 2) {
          const sorted = [...confidences].sort(
            (a, b) => b.confidence - a.confidence,
          );
          avgTopTwo = (sorted[0].confidence + sorted[1].confidence) / 2;
        }

        let weightedAvg = bestPhotoMatch;
        if (confidences.length >= 2) {
          const sorted = [...confidences].sort(
            (a, b) => b.confidence - a.confidence,
          );
          weightedAvg = sorted[0].confidence * 0.5 + sorted[1].confidence * 0.4;
        }

        const finalConfidence = Math.max(
          bestPhotoMatch,
          avgTopTwo,
          weightedAvg,
        );

        console.log(`  📊 ${member.name} final scores:`);
        console.log(`    Best single: ${(bestPhotoMatch * 100).toFixed(1)}%`);
        if (confidences.length >= 2) {
          console.log(`    Avg top 2: ${(avgTopTwo * 100).toFixed(1)}%`);
          console.log(`    Weighted: ${(weightedAvg * 100).toFixed(1)}%`);
        }
        console.log(`    ✨ FINAL: ${(finalConfidence * 100).toFixed(1)}%`);

        if (finalConfidence > highestConfidence && finalConfidence > 0.6) {
          highestConfidence = finalConfidence;
          bestMatch = {
            id: memberDoc.id,
            ...member,
          };
          bestMatchDetails = {
            allConfidences: confidences,
            bestPhotoMatch: bestPhotoMatch,
            avgTopTwo: avgTopTwo,
            weightedAvg: weightedAvg,
            photosCompared: confidences.length,
            strategy: "multi-strategy-max",
          };
        }
      }

      if (bestMatch) {
        console.log(`✅ MATCH FOUND: ${bestMatch.name}`);
        console.log(`   Confidence: ${(highestConfidence * 100).toFixed(1)}%`);
        console.log(`   Photos compared: ${bestMatchDetails.photosCompared}`);

        const gymValid = await validateGymStatus(bestMatch.gymId);
        if (!gymValid) {
          console.warn(
            `⚠️ Cannot mark attendance - gym ${bestMatch.gymId} is not active`,
          );
          await admin.storage().bucket(bucketName).file(filePath).delete();
          return null;
        }

        const memberValid = await validateMemberStatus(
          bestMatch.id,
          bestMatch.gymId,
        );
        if (!memberValid) {
          console.warn(
            `⚠️ Cannot mark attendance - member ${bestMatch.id} is not active`,
          );
          await admin.storage().bucket(bucketName).file(filePath).delete();
          return null;
        }

        const today = new Date().toISOString().split("T")[0];
        const existingAttendance = await db
          .collection("attendance")
          .where("memberId", "==", bestMatch.id)
          .where("date", "==", today)
          .limit(1)
          .get();

        if (!existingAttendance.empty) {
          console.log("⚠️  Member already checked in today");
        } else {
          await db.collection("attendance").add({
            memberId: bestMatch.id,
            memberName: bestMatch.name,
            gymId: bestMatch.gymId,
            deviceId: deviceId,
            checkInTime: admin.firestore.FieldValue.serverTimestamp(),
            date: today,
            confidence: highestConfidence * 100,
            status: "verified",
            recognitionMethod:
              bestMatchDetails.photosCompared > 1
                ? "cloud-vision-multi-photo"
                : "cloud-vision-single",
            matchDetails: {
              photosCompared: bestMatchDetails.photosCompared,
              bestSingleMatch: bestMatchDetails.bestPhotoMatch * 100,
              avgTopTwo: bestMatchDetails.avgTopTwo * 100,
              weightedAvg: bestMatchDetails.weightedAvg * 100,
              strategy: bestMatchDetails.strategy,
              allConfidences: bestMatchDetails.allConfidences.map((c) => ({
                angle: c.angle,
                confidence: (c.confidence * 100).toFixed(1),
              })),
            },
          });

          console.log("✅ Attendance marked successfully!");
        }
      } else {
        console.log("❌ No matching member found (confidence too low)");
        console.log(
          `   Highest confidence was: ${(highestConfidence * 100).toFixed(1)}%`,
        );
        console.log(`   Threshold: 60.0%`);
      }

      await admin.storage().bucket(bucketName).file(filePath).delete();
      console.log("🗑️  Temp file deleted");
    } catch (error) {
      console.error("❌ Error processing image:", error);
    }

    return null;
  });

// ========================================
// 🔧 FACE COMPARISON ALGORITHMS
// ========================================

function compareAdvancedFaces(face1, face2) {
  let totalScore = 0;
  let totalWeight = 0;

  const detectionWeight = 0.2;
  const avgDetectionConfidence =
    ((face1.detectionConfidence || 0) + (face2.detectionConfidence || 0)) / 2;
  totalScore += avgDetectionConfidence * detectionWeight;
  totalWeight += detectionWeight;

  if (face1.boundingPoly && face2.boundingPoly) {
    const boxWeight = 0.15;
    const boxSimilarity = compareBoundingBoxes(
      face1.boundingPoly.vertices,
      face2.boundingPoly.vertices,
    );
    totalScore += boxSimilarity * boxWeight;
    totalWeight += boxWeight;
  }

  const angleWeight = 0.2;
  const angleSimilarity = compareAngles(face1, face2);
  totalScore += angleSimilarity * angleWeight;
  totalWeight += angleWeight;

  if (
    face1.landmarks &&
    face2.landmarks &&
    face1.landmarks.length > 0 &&
    face2.landmarks.length > 0
  ) {
    const landmarkWeight = 0.45;
    const landmarkSimilarity = compareLandmarks(
      face1.landmarks,
      face2.landmarks,
    );
    totalScore += landmarkSimilarity * landmarkWeight;
    totalWeight += landmarkWeight;
  }

  const finalSimilarity = totalWeight > 0 ? totalScore / totalWeight : 0;
  return Math.min(1, Math.max(0, finalSimilarity));
}

function compareBoundingBoxes(box1, box2) {
  if (!box1 || !box2 || box1.length < 4 || box2.length < 4) {
    return 0;
  }

  const width1 = Math.abs(box1[1].x - box1[0].x);
  const height1 = Math.abs(box1[2].y - box1[0].y);
  const width2 = Math.abs(box2[1].x - box2[0].x);
  const height2 = Math.abs(box2[2].y - box2[0].y);

  const ratio1 = width1 / height1;
  const ratio2 = width2 / height2;
  const ratioDiff = Math.abs(ratio1 - ratio2);
  const ratioSimilarity = Math.max(0, 1 - ratioDiff);

  return ratioSimilarity;
}

function compareAngles(face1, face2) {
  let angleSimilarity = 0;
  let angleCount = 0;

  const angles = ["rollAngle", "panAngle", "tiltAngle"];

  for (const angle of angles) {
    if (face1[angle] !== undefined && face2[angle] !== undefined) {
      const diff = Math.abs(face1[angle] - face2[angle]);
      const similarity = Math.max(0, 1 - diff / 180);
      angleSimilarity += similarity;
      angleCount++;
    }
  }

  return angleCount > 0 ? angleSimilarity / angleCount : 0.5;
}

function compareLandmarks(landmarks1, landmarks2) {
  const landmarkMap1 = {};
  const landmarkMap2 = {};

  landmarks1.forEach((l) => {
    if (l.type && l.position) {
      landmarkMap1[l.type] = l.position;
    }
  });

  landmarks2.forEach((l) => {
    if (l.type && l.position) {
      landmarkMap2[l.type] = l.position;
    }
  });

  const keyLandmarks = [
    "LEFT_EYE",
    "RIGHT_EYE",
    "NOSE_TIP",
    "UPPER_LIP",
    "LOWER_LIP",
    "LEFT_EYE_PUPIL",
    "RIGHT_EYE_PUPIL",
    "MOUTH_CENTER",
    "LEFT_EAR_TRAGION",
    "RIGHT_EAR_TRAGION",
  ];

  let totalDistance = 0;
  let matchCount = 0;

  for (const landmarkType of keyLandmarks) {
    const pos1 = landmarkMap1[landmarkType];
    const pos2 = landmarkMap2[landmarkType];

    if (pos1 && pos2) {
      const dx = (pos1.x || 0) - (pos2.x || 0);
      const dy = (pos1.y || 0) - (pos2.y || 0);
      const dz = (pos1.z || 0) - (pos2.z || 0);

      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const normalizedDistance = Math.min(1, distance / 250);

      totalDistance += normalizedDistance;
      matchCount++;
    }
  }

  if (matchCount === 0) {
    return 0;
  }

  const avgDistance = totalDistance / matchCount;
  const similarity = Math.max(0, 1 - avgDistance);
  const enhancedSimilarity = 1 / (1 + Math.exp(-10 * (similarity - 0.5)));

  return enhancedSimilarity;
}

// ========================================
// 📝 FACE REGISTRATION FUNCTIONS
// ========================================

export const processFaceRegistration = functions.firestore
  .document("members/{memberId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();

    if (!newData.facePhotos || oldData.facePhotos) {
      return null;
    }

    console.log(
      "📸 Processing multi-photo face registration for:",
      newData.name,
    );

    const gymValid = await validateGymStatus(newData.gymId);
    if (!gymValid) {
      console.warn(
        `⚠️ Cannot process face registration - gym ${newData.gymId} is not active`,
      );
      await change.after.ref.update({
        faceRegistrationError: "Gym is not active",
      });
      return null;
    }

    const memberId = context.params.memberId;
    if (!checkRateLimit(`face_registration_${memberId}`, 5, 3600000)) {
      console.warn(`⚠️ Rate limit exceeded for member ${memberId}`);
      await change.after.ref.update({
        faceRegistrationError:
          "Too many registration attempts. Please try again later.",
      });
      return null;
    }

    try {
      const client = new ImageAnnotatorClient();
      const processedPhotos = [];

      for (let i = 0; i < newData.facePhotos.length; i++) {
        const photo = newData.facePhotos[i];

        console.log(
          `  Processing photo ${i + 1}/${newData.facePhotos.length} (${
            photo.angle
          })`,
        );

        const [result] = await client.faceDetection(photo.url);
        const faces = result.faceAnnotations;

        if (!faces || faces.length === 0) {
          console.log(`  ⚠️  No face detected in photo ${i + 1}`);
          processedPhotos.push({
            ...photo,
            processed: false,
            error: "No face detected",
          });
          continue;
        }

        const faceData = faces[0];

        processedPhotos.push({
          ...photo,
          processed: true,
          detectionConfidence: faceData.detectionConfidence,
          landmarksCount: faceData.landmarks ? faceData.landmarks.length : 0,
          rollAngle: faceData.rollAngle,
          panAngle: faceData.panAngle,
          tiltAngle: faceData.tiltAngle,
          processedAt: new Date().toISOString(),
        });

        console.log(
          `  ✅ Photo ${i + 1} processed - Confidence: ${(
            faceData.detectionConfidence * 100
          ).toFixed(1)}%`,
        );
      }

      const successfulPhotos = processedPhotos.filter(
        (p) => p.processed,
      ).length;

      await change.after.ref.update({
        facePhotos: processedPhotos,
        facePhotosProcessed: successfulPhotos,
        facePhotosFailed: processedPhotos.length - successfulPhotos,
        faceEnrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `✅ Face registration completed: ${successfulPhotos}/${processedPhotos.length} photos successful`,
      );
    } catch (error) {
      console.error("❌ Error processing face registration:", error);

      await change.after.ref.update({
        faceRegistrationError: error.message,
      });
    }

    return null;
  });

export const processSingleFaceRegistration = functions.firestore
  .document("members/{memberId}")
  .onCreate(async (snap, context) => {
    const member = snap.data();

    if (member.facePhotos || !member.facePhotoURL || !member.faceRegistered) {
      return null;
    }

    console.log(
      "📸 Processing single-photo face registration for:",
      member.name,
    );

    const gymValid = await validateGymStatus(member.gymId);
    if (!gymValid) {
      console.warn(
        `⚠️ Cannot process face registration - gym ${member.gymId} is not active`,
      );
      await snap.ref.update({
        faceRegistered: false,
        faceRegistrationError: "Gym is not active",
      });
      return null;
    }

    try {
      const client = new ImageAnnotatorClient();
      const [result] = await client.faceDetection(member.facePhotoURL);
      const faces = result.faceAnnotations;

      if (!faces || faces.length === 0) {
        console.log("❌ No face detected in registration photo");

        await snap.ref.update({
          faceRegistered: false,
          faceRegistrationError: "No face detected in photo",
        });

        return null;
      }

      const faceData = faces[0];

      await snap.ref.update({
        faceDetectionConfidence: faceData.detectionConfidence,
        faceLandmarksCount: faceData.landmarks ? faceData.landmarks.length : 0,
        faceRollAngle: faceData.rollAngle,
        facePanAngle: faceData.panAngle,
        faceTiltAngle: faceData.tiltAngle,
        faceEnrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("✅ Single-photo registration processed successfully");
      console.log(
        `   Detection confidence: ${(
          faceData.detectionConfidence * 100
        ).toFixed(1)}%`,
      );
    } catch (error) {
      console.error("❌ Error processing face registration:", error);

      await snap.ref.update({
        faceRegistrationError: error.message,
      });
    }

    return null;
  });

// ========================================
// 📱 WHATSAPP FUNCTIONS (SECURE VERSION)
// ========================================

/**
 * ✅ SECURE: Send WhatsApp message using server-side credentials only
 * Frontend should NEVER have access to WhatsApp tokens!
 */
export const sendWhatsAppMessage = functions.https.onCall(
  async (data, _context) => {
    try {
      console.log("📱 WhatsApp message request received");

      // Note: This app uses custom auth (not Firebase Auth),
      // so context.auth is not available. Callable functions
      // already enforce CORS and request format validation.

      // Check if WhatsApp service is configured
      if (!metaWhatsAppService.isConfigured()) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "WhatsApp service is not configured on server",
        );
      }

      const { phone, templateName, params, message } = data;

      if (!phone) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Phone number is required",
        );
      }

      let result;

      // Send template message or text message
      if (templateName && params) {
        const components = metaWhatsAppService.buildTemplateComponents(
          templateName,
          params,
        );
        result = await metaWhatsAppService.sendTemplateMessage(
          phone,
          templateName,
          "en",
          components,
        );
      } else if (message) {
        result = await metaWhatsAppService.sendTextMessage(phone, message);
      } else {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Either templateName with params, or message is required",
        );
      }

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          result.error || "Failed to send WhatsApp message",
        );
      }

      console.log("✅ WhatsApp message sent successfully");

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      console.error("❌ WhatsApp send error:", error);
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Failed to send WhatsApp message",
      );
    }
  },
);

/**
 * Test WhatsApp function - For testing only
 */
export const testWhatsAppMessage = functions.https.onCall(
  async (data, context) => {
    try {
      console.log("🧪 Test WhatsApp message request");

      if (!metaWhatsAppService.isConfigured()) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "WhatsApp service is not configured",
        );
      }

      const { phone, templateName, params } = data;

      const components = metaWhatsAppService.buildTemplateComponents(
        templateName,
        params,
      );

      const result = await metaWhatsAppService.sendTemplateMessage(
        phone,
        templateName,
        "en",
        components,
      );

      return result;
    } catch (error) {
      console.error("Test message error:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  },
);

// ========================================
// 📱 WHATSAPP AUTOMATIC TRIGGERS
// ========================================

/**
 * Fires when a new member is created → sends login credentials via WhatsApp
 */
export const onMemberCreated = functions.firestore
  .document("members/{memberId}")
  .onCreate(async (snap, context) => {
    const member = snap.data();
    const db = admin.firestore();

    // Resolve phone: members store mobile/whatsapp, not phone
    const phoneNumber = member.mobile || member.whatsapp || member.phone;
    if (!phoneNumber) {
      console.log(`⏭️ Member ${snap.id} has no phone number, skipping notifications`);
      return null;
    }

    // ── SMS: send credentials ─────────────────────────────────────────────────
    try {
      // Fetch gym SMS settings (token stored in Firestore)
      let API_TOKEN = process.env.TEXTLK_API_TOKEN;
      let SENDER_ID = process.env.TEXTLK_SENDER_ID || "Lumora Tech";

      if (member.gymId) {
        const gymSnap = await db.collection("gyms").doc(member.gymId).get();
        if (gymSnap.exists) {
          const smsSettings = gymSnap.data()?.settings?.sms || {};
          if (smsSettings.apiToken) API_TOKEN = smsSettings.apiToken;
          if (smsSettings.senderId) SENDER_ID = smsSettings.senderId;
        }
      }

      if (API_TOKEN) {
        const APP_URL = process.env.APP_URL || "https://app.pulsedgym.com";
        const memberName = member.name || "Member";
        const username = member.username || member.memberCode || snap.id;
        const password = member.password || member.defaultPassword || "";

        const smsMessage = `💪 Welcome to PulsedGym, ${memberName}!\n\nYou have been registered as a member.\n\n📱 LOGIN DETAILS:\nURL: ${APP_URL}/login\nUsername: ${username}\nPassword: ${password}\n\n⚠️ Keep your credentials safe.`;

        // Validate and format phone (Sri Lankan: 0XXXXXXXXX → 94XXXXXXXXX)
        let cleaned = phoneNumber.replace(/\D/g, "");
        if (cleaned.startsWith("0")) cleaned = "94" + cleaned.slice(1);
        else if (cleaned.length === 9) cleaned = "94" + cleaned;

        if (/^94\d{9}$/.test(cleaned)) {
          const ENDPOINT = process.env.TEXTLK_HTTP_ENDPOINT || "https://app.text.lk/api/v3/sms/send";
          const smsResponse = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${API_TOKEN}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              recipient: cleaned,
              sender_id: SENDER_ID,
              type: "plain",
              message: smsMessage,
            }),
          });
          const smsResult = await smsResponse.json();
          if (smsResponse.ok && smsResult.status !== "error") {
            console.log(`✅ SMS sent to ${cleaned} for member ${snap.id}`);
            await db.collection("notifications").add({
              gymId: member.gymId,
              memberId: snap.id,
              memberName: member.name,
              type: "member_registration",
              channel: "sms",
              status: "sent",
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } else {
            console.error(`❌ SMS API error for member ${snap.id}:`, smsResult.message);
          }
        } else {
          console.warn(`⚠️ Invalid phone number for member ${snap.id}: ${phoneNumber}`);
        }
      } else {
        console.warn(`⚠️ No SMS API token configured for gym ${member.gymId}, skipping SMS`);
      }
    } catch (smsError) {
      console.error("❌ onMemberCreated SMS error:", smsError);
    }

    // ── WhatsApp ──────────────────────────────────────────────────────────────
    if (!metaWhatsAppService.isConfigured()) {
      console.warn("⚠️ WhatsApp not configured, skipping WhatsApp notification");
      return null;
    }

    try {
      const gymDoc = await db.collection("gyms").doc(member.gymId).get();
      const gymName = gymDoc.exists ? gymDoc.data().name : "Your Gym";

      const components = metaWhatsAppService.buildTemplateComponents(
        "member_registration",
        {
          memberName: member.name || "Member",
          username: member.username || member.memberCode || snap.id,
          password: member.password || member.defaultPassword || "pulsed@123",
          gymName: gymName,
        },
      );

      const result = await metaWhatsAppService.sendTemplateMessage(
        phoneNumber,
        "member_registration",
        "en",
        components,
      );

      if (result.success) {
        console.log(`✅ Member registration WhatsApp sent to ${phoneNumber}`);
        await db.collection("notifications").add({
          gymId: member.gymId,
          memberId: snap.id,
          memberName: member.name,
          type: "member_registration",
          channel: "whatsapp",
          status: "sent",
          messageId: result.messageId,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        console.error(`❌ Failed to send member registration WhatsApp:`, result.error);
      }
    } catch (error) {
      console.error("❌ onMemberCreated WhatsApp error:", error);
    }

    return null;
  });

/**
 * Fires when a new payment is recorded → sends payment confirmation via WhatsApp
 */
export const onPaymentCreated = functions.firestore
  .document("payments/{paymentId}")
  .onCreate(async (snap, context) => {
    const payment = snap.data();

    // Skip if no memberId
    if (!payment.memberId || !payment.gymId) {
      console.log("⏭️ Payment missing memberId or gymId, skipping notifications");
      return null;
    }

    const db = admin.firestore();

    // Load member + gym once (shared by SMS and WhatsApp)
    const memberDoc = await db.collection("members").doc(payment.memberId).get();
    if (!memberDoc.exists) {
      console.warn(`⚠️ Member ${payment.memberId} not found`);
      return null;
    }
    const member = memberDoc.data();
    const gymDoc = await db.collection("gyms").doc(payment.gymId).get();
    const gymData = gymDoc.exists ? gymDoc.data() : {};
    const gymName = gymData.name || "Your Gym";

    // ── SMS receipt ───────────────────────────────────────────────────────────
    try {
      const smsEnabled = gymData.settings?.notifications?.sms !== false;
      const smsSettings = gymData.settings?.sms || {};
      const apiToken = smsSettings.apiToken || process.env.TEXTLK_API_TOKEN;
      const senderId =
        smsSettings.senderId || process.env.TEXTLK_SENDER_ID || "Lumora Tech";
      const phone = member.mobile || member.whatsapp || member.phone;

      if (smsEnabled && apiToken && phone) {
        const receiptId = context.params.paymentId.slice(0, 8).toUpperCase();
        const dateStr = new Date().toLocaleDateString("en-GB");
        const message =
          `💪 ${gymName} payment received\n\n` +
          `Hi ${member.name || "Member"}, we received your payment of ` +
          `Rs. ${Number(payment.amount || 0).toLocaleString()}` +
          `${payment.remaining > 0 ? ` (remaining Rs. ${Number(payment.remaining).toLocaleString()})` : ""}` +
          `.\n\nReceipt: ${receiptId}\nDate: ${dateStr}\n\nThank you!`;

        const sent = await sendPlainSMS(apiToken, senderId, phone, message);
        if (sent) {
          console.log(`✅ Payment receipt SMS sent for member ${payment.memberId}`);
          await db.collection("notifications").add({
            gymId: payment.gymId,
            memberId: payment.memberId,
            memberName: member.name || "",
            type: "payment_received",
            channel: "sms",
            status: "sent",
            amount: payment.amount,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } else if (!apiToken) {
        console.warn(`⚠️ No SMS token for gym ${payment.gymId}, skipping payment SMS`);
      }
    } catch (smsErr) {
      console.error("❌ onPaymentCreated SMS error:", smsErr);
    }

    // ── WhatsApp receipt ────────────────────────────────────────────────────────
    if (!metaWhatsAppService.isConfigured()) {
      console.warn("⚠️ WhatsApp not configured, skipping payment WhatsApp");
      return null;
    }

    try {
      if (!member.phone) {
        console.log(`⏭️ Member ${payment.memberId} has no phone for WhatsApp`);
        return null;
      }

      const components = metaWhatsAppService.buildTemplateComponents(
        "payment_received",
        {
          memberName: member.name || "Member",
          amount: String(payment.amount || "0"),
          gymName: gymName,
          date: new Date().toLocaleDateString("en-GB"), // DD/MM/YYYY
          receiptId: context.params.paymentId.slice(0, 8).toUpperCase(),
        },
      );

      const result = await metaWhatsAppService.sendTemplateMessage(
        member.phone,
        "payment_received",
        "en",
        components,
      );

      if (result.success) {
        console.log(`✅ Payment WhatsApp sent to ${member.phone}`);
        await db.collection("notifications").add({
          gymId: payment.gymId,
          memberId: payment.memberId,
          memberName: member.name,
          type: "payment_received",
          channel: "whatsapp",
          status: "sent",
          messageId: result.messageId,
          amount: payment.amount,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        console.error(`❌ Failed to send payment WhatsApp:`, result.error);
      }
    } catch (error) {
      console.error("❌ onPaymentCreated WhatsApp error:", error);
    }

    return null;
  });

// ========================================
// 📡 HIKVISION DEVICE INTEGRATION
// ========================================

/**
 * Receives attendance events pushed by Hikvision terminals via HTTP Listening.
 * Configure each device: Network > Advanced > HTTP Listening → point to this URL.
 */
export const hikvisionEvent = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.sendStatus(405);
    return;
  }

  const db = admin.firestore();

  try {
    let body = req.body;

    // Parse multipart/form-data Buffer sent by Hikvision device
    if (Buffer.isBuffer(body)) {
      const raw = body.toString("utf8");

      // Method 1: Use Content-Length to extract exact JSON bytes
      const contentLengthMatch = raw.match(/Content-Length:\s*(\d+)/i);
      if (contentLengthMatch) {
        const contentLength = parseInt(contentLengthMatch[1]);
        const jsonStart = raw.indexOf("\r\n\r\n");
        if (jsonStart !== -1) {
          const jsonStr = raw.substring(
            jsonStart + 4,
            jsonStart + 4 + contentLength,
          );
          try {
            body = JSON.parse(jsonStr);
            console.log("📦 Parsed multipart body using Content-Length");
          } catch (e) {
            console.log("❌ Content-Length parse failed:", e.message);
          }
        }
      }

      // Method 2: fallback — find first { and last }
      if (Buffer.isBuffer(body) || body?.type === "Buffer") {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          try {
            body = JSON.parse(raw.substring(start, end + 1));
            console.log("📦 Parsed multipart body using bracket match");
          } catch (e) {
            console.log("❌ Bracket parse failed:", e.message);
          }
        }
      }
    }

    console.log("📡 Hikvision event body:", JSON.stringify(body));

    const event = body?.AccessControllerEvent || null;

    if (!event) {
      console.log("⏭️  No AccessControllerEvent in payload, ignoring");
      res.status(200).send("OK");
      return;
    }

    const employeeNo =
      event?.employeeNoString || String(event?.employeeNo || "");

    console.log("👤 employeeNo:", employeeNo);

    if (!employeeNo) {
      console.log(
        "⏭️  No employeeNo — person not enrolled with Employee ID on device",
      );
      res.status(200).send("OK");
      return;
    }

    const deviceIp =
      body?.ipAddress || req.headers["x-forwarded-for"] || req.ip || "";

    const eventTime = body?.dateTime ? new Date(body.dateTime) : new Date();

    console.log("🔍 Looking up device IP:", deviceIp);

    // 1. Look up device by IP across all gyms
    const devicesSnap = await db
      .collectionGroup("devices")
      .where("ip", "==", deviceIp.split(",")[0].trim())
      .limit(1)
      .get();

    if (devicesSnap.empty) {
      console.warn(`⚠️  No device registered for IP ${deviceIp}`);
      res.status(200).send("OK");
      return;
    }

    const deviceDoc = devicesSnap.docs[0];
    const deviceData = deviceDoc.data();
    const gymId = deviceData.gymId;
    const deviceId = deviceDoc.id;

    console.log(`✅ Device found: ${deviceId} for gym: ${gymId}`);

    // 2. Validate gym
    const gymDoc = await db.collection("gyms").doc(gymId).get();
    if (!gymDoc.exists || gymDoc.data().status !== "active") {
      console.warn(`⚠️  Gym ${gymId} not found or not active`);
      res.status(200).send("OK");
      return;
    }

    // 3. Look up member by memberCode
    const memberSnap = await db
      .collection("members")
      .where("gymId", "==", gymId)
      .where("memberCode", "==", employeeNo)
      .limit(1)
      .get();

    if (memberSnap.empty) {
      console.warn(
        `⚠️  No member with memberCode ${employeeNo} in gym ${gymId}`,
      );
      res.status(200).send("OK");
      return;
    }

    const memberDoc = memberSnap.docs[0];
    const member = memberDoc.data();

    if (member.status !== "active") {
      console.warn(`⚠️  Member ${memberDoc.id} is not active`);
      res.status(200).send("OK");
      return;
    }

    // 4. Deduplicate: same member + device within 10 seconds = skip
    const recentSnap = await db
      .collection("attendance")
      .where("gymId", "==", gymId)
      .where("memberId", "==", memberDoc.id)
      .where("deviceId", "==", deviceId)
      .orderBy("checkInTime", "desc")
      .limit(1)
      .get();

    if (!recentSnap.empty) {
      const lastEvent = recentSnap.docs[0].data();
      const lastTime =
        lastEvent.checkInTime?.toDate?.() || new Date(lastEvent.checkInTime);
      if (eventTime - lastTime < 10 * 1000) {
        console.log(
          `⏭️  Duplicate event for ${member.name} within 10s, skipping`,
        );
        res.status(200).send("OK");
        return;
      }
    }

    // 5. Write attendance record
    const dateStr = eventTime.toISOString().split("T")[0];
    const attendanceRef = db
      .collection("attendance")
      .doc(`${deviceId}_${memberDoc.id}_${eventTime.getTime()}`);

    await attendanceRef.set({
      memberId: memberDoc.id,
      memberName: member.name,
      gymId,
      deviceId,
      deviceName: deviceData.name || deviceId,
      direction: deviceData.direction || "in",
      checkInTime: admin.firestore.Timestamp.fromDate(eventTime),
      date: dateStr,
      recognitionMethod: "hikvision",
      status: "present",
      rawEvent: {
        employeeNo,
        verifyMode: event?.currentVerifyMode || null,
        eventType: body?.eventType || null,
      },
      createdAt: admin.firestore.Timestamp.now(),
    });

    // 6. Update device last heartbeat
    await deviceDoc.ref.update({
      lastHeartbeat: admin.firestore.Timestamp.now(),
      status: "online",
    });

    console.log(
      `✅ Attendance recorded: ${member.name} via ${deviceData.name || deviceId}`,
    );
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ hikvisionEvent error:", error);
    res.status(200).send("OK");
  }
});

/**
 * Test connectivity to a registered Hikvision device.
 * Calls GET /ISAPI/System/deviceInfo on the device and returns the result.
 */
export const testDeviceConnection = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const { deviceId, gymId } = data;
    if (!deviceId || !gymId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "deviceId and gymId required",
      );
    }

    const db = admin.firestore();
    const deviceDoc = await db
      .collection("gyms")
      .doc(gymId)
      .collection("devices")
      .doc(deviceId)
      .get();

    if (!deviceDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Device not found");
    }

    const device = deviceDoc.data();

    try {
      const { default: https } = await import("https");
      const { default: http } = await import("http");

      const isHttps = (device.protocol || "HTTP").toUpperCase() === "HTTPS";
      const agent = isHttps ? https : http;

      const credentials = Buffer.from(
        `${device.username}:${device.password}`,
      ).toString("base64");

      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: device.ip,
          port: device.port || 80,
          path: "/ISAPI/System/deviceInfo",
          method: "GET",
          headers: { Authorization: `Basic ${credentials}` },
          timeout: 5000,
          rejectUnauthorized: false,
        };

        const req = agent.request(options, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () =>
            resolve({ statusCode: res.statusCode, body: data }),
          );
        });

        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Connection timed out"));
        });
        req.end();
      });

      if (result.statusCode === 200) {
        await deviceDoc.ref.update({
          status: "online",
          lastHeartbeat: admin.firestore.Timestamp.now(),
        });
        return { success: true, statusCode: result.statusCode };
      } else {
        await deviceDoc.ref.update({ status: "error" });
        return {
          success: false,
          error: `Device returned HTTP ${result.statusCode}`,
        };
      }
    } catch (err) {
      await deviceDoc.ref.update({ status: "offline" });
      return { success: false, error: err.message };
    }
  },
);

/**
 * Webhook endpoint for WhatsApp status updates
 */
export const whatsappWebhook = functions.https.onRequest(async (req, res) => {
  console.log("📞 Webhook received:", req.method);

  // GET - Webhook Verification
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Get verify token from env or Firebase config
    const verifyToken =
      process.env.WHATSAPP_VERIFY_TOKEN ||
      (functions.config().whatsapp && functions.config().whatsapp.verify_token);

    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ Webhook verified successfully!");
      res.status(200).send(challenge);
      return;
    } else {
      console.error("❌ Webhook verification failed!");
      res.sendStatus(403);
      return;
    }
  }

  // POST - Webhook Events
  if (req.method === "POST") {
    try {
      const body = req.body;
      console.log("📨 Webhook event received");

      // Process webhook events here
      // (Status updates, incoming messages, etc.)

      res.sendStatus(200);
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.sendStatus(200);
    }
    return;
  }

  res.sendStatus(405);
});

// ========================================
// 🔐 HIKCENTRAL OPENAPI (AK/SK signed)
// ========================================

function hikErr(err) {
  console.error("HikCentral call failed:", err);
  throw new functions.https.HttpsError("internal", err.message || String(err));
}

/**
 * Validate that a gymId is provided, the gym exists, and is active.
 * This app uses custom auth (not Firebase Auth), so context.auth is always
 * null in callable functions. Gym validation is the access control instead.
 * Throws an HttpsError otherwise. Returns the gym document data.
 */
async function validateGymAccess(data) {
  const gymId = data?.gymId;
  if (!gymId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "gymId is required",
    );
  }
  const db = admin.firestore();
  const gymDoc = await db.collection("gyms").doc(gymId).get();
  if (!gymDoc.exists) {
    throw new functions.https.HttpsError("not-found", `Gym ${gymId} not found`);
  }
  if (gymDoc.data().status !== "active") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Gym ${gymId} is not active`,
    );
  }
  return gymDoc.data();
}

export const hikAddPerson = functions.https.onCall(async (data, context) => {
  await validateGymAccess(data);
  const { gymId, ...personData } = data;
  return hik.addPerson(personData).catch(hikErr);
});

export const hikSearchPersons = functions.https.onCall(
  async (data, context) => {
    // No gymId required — read-only person search.
    return hik.searchPersons(data || {}).catch(hikErr);
  },
);

export const hikUpdatePerson = functions.https.onCall(async (data, context) => {
  await validateGymAccess(data);
  const { personId, updates } = data || {};
  if (!personId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "personId required",
    );
  }
  return hik.updatePerson(personId, updates || {}).catch(hikErr);
});

export const hikDeletePersons = functions.https.onCall(
  async (data, context) => {
    await validateGymAccess(data);
    const ids = data?.personIds || [];
    if (!ids.length) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "personIds required",
      );
    }
    return hik.deletePersons(ids).catch(hikErr);
  },
);

export const hikAddFace = functions.https.onCall(async (data, context) => {
  await validateGymAccess(data);
  const { personId, faceData } = data || {};
  if (!personId || !faceData) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "personId and faceData required",
    );
  }
  return hik.addFace({ personId, faceData }).catch(hikErr);
});

export const hikDeleteFaces = functions.https.onCall(async (data, context) => {
  await validateGymAccess(data);
  const ids = (data && data.faceIds) || [];
  if (!ids.length) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "faceIds required",
    );
  }
  return hik.deleteFaces(ids).catch(hikErr);
});

export const hikGetAccessRecords = functions.https.onCall(
  async (data, context) => {
    await validateGymAccess(data);
    return hik.getAccessRecords(data || {}).catch(hikErr);
  },
);

export const hikGetDoors = functions.https.onCall(async (data, context) => {
  await validateGymAccess(data);
  return hik.getDoors(data || {}).catch(hikErr);
});

export const hikGetDeviceList = functions.https.onCall(
  async (data, context) => {
    // No auth check needed — returns all devices from HikCentral.
    return hik.getDeviceList(data || {}).catch(hikErr);
  },
);

export const hikViewSubscriptions = functions.https.onCall(
  async (data, context) => {
    // No auth check needed — diagnostic only.
    return hik.viewSubscriptions().catch(hikErr);
  },
);

export const hikControlDoor = functions.https.onCall(async (data, context) => {
  // Security-critical: never allow door control without a valid, active gym.
  await validateGymAccess(data);
  const { doorIndexCode, controlType } = data || {};
  if (!doorIndexCode) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "doorIndexCode is required",
    );
  }
  return hik.controlDoor(doorIndexCode, controlType ?? 1).catch(hikErr);
});

export const hikSubscribeEvents = functions.https.onCall(
  async (data, context) => {
    await validateGymAccess(data);
    const { eventDest, callbackUrl, eventTypes } = data || {};
    const dest = eventDest || callbackUrl;
    if (!dest) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "eventDest is required",
      );
    }
    return hik.subscribeEvents(dest, eventTypes || []).catch(hikErr);
  },
);

export const hikTestConnection = functions.https.onCall(
  async (data, context) => {
    // No auth check needed — diagnostic only.
    try {
      const result = await hik.getApiVersion();
      return { success: true, result };
    } catch (err) {
      console.error("HikCentral connection test failed:", err);
      return { success: false, error: err.message || String(err) };
    }
  },
);

/**
 * Receives access events pushed by HikCentral via OpenAPI event subscription.
 * Always responds 200 immediately — HikCentral retries on any non-200.
 */
export const hikCentralWebhook = functions.https.onRequest(async (req, res) => {
  // 1. Acknowledge immediately so HikCentral does not retry.
  res.status(200).send("OK");

  try {
    const db = admin.firestore();
    const payload = req.body || {};
    const events = payload.events || payload.Events || [];

    if (!Array.isArray(events) || events.length === 0) {
      console.log("⏭️  No events in HikCentral webhook payload");
      return;
    }

    for (const event of events) {
      const data = event.data || event || {};
      const eventType = event.eventType || data.eventType || null;

      // i. personCode is the Firestore member doc ID
      const personCode = data.personCode || "";

      const doorName = data.doorName || null;
      const picUri = data.picUri || data.pictureURLs?.[0] || null;
      const happenTime = data.happenTime
        ? new Date(data.happenTime)
        : data.time
          ? new Date(data.time)
          : new Date();
      const dateStr = happenTime.toISOString().split("T")[0];

      // ii. No personCode → audit raw event WITHOUT gymId, continue
      if (!personCode) {
        await db.collection("hikRawEvents").add({
          eventType,
          rawEvent: data,
          processed: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        continue;
      }

      // iii. Look up member by doc ID (personCode === doc ID)
      const memberDoc = await db.collection("members").doc(personCode).get();

      // iv. Not found → audit raw event WITHOUT gymId, continue
      if (!memberDoc.exists) {
        await db.collection("hikRawEvents").add({
          personCode,
          eventType,
          rawEvent: data,
          processed: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        continue;
      }

      // v. member data
      const member = memberDoc.data();

      // vi-vii. gymId must be present
      const gymId = member.gymId;
      if (!gymId) {
        console.warn(`⚠️  Member ${personCode} has no gymId, skipping`);
        continue;
      }

      // viii. Validate gym exists and is active BEFORE writing
      const gymDoc = await db.collection("gyms").doc(gymId).get();
      if (!gymDoc.exists || gymDoc.data().status !== "active") {
        console.warn(`⚠️  Gym not found or not active: ${gymId}`);
        continue;
      }

      // ix. Skip inactive members
      if (member.status !== "active") {
        console.warn(`⚠️  Member ${personCode} is not active, skipping`);
        continue;
      }

      // x. Deduplicate (scoped by gymId): last attendance < 10s ago → skip
      const recentSnap = await db
        .collection("attendance")
        .where("memberId", "==", personCode)
        .where("gymId", "==", gymId)
        .orderBy("checkInTime", "desc")
        .limit(1)
        .get();

      if (!recentSnap.empty) {
        const lastEvent = recentSnap.docs[0].data();
        const lastTime =
          lastEvent.checkInTime?.toDate?.() || new Date(lastEvent.checkInTime);
        if (happenTime - lastTime < 10 * 1000) {
          console.log(
            `⏭️  Duplicate HikCentral event for ${member.name} within 10s, skipping`,
          );
          continue;
        }
      }

      // xi. Write attendance record (gymId required)
      await db.collection("attendance").add({
        memberId: personCode,
        memberName: member.name,
        gymId,
        checkInTime: admin.firestore.Timestamp.fromDate(happenTime),
        date: dateStr,
        recognitionMethod: "hikvision-openapi",
        eventType,
        doorName,
        picUri,
        checkInAndOutType: data.checkInAndOutType || 1,
        status: "present",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // xii. Audit trail (gymId required)
      await db.collection("hikRawEvents").add({
        gymId,
        memberId: personCode,
        memberName: member.name,
        eventType,
        happenTime: admin.firestore.Timestamp.fromDate(happenTime),
        doorName,
        picUri,
        processed: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `✅ HikCentral attendance recorded: ${member.name} (gym ${gymId})`,
      );
    }
  } catch (error) {
    // Never let errors crash — HikCentral would retry.
    console.error("❌ hikCentralWebhook error:", error);
  }
});

/**
 * When a member is created with useHikCentral === true, register them in
 * HikCentral and enroll their face photo.
 */
export const syncMemberToHikCentral = functions.firestore
  .document("members/{memberId}")
  .onCreate(async (snap, context) => {
    const member = snap.data();

    // 1. Skip members not flagged for HikCentral
    if (member.useHikCentral !== true) {
      return null;
    }

    const memberId = context.params.memberId;
    const db = admin.firestore();

    // Validate gymId presence
    if (!member.gymId) {
      console.error(
        `❌ Member ${memberId} has no gymId, cannot sync to HikCentral`,
      );
      return null;
    }

    // Validate gym exists and is active
    const gymDoc = await db.collection("gyms").doc(member.gymId).get();
    if (!gymDoc.exists || gymDoc.data().status !== "active") {
      console.warn(
        `⚠️  Gym ${member.gymId} not found or not active, skipping sync`,
      );
      return null;
    }

    try {
      // 2. Register the person in HikCentral
      const personResult = await hik.addPerson({
        personCode: memberId,
        personName: member.name,
        gender: member.gender,
        phoneNo: member.phoneNo || member.phone,
        email: member.email,
      });

      // 3. Extract HikCentral person id
      const hikPersonId = personResult?.personId || personResult?.id;

      // 4. Enroll face photo (failure must not fail whole sync)
      if (member.facePhotoURL && hikPersonId) {
        try {
          const resp = await fetch(member.facePhotoURL);
          const buffer = Buffer.from(await resp.arrayBuffer());
          const base64 = buffer.toString("base64");
          await hik.addFace({ personId: hikPersonId, faceData: base64 });
        } catch (faceErr) {
          console.error("⚠️ HikCentral face enrollment failed:", faceErr);
        }
      }

      // 5. Mark member as synced (preserve gymId)
      await snap.ref.update({
        hikvisionUserId: hikPersonId || memberId,
        hikCentralSynced: true,
        hikCentralSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        gymId: member.gymId,
      });

      console.log(
        `✅ Member ${memberId} synced to HikCentral (gym ${member.gymId})`,
      );
    } catch (err) {
      // 6. Record sync failure (do NOT touch gymId)
      console.error("❌ syncMemberToHikCentral error:", err);
      await snap.ref.update({
        hikCentralSynced: false,
        hikCentralSyncError: err.message || String(err),
        hikCentralSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return null;
  });

// ========================================
// 📱 SMS NOTIFICATION FUNCTION
// ========================================
// Proxy SMS calls server-side to avoid CORS and keep API token secure.
// Set env vars: TEXTLK_API_TOKEN, TEXTLK_SENDER_ID (optional), TEXTLK_HTTP_ENDPOINT (optional)

export const sendSMSNotification = functions.https.onCall(async (data) => {
  const { recipient, message, gymId } = data;

  if (!recipient || !message) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "recipient and message are required."
    );
  }

  // Resolve API token: prefer Firestore gym setting, fall back to env var
  let API_TOKEN = process.env.TEXTLK_API_TOKEN;
  let SENDER_ID = process.env.TEXTLK_SENDER_ID || "Lumora Tech";

  if (gymId) {
    try {
      const gymSnap = await admin.firestore().collection("gyms").doc(gymId).get();
      if (gymSnap.exists) {
        const smsSettings = gymSnap.data()?.settings?.sms || {};
        if (smsSettings.apiToken) API_TOKEN = smsSettings.apiToken;
        if (smsSettings.senderId) SENDER_ID = smsSettings.senderId;
      }
    } catch (err) {
      console.warn("⚠️ Could not load gym SMS settings:", err.message);
    }
  }

  const ENDPOINT =
    process.env.TEXTLK_HTTP_ENDPOINT ||
    "https://app.text.lk/api/v3/sms/send";

  if (!API_TOKEN) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SMS API token not configured. Set it in Dashboard → Settings → SMS Configuration."
    );
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient,
        sender_id: SENDER_ID,
        type: "plain",
        message,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.status === "error") {
      throw new functions.https.HttpsError(
        "internal",
        result.message || `SMS API error: ${response.status}`
      );
    }

    console.log(`✅ SMS sent to ${recipient}`);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error("❌ SMS send error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});


// ========================================
// ⏰ SCHEDULED PAYMENT REMINDERS (SMS)
// ========================================
// Runs daily. For each gym, computes the monthly payment due date from
// settings.payment.dueDay and sends an SMS reminder to active, non-VIP
// members who have not yet paid for the current month, on each of the
// configured settings.payment.reminderDays (days before the due date).

/**
 * Send a single plain SMS via text.lk. Returns true on success.
 */
async function sendPlainSMS(apiToken, senderId, phoneNumber, message) {
  if (!apiToken || !phoneNumber) return false;

  // Format Sri Lankan number: 0XXXXXXXXX → 94XXXXXXXXX
  let cleaned = String(phoneNumber).replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "94" + cleaned.slice(1);
  else if (cleaned.length === 9) cleaned = "94" + cleaned;
  if (!/^94\d{9}$/.test(cleaned)) {
    console.warn(`⚠️ Invalid phone number for reminder: ${phoneNumber}`);
    return false;
  }

  const ENDPOINT =
    process.env.TEXTLK_HTTP_ENDPOINT || "https://app.text.lk/api/v3/sms/send";
  try {
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient: cleaned,
        sender_id: senderId,
        type: "plain",
        message,
      }),
    });
    const result = await resp.json();
    if (resp.ok && result.status !== "error") return true;
    console.error("❌ Reminder SMS API error:", result.message);
    return false;
  } catch (err) {
    console.error("❌ Reminder SMS send error:", err);
    return false;
  }
}

export const sendPaymentReminders = functions.pubsub
  .schedule("0 9 * * *") // every day at 09:00
  .timeZone("Asia/Colombo")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`; // YYYY-MM

    const gymsSnap = await db.collection("gyms").get();

    for (const gymDoc of gymsSnap.docs) {
      const gym = gymDoc.data();
      const gymId = gymDoc.id;

      if (gym.status && gym.status !== "active") continue;

      const paymentCfg = gym.settings?.payment || {};
      const dueDay = parseInt(paymentCfg.dueDay) || 10;
      const reminderDays = Array.isArray(paymentCfg.reminderDays)
        ? paymentCfg.reminderDays
        : [3, 1];

      // Due date for the current month
      const dueDate = new Date(year, month, dueDay);
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysUntilDue = Math.round(
        (new Date(year, month, dueDate.getDate()) -
          new Date(year, month, now.getDate())) /
          msPerDay,
      );

      // Only proceed if today matches one of the reminder offsets
      if (!reminderDays.includes(daysUntilDue)) continue;

      const smsSettings = gym.settings?.sms || {};
      const apiToken = smsSettings.apiToken || process.env.TEXTLK_API_TOKEN;
      const senderId =
        smsSettings.senderId ||
        process.env.TEXTLK_SENDER_ID ||
        "Lumora Tech";
      if (!apiToken) {
        console.warn(`⚠️ Gym ${gymId} has no SMS token, skipping reminders`);
        continue;
      }

      // Members who already paid this month
      const paymentsSnap = await db
        .collection("payments")
        .where("gymId", "==", gymId)
        .where("month", "==", monthStr)
        .get();
      const paidMemberIds = new Set(
        paymentsSnap.docs.map((d) => d.data().memberId),
      );

      // Active, non-VIP members
      const membersSnap = await db
        .collection("members")
        .where("gymId", "==", gymId)
        .where("status", "==", "active")
        .get();

      const gymName = gym.name || "Your Gym";
      const dueLabel = dueDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
      });

      for (const memberDoc of membersSnap.docs) {
        const member = memberDoc.data();
        if (member.role && member.role !== "member") continue;
        if (member.isVip) continue; // VIP / fee-exempt members don't pay
        // Skip special-case members with no fee to collect (fee 0 or unset)
        if (!(Number(member.membershipFee) > 0)) continue;
        if (paidMemberIds.has(memberDoc.id)) continue;

        const phone = member.mobile || member.whatsapp || member.phone;
        if (!phone) continue;

        // Dedupe: one reminder per member per due-offset per month
        const reminderId = `${gymId}_${memberDoc.id}_${monthStr}_${daysUntilDue}`;
        const reminderRef = db.collection("payment_reminders").doc(reminderId);
        const existing = await reminderRef.get();
        if (existing.exists) continue;

        const fee = member.membershipFee
          ? `Rs. ${Number(member.membershipFee).toLocaleString()}`
          : "";
        const message =
          `💪 ${gymName} payment reminder\n\n` +
          `Hi ${member.name || "Member"}, your membership payment` +
          (fee ? ` of ${fee}` : "") +
          ` is due by ${dueLabel}.\n\n` +
          `Please make your payment to keep your access active. Thank you!`;

        const sent = await sendPlainSMS(apiToken, senderId, phone, message);
        if (sent) {
          await reminderRef.set({
            gymId,
            memberId: memberDoc.id,
            memberName: member.name || "",
            month: monthStr,
            daysBeforeDue: daysUntilDue,
            channel: "sms",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          await db.collection("notifications").add({
            gymId,
            memberId: memberDoc.id,
            memberName: member.name || "",
            type: "payment_reminder",
            channel: "sms",
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`✅ Payment reminder SMS sent to ${member.name}`);
        }
      }
    }

    return null;
  });
