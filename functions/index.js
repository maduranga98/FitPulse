const functions = require("firebase-functions");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");

admin.initializeApp();

// ========================================
// 🔍 FACE RECOGNITION FUNCTION
// ========================================
// Triggers when a photo is uploaded to temp-captures/
// Automatically recognizes face and marks attendance
// ========================================

exports.recognizeFace = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const bucketName = object.bucket;

    console.log("📸 New image uploaded:", filePath);

    // Only process images in temp-captures folder
    if (!filePath.startsWith("temp-captures/")) {
      console.log("⏭️  Skipping - not in temp-captures folder");
      return null;
    }

    try {
      // ========================================
      // STEP 1: Detect Face in Uploaded Image
      // ========================================
      const client = new vision.ImageAnnotatorClient();
      const gcsUri = `gs://${bucketName}/${filePath}`;

      console.log("🔍 Detecting face in image...");
      const [result] = await client.faceDetection(gcsUri);
      const faces = result.faceAnnotations;

      if (!faces || faces.length === 0) {
        console.log("❌ No face detected in image");

        // Clean up the temp file
        await admin.storage().bucket(bucketName).file(filePath).delete();
        return null;
      }

      console.log(`✅ Detected ${faces.length} face(s)`);

      // Get the first (primary) face
      const detectedFace = faces[0];

      // ========================================
      // STEP 2: Extract Device ID
      // ========================================
      const filename = filePath.split("/")[1];
      const deviceId = filename.split("_").slice(0, 2).join("_");

      console.log("📱 Device ID:", deviceId);

      // ========================================
      // STEP 3: Compare with Registered Members
      // ========================================
      console.log("👥 Fetching registered members...");

      const membersSnapshot = await admin
        .firestore()
        .collection("members")
        .where("faceRegistered", "==", true)
        .get();

      if (membersSnapshot.empty) {
        console.log("⚠️  No registered members found");
        await admin.storage().bucket(bucketName).file(filePath).delete();
        return null;
      }

      console.log(`📋 Found ${membersSnapshot.size} registered members`);

      // Compare faces
      let bestMatch = null;
      let highestConfidence = 0;

      for (const memberDoc of membersSnapshot.docs) {
        const member = memberDoc.data();

        if (!member.facePhotoURL) {
          continue;
        }

        try {
          // Compare this member's face with detected face
          const [compareResult] = await client.faceDetection(
            member.facePhotoURL
          );
          const memberFaces = compareResult.faceAnnotations;

          if (!memberFaces || memberFaces.length === 0) {
            continue;
          }

          const memberFace = memberFaces[0];

          // Calculate similarity
          const similarity = compareFaces(detectedFace, memberFace);

          console.log(
            `  Comparing with ${member.name}: ${(similarity * 100).toFixed(1)}%`
          );

          if (similarity > highestConfidence && similarity > 0.75) {
            highestConfidence = similarity;
            bestMatch = {
              id: memberDoc.id,
              ...member,
            };
          }
        } catch (error) {
          console.error(`Error comparing with ${member.name}:`, error.message);
        }
      }

      // ========================================
      // STEP 4: Mark Attendance if Match Found
      // ========================================
      if (bestMatch) {
        console.log(
          `✅ MATCH FOUND: ${bestMatch.name} (${(
            highestConfidence * 100
          ).toFixed(1)}% confidence)`
        );

        // Check if already checked in today
        const today = new Date().toISOString().split("T")[0];
        const existingAttendance = await admin
          .firestore()
          .collection("attendance")
          .where("memberId", "==", bestMatch.id)
          .where("date", "==", today)
          .limit(1)
          .get();

        if (!existingAttendance.empty) {
          console.log("⚠️  Member already checked in today");
        } else {
          // Mark new attendance
          await admin
            .firestore()
            .collection("attendance")
            .add({
              memberId: bestMatch.id,
              memberName: bestMatch.name,
              gymId: bestMatch.gymId,
              deviceId: deviceId,
              checkInTime: admin.firestore.FieldValue.serverTimestamp(),
              date: today,
              confidence: highestConfidence * 100,
              status: "verified",
              recognitionMethod: "cloud-vision",
            });

          console.log("✅ Attendance marked successfully!");
        }
      } else {
        console.log("❌ No matching member found (confidence too low)");
      }

      // ========================================
      // STEP 5: Clean Up Temp File
      // ========================================
      await admin.storage().bucket(bucketName).file(filePath).delete();
      console.log("🗑️  Temp file deleted");
    } catch (error) {
      console.error("❌ Error processing image:", error);
    }

    return null;
  });

// ========================================
// 🔧 HELPER FUNCTION: Compare Faces
// ========================================
function compareFaces(face1, face2) {
  let similarityScore = 0;
  let comparisons = 0;

  // Compare key landmarks if available
  if (face1.landmarks && face2.landmarks) {
    const landmarks1 = face1.landmarks;
    const landmarks2 = face2.landmarks;

    for (let i = 0; i < Math.min(landmarks1.length, landmarks2.length); i++) {
      const l1 = landmarks1[i];
      const l2 = landmarks2[i];

      if (l1.type === l2.type && l1.position && l2.position) {
        const dx = l1.position.x - l2.position.x;
        const dy = l1.position.y - l2.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const normalizedDistance = Math.max(0, 100 - distance);
        similarityScore += normalizedDistance;
        comparisons++;
      }
    }
  }

  const avgSimilarity =
    comparisons > 0 ? similarityScore / comparisons / 100 : 0;

  const confidenceBoost =
    Math.min(face1.detectionConfidence || 0, face2.detectionConfidence || 0) *
    0.1;

  return Math.min(1, avgSimilarity + confidenceBoost);
}

// ========================================
// 📝 PROCESS FACE REGISTRATION
// ========================================
exports.processFaceRegistration = functions.firestore
  .document("members/{memberId}")
  .onCreate(async (snap, context) => {
    const member = snap.data();

    if (!member.facePhotoURL || !member.faceRegistered) {
      return null;
    }

    console.log("📸 Processing face registration for:", member.name);

    try {
      const client = new vision.ImageAnnotatorClient();
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
        faceEnrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("✅ Face registration processed successfully");
    } catch (error) {
      console.error("❌ Error processing face registration:", error);

      await snap.ref.update({
        faceRegistrationError: error.message,
      });
    }

    return null;
  });
