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
const os = require("os");
const admin = require("firebase-admin");
const log = require("./logger");
const { blockUser, unblockUser, searchUser } = require("./isapi");
const { orderCommandChanges } = require("./queueOrder");

const GYM_ID = process.env.GYM_ID;
if (!GYM_ID) {
  console.error("GYM_ID is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const VERSION = require("./package.json").version;
const STARTED_AT = new Date().toISOString();

const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);
const RETRY_BASE_MS = Number(process.env.RETRY_BASE_MS || 5000);
// The app treats the relay as offline if the heartbeat goes stale, so it can
// say "relay offline" instead of spinning on "syncing…" forever.
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS || 30000);
// A command left in "processing" by a crash/restart is retried after this.
const STALE_PROCESSING_MS = Number(process.env.STALE_PROCESSING_MS || 120000);

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const gymRef = () => db.collection("gyms").doc(GYM_ID);

// gyms/{gymId}/relayStatus/agent — readable by the app (Firestore rules deny
// client writes), so the Block Access tab can show whether this process is
// alive before anyone waits on a command.
async function writeHeartbeat(extra = {}) {
  try {
    await gymRef()
      .collection("relayStatus")
      .doc("agent")
      .set(
        {
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
          host: os.hostname(),
          startedAt: STARTED_AT,
          heartbeatMs: HEARTBEAT_MS,
          version: VERSION,
          ...extra,
        },
        { merge: true }
      );
  } catch (err) {
    log.warn(`Heartbeat write failed: ${err.message}`);
  }
}

// A relay that died mid-command leaves the doc in "processing" forever, and
// the app would wait on it just as forever. Hand those back to the queue.
async function requeueStaleCommands() {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  const stale = await gymRef()
    .collection("deviceCommands")
    .where("status", "==", "processing")
    .get();

  const orphans = stale.docs.filter((d) => {
    const startedAt = d.data().processingStartedAt?.toDate?.();
    return !startedAt || startedAt < cutoff;
  });
  for (const d of orphans) {
    log.warn(`Requeuing stale command ${d.id} left in "processing"`);
    await d.ref.update({ status: "pending" });
  }
  return orphans.length;
}

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

async function main() {
  log.info(`Relay agent v${VERSION} starting for gym ${GYM_ID} on ${os.hostname()}`);

  // Fail fast and loudly on the mistake that silently breaks everything:
  // a GYM_ID that doesn't exist. Commands would queue under a gym nobody
  // is watching and the app would spin on "syncing…" indefinitely.
  const gymSnap = await gymRef().get();
  if (!gymSnap.exists) {
    log.error(
      `GYM_ID "${GYM_ID}" does not exist in Firestore. Fix .env — ` +
        `commands from the app will never be picked up. Run "npm run doctor".`
    );
    process.exit(1);
  }
  log.info(`Watching gym "${gymSnap.data().name || GYM_ID}"`);

  const devices = await loadDevices();
  if (devices.length === 0) {
    log.warn(
      "No devices with credentials configured for this gym — commands will " +
        'fail until one is set up. Run "npm run doctor" for details.'
    );
  } else {
    log.info(
      `${devices.length} device(s) configured: ${devices
        .map((d) => `${d.name} (${d.ip})`)
        .join(", ")}`
    );
  }

  await writeHeartbeat({ deviceCount: devices.length });
  setInterval(() => writeHeartbeat().catch(() => {}), HEARTBEAT_MS).unref?.();

  const requeued = await requeueStaleCommands();
  if (requeued > 0) log.info(`Requeued ${requeued} stale command(s)`);

  const commandsRef = gymRef()
    .collection("deviceCommands")
    .where("status", "==", "pending");

  commandsRef.onSnapshot(
    (snap) => {
      // A snapshot carrying a backlog (the relay was down while staff kept
      // clicking) arrives in document-ID order, NOT the order the commands
      // were issued. Applying them that way leaves the device in whatever
      // state the alphabetically-last command asked for, which can be the
      // opposite of what staff last pressed. Order by createdAt so the last
      // intent is the one that sticks.
      const changes = orderCommandChanges(
        snap.docChanges().filter((c) => c.type === "added" || c.type === "modified")
      );

      if (changes.length > 1) {
        log.info(
          `Draining ${changes.length} queued command(s) in the order they were issued`
        );
      }

      for (const change of changes) {
        const doc = change.doc;
        queue = queue
          .then(() => processCommand(doc))
          .catch((err) =>
            log.error(`Unhandled error processing ${doc.id}: ${err.stack || err.message}`)
          );
      }
    },
    (err) => {
      log.error(`Firestore listener error: ${err.message} — exiting so pm2/systemd restarts us`);
      process.exit(1);
    }
  );
}

main().catch((err) => {
  log.error(`Relay agent failed to start: ${err.stack || err.message}`);
  process.exit(1);
});
