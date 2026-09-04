#!/usr/bin/env node
// Preflight diagnostics for the relay agent.
//
//   npm run doctor
//   npm run doctor -- --employee PGNA117X
//
// Answers the one question that matters when the app sits on
// "Door: syncing…": which link in the chain is broken?
//
//   .env → Firebase credentials → gym exists → devices configured →
//   device reachable → digest auth works → member exists on device
//
// Every check prints PASS/FAIL with the fix, and nothing is written to the
// device: this is read-only.

require("dotenv").config();
const net = require("net");
const admin = require("firebase-admin");
const { digestRequest } = require("./digest");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

let failed = 0;
const pass = (msg) => console.log(`  \x1b[32mPASS\x1b[0m  ${msg}`);
const fail = (msg, fix) => {
  failed++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${msg}`);
  if (fix) console.log(`        → ${fix}`);
};
const info = (msg) => console.log(`        ${msg}`);
const section = (t) => console.log(`\n${t}`);

// TCP reachability, separated from HTTP so "wrong IP / firewall / device off"
// reads differently from "bad password".
function tcpProbe(host, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done({ ok: true }));
    socket.on("timeout", () => done({ ok: false, error: "timed out" }));
    socket.on("error", (err) => done({ ok: false, error: err.code || err.message }));
  });
}

async function main() {
  console.log("FitPulse relay agent — diagnostics\n" + "=".repeat(38));

  // ── 1. Configuration ──────────────────────────────────────────────
  section("1. Configuration (.env)");
  const GYM_ID = process.env.GYM_ID;
  if (GYM_ID) pass(`GYM_ID = ${GYM_ID}`);
  else {
    fail("GYM_ID is not set", "cp .env.example .env, then set GYM_ID to the gym's Firestore document ID");
    return;
  }

  // ── 2. Firebase credentials ───────────────────────────────────────
  section("2. Firebase credentials");
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    pass("Service account loaded");
  } catch (err) {
    fail(`Could not load credentials — ${err.message}`,
      "Put service-account.json in this folder and set GOOGLE_APPLICATION_CREDENTIALS to its path");
    return;
  }
  const db = admin.firestore();

  // ── 3. The gym document ───────────────────────────────────────────
  section("3. Gym document");
  const gymRef = db.collection("gyms").doc(GYM_ID);
  let gymSnap;
  try {
    gymSnap = await gymRef.get();
  } catch (err) {
    fail(`Firestore unreachable — ${err.message}`, "Check this machine's internet access and the service account's project");
    return;
  }
  if (gymSnap.exists) {
    pass(`gyms/${GYM_ID} exists — "${gymSnap.data().name || "(unnamed)"}"`);
  } else {
    fail(`gyms/${GYM_ID} does not exist`,
      "GYM_ID in .env does not match the gym you are clicking Block in — commands queue where nothing is watching");
    return;
  }

  // ── 4. Devices ────────────────────────────────────────────────────
  section("4. Devices");
  const [devSnap, cfgSnap] = await Promise.all([
    gymRef.collection("devices").get(),
    gymRef.collection("deviceConfig").get(),
  ]);
  const configs = new Map(cfgSnap.docs.map((d) => [d.id, d.data()]));

  if (devSnap.empty) {
    fail("No devices under gyms/{gymId}/devices",
      "Add the terminal on the app's Devices page (it needs at least an ip field)");
  }
  const devices = devSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .map((d) => {
      const cfg = configs.get(d.id) || {};
      return {
        id: d.id,
        name: d.name || d.id,
        ip: cfg.ip || d.ip,
        port: cfg.port || d.port || 80,
        username: cfg.adminUsername || cfg.username || d.username || process.env.DEVICE_USERNAME,
        password: cfg.adminPassword || cfg.password || d.password || process.env.DEVICE_PASSWORD,
        credsFrom: cfg.adminUsername || cfg.username
          ? `deviceConfig/${d.id}`
          : d.username
            ? "device doc"
            : process.env.DEVICE_USERNAME
              ? ".env"
              : "nowhere",
      };
    });

  const usable = [];
  for (const d of devices) {
    if (!d.ip) {
      fail(`${d.name}: no ip`, "Set the device IP on the Devices page");
      continue;
    }
    if (!d.username || !d.password) {
      fail(`${d.name} (${d.ip}): no credentials — the relay skips it`,
        `Set adminUsername/adminPassword on gyms/${GYM_ID}/deviceConfig/${d.id}, or DEVICE_USERNAME/DEVICE_PASSWORD in .env`);
      continue;
    }
    pass(`${d.name} (${d.ip}:${d.port}) — credentials from ${d.credsFrom}`);
    usable.push(d);
  }

  // ── 5. Reachability + auth ────────────────────────────────────────
  section("5. Device reachability (from THIS machine)");
  if (usable.length === 0) {
    fail("No device to test", "Fix the devices above first");
  }
  const employeeNo = arg("employee");

  for (const d of usable) {
    const tcp = await tcpProbe(d.ip, d.port);
    if (!tcp.ok) {
      fail(`${d.name} (${d.ip}:${d.port}) — TCP ${tcp.error}`,
        "This machine is not on the same LAN as the terminal, the IP changed (use a DHCP reservation), or the device is off");
      continue;
    }
    pass(`${d.name} — TCP connect OK`);

    try {
      const res = await digestRequest({
        host: d.ip,
        port: d.port,
        method: "GET",
        path: "/ISAPI/System/deviceInfo?format=json",
        username: d.username,
        password: d.password,
      });
      if (res.status === 200) {
        const di = res.json?.DeviceInfo || {};
        pass(`${d.name} — ISAPI auth OK (${di.model || "?"} fw ${di.firmwareVersion || "?"})`);
      } else {
        fail(`${d.name} — ISAPI returned HTTP ${res.status}`, res.body.slice(0, 200));
        continue;
      }
    } catch (err) {
      fail(`${d.name} — ISAPI auth failed: ${err.message}`,
        "Check the device admin username/password. Too many bad tries locks the account for ~30 min");
      continue;
    }

    if (employeeNo) {
      try {
        const { searchUser } = require("./isapi");
        const u = await searchUser(d, employeeNo);
        const v = u.Valid || {};
        const expired = v.endTime && new Date(v.endTime) < new Date();
        pass(`${d.name} — employeeNo ${employeeNo} found: "${u.name}"`);
        info(`Valid: enable=${v.enable} ${v.beginTime} → ${v.endTime} — ${expired ? "EXPIRED (blocked)" : "active"}`);
      } catch (err) {
        fail(`${d.name} — ${err.message}`,
          "The member's memberCode must match the employeeNo enrolled on the device, exactly");
      }
    }
  }

  // ── 6. The command queue ──────────────────────────────────────────
  section("6. Command queue");
  const cmds = await gymRef
    .collection("deviceCommands")
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  if (cmds.empty) {
    info("No commands have been queued for this gym yet.");
  } else {
    const pending = cmds.docs.filter((d) => ["pending", "processing"].includes(d.data().status));
    if (pending.length > 0) {
      const oldest = pending[pending.length - 1].data();
      const age = oldest.createdAt?.toDate?.()
        ? Math.round((Date.now() - oldest.createdAt.toDate()) / 1000)
        : "?";
      fail(`${pending.length} command(s) waiting, oldest queued ${age}s ago`,
        "Nothing is consuming the queue — start the relay with 'npm start' and it will drain immediately");
    } else {
      pass("No commands stuck in the queue");
    }
    for (const d of cmds.docs.slice(0, 5)) {
      const c = d.data();
      info(`${c.type} ${c.employeeNo} — ${c.status}${c.errorMessage ? ` (${c.errorMessage})` : ""}`);
    }
  }

  // ── 7. Heartbeat ──────────────────────────────────────────────────
  section("7. Relay heartbeat");
  const hb = await gymRef.collection("relayStatus").doc("agent").get();
  if (!hb.exists) {
    info("No relay has ever run for this gym (the app will show 'relay offline').");
  } else {
    const seen = hb.data().lastSeenAt?.toDate?.();
    const ageS = seen ? Math.round((Date.now() - seen) / 1000) : null;
    if (ageS !== null && ageS < 120) pass(`A relay is running on ${hb.data().host} (last seen ${ageS}s ago)`);
    else info(`Last relay heartbeat: ${seen ? `${ageS}s ago from ${hb.data().host}` : "unknown"} — not currently running`);
  }

  console.log(
    failed === 0
      ? "\n\x1b[32mAll checks passed.\x1b[0m Run 'npm start' to process door commands."
      : `\n\x1b[31m${failed} check(s) failed.\x1b[0m Fix the items above — door commands will not work until they pass.`
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(`\nUNEXPECTED ERROR: ${err.stack || err.message}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
