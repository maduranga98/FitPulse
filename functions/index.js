/* eslint-disable no-unused-vars */

// ⚠️ LOAD ENVIRONMENT VARIABLES FIRST!
import "dotenv/config.js";

import * as functions from "firebase-functions";
import admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import process from "process";
import * as metaWhatsAppService from "./services/metaWhatsAppService.js";

admin.initializeApp();

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
    const body = req.body;
    console.log("📡 Hikvision event received:", JSON.stringify(body));

    // Hikvision sends events in various envelope shapes depending on firmware.
    // We support both the flat AccessControllerEvent and the nested JSON envelope.
    const event =
      body?.AccessControllerEvent ||
      body?.Events?.[0]?.AccessControllerEvent ||
      null;

    if (!event) {
      console.log("⏭️  No AccessControllerEvent in payload, ignoring");
      res.status(200).send("OK");
      return;
    }

    const employeeNo = event.employeeNoString || String(event.employeeNo || "");
    const deviceIp =
      body.ipAddress || req.headers["x-forwarded-for"] || req.ip || "";
    const eventTime = event.time ? new Date(event.time) : new Date();

    if (!employeeNo) {
      console.warn("⚠️  No employeeNo in event, ignoring");
      res.status(200).send("OK");
      return;
    }

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

    // 2. Validate gym
    const gymDoc = await db.collection("gyms").doc(gymId).get();
    if (!gymDoc.exists || gymDoc.data().status !== "active") {
      console.warn(`⚠️  Gym ${gymId} not found or not active`);
      res.status(200).send("OK");
      return;
    }

    // 3. Look up member by hikvisionUserId within the gym
    const memberSnap = await db
      .collection("members")
      .where("gymId", "==", gymId)
      .where("hikvisionUserId", "==", employeeNo)
      .limit(1)
      .get();

    if (memberSnap.empty) {
      console.warn(`⚠️  No member with hikvisionUserId ${employeeNo} in gym ${gymId}`);
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
    const dedupeWindowMs = 10 * 1000;
    const dedupeKey = `${deviceId}_${memberDoc.id}`;
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
      const lastTime = lastEvent.checkInTime?.toDate?.() || new Date(lastEvent.checkInTime);
      if (eventTime - lastTime < dedupeWindowMs) {
        console.log(`⏭️  Duplicate event for ${member.name} within 10s, skipping`);
        res.status(200).send("OK");
        return;
      }
    }

    // 5. Write attendance record
    const dateStr = eventTime.toISOString().split("T")[0];
    const attendanceRef = db.collection("attendance").doc(
      `${deviceId}_${memberDoc.id}_${eventTime.getTime()}`
    );

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
        cardNo: event.cardNo || null,
        eventType: event.eventType || null,
        verifyMode: event.verifyMode || null,
      },
      createdAt: admin.firestore.Timestamp.now(),
    });

    // 6. Update device last heartbeat
    await deviceDoc.ref.update({
      lastHeartbeat: admin.firestore.Timestamp.now(),
      status: "online",
    });

    console.log(`✅ Attendance recorded: ${member.name} via ${deviceData.name || deviceId}`);
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ hikvisionEvent error:", error);
    // Always return 200 to prevent device retry storms
    res.status(200).send("OK");
  }
});

/**
 * Test connectivity to a registered Hikvision device.
 * Calls GET /ISAPI/System/deviceInfo on the device and returns the result.
 */
export const testDeviceConnection = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const { deviceId, gymId } = data;
  if (!deviceId || !gymId) {
    throw new functions.https.HttpsError("invalid-argument", "deviceId and gymId required");
  }

  const db = admin.firestore();
  const deviceDoc = await db.collection("gyms").doc(gymId).collection("devices").doc(deviceId).get();

  if (!deviceDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Device not found");
  }

  const device = deviceDoc.data();

  try {
    const { default: https } = await import("https");
    const { default: http } = await import("http");

    const isHttps = (device.protocol || "HTTP").toUpperCase() === "HTTPS";
    const agent = isHttps ? https : http;

    const credentials = Buffer.from(`${device.username}:${device.password}`).toString("base64");

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
        res.on("end", () => resolve({ statusCode: res.statusCode, body: data }));
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Connection timed out")); });
      req.end();
    });

    if (result.statusCode === 200) {
      await deviceDoc.ref.update({ status: "online", lastHeartbeat: admin.firestore.Timestamp.now() });
      return { success: true, statusCode: result.statusCode };
    } else {
      await deviceDoc.ref.update({ status: "error" });
      return { success: false, error: `Device returned HTTP ${result.statusCode}` };
    }
  } catch (err) {
    await deviceDoc.ref.update({ status: "offline" });
    return { success: false, error: err.message };
  }
});

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
