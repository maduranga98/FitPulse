// FitPulse device relay agent.
//
// Runs on a machine on the gym's local network (same LAN as the Hikvision
// terminal). Cloud Functions cannot reach the device's private IP, so the
// React app queues commands in Firestore and this process executes them:
//
//   gyms/{gymId}/deviceCommands  (status: pending)  ──▶  ISAPI call  ──▶
//   member doc updated + command marked completed/failed.
//
// See README.md for setup (service account, .env, pm2/systemd).

require("dotenv").config();
const admin = require("firebase-admin");
const log = require("./logger");
const { blockUser, unblockUser, searchUser } = require("./isapi");

const GYM_ID = process.env.GYM_ID;
if (!GYM_ID) {
  console.error("GYM_ID is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);
const RETRY_BASE_MS = Number(process.env.RETRY_BASE_MS || 5000);

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Devices are configured in the app (Devices page) under gyms/{gymId}/devices.
// Credentials are resolved in priority order:
//   1. gyms/{gymId}/deviceConfig/{deviceId} — locked down in Firestore rules
//      (no client can read it; only this relay via the Admin SDK)
//   2. username/password fields on the device doc itself (legacy)
//   3. DEVICE_USERNAME / DEVICE_PASSWORD from the environment
async function loadDevices() {
  const gymRef = db.collection("gyms").doc(GYM_ID);
  const [snap, configSnap] = await Promise.all([
    gymRef.collection("devices").get(),
    gymRef.collection("deviceConfig").get(),
  ]);
  const configs = new Map(configSnap.docs.map((d) => [d.id, d.data()]));

  const devices = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.ip)
    .map((d) => {
      const cfg = configs.get(d.id) || {};
      return {
        id: d.id,
        name: d.name || d.id,
        ip: cfg.ip || d.ip,
        port: cfg.port || d.port || 80,
        username:
          cfg.adminUsername ||
          cfg.username ||
          d.username ||
          process.env.DEVICE_USERNAME,
        password:
          cfg.adminPassword ||
          cfg.password ||
          d.password ||
          process.env.DEVICE_PASSWORD,
      };
    });

  const missingCreds = devices.filter((d) => !d.username || !d.password);
  for (const d of missingCreds) {
    log.warn(`Device ${d.name} (${d.ip}) has no credentials configured — skipping`);
  }
  return devices.filter((d) => d.username && d.password);
}

async function executeOnDevice(device, command) {
  const employeeNo = command.employeeNo;

  // The Modify body carries the user's name, so use the app's name and only
  // fall back to reading it off the device when the member has none.
  let name = command.memberName || "";
  if (!name) name = (await searchUser(device, employeeNo)).name || "";

  if (command.type === "block") {
    await blockUser(device, employeeNo, name);
  } else if (command.type === "unblock") {
    await unblockUser(device, employeeNo, name);
  } else {
    throw new Error(`Unknown command type: ${command.type}`);
  }
}

async function processCommand(doc) {
  const command = doc.data();
  const label = `${command.type} ${command.employeeNo} (cmd ${doc.id})`;
  log.info(`Processing ${label}`);

  // Claim the command so a restart doesn't double-run it.
  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (fresh.data()?.status !== "pending") throw new Error("already-claimed");
      tx.update(doc.ref, {
        status: "processing",
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } catch (e) {
    if (e.message === "already-claimed") {
      log.info(`Skipping ${label} — already claimed`);
      return;
    }
    throw e;
  }

  const memberRef = command.memberId
    ? db.collection("members").doc(command.memberId)
    : null;

  const devices = await loadDevices();
  if (devices.length === 0) {
    await doc.ref.update({
      status: "failed",
      errorMessage:
        "No devices with credentials configured for this gym (gyms/{gymId}/devices)",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    log.error(`${label}: no configured devices`);
    return;
  }

  const errors = [];

  for (const device of devices) {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await executeOnDevice(device, command);
        lastError = null;
        log.info(`${label}: OK on ${device.name} (${device.ip}), attempt ${attempt}`);
        break;
      } catch (err) {
        lastError = err;
        log.warn(
          `${label}: attempt ${attempt}/${MAX_ATTEMPTS} on ${device.name} (${device.ip}) failed — ${err.message}`
        );
        if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
      }
    }
    if (lastError) errors.push(`${device.name} (${device.ip}): ${lastError.message}`);
  }

  if (errors.length > 0) {
    await doc.ref.update({
      status: "failed",
      errorMessage: errors.join(" | "),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    log.error(`${label}: FAILED — ${errors.join(" | ")}`);
    return;
  }

  // All devices succeeded — update the member doc, then close the command.
  if (memberRef) {
    const update =
      command.type === "block"
        ? {
            accessBlocked: true,
            accessBlockedAt: admin.firestore.FieldValue.serverTimestamp(),
            accessBlockedReason: command.reason || null,
            accessBlockedBy: command.createdByName || command.createdBy || null,
          }
        : {
            accessBlocked: false,
            accessBlockedAt: null,
            accessBlockedReason: null,
            accessBlockedBy: null,
          };
    await memberRef.update(update);
  }

  await doc.ref.update({
    status: "completed",
    errorMessage: null,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  log.info(`${label}: COMPLETED`);
}

// Serialize command processing — commands for the same member must not race.
let queue = Promise.resolve();

function main() {
  log.info(`Relay agent starting for gym ${GYM_ID}`);
  const commandsRef = db
    .collection("gyms")
    .doc(GYM_ID)
    .collection("deviceCommands")
    .where("status", "==", "pending");

  commandsRef.onSnapshot(
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== "added" && change.type !== "modified") return;
        const doc = change.doc;
        queue = queue
          .then(() => processCommand(doc))
          .catch((err) =>
            log.error(`Unhandled error processing ${doc.id}: ${err.stack || err.message}`)
          );
      });
    },
    (err) => {
      log.error(`Firestore listener error: ${err.message} — exiting so pm2/systemd restarts us`);
      process.exit(1);
    }
  );
}

main();
