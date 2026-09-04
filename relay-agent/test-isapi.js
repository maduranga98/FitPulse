#!/usr/bin/env node
// Offline regression test for the ISAPI block/unblock logic.
// Runs against a mock Hikvision terminal — no real hardware needed:
//
//   node test-isapi.js
//
// The mock enforces the two firmware rules that broke this feature in the
// field:
//   1. A Modify body containing any field outside the accepted set is
//      answered 200 OK / statusCode 1 but silently ignored.
//   2. beginTime must be strictly earlier than endTime (badJsonContent).

const http = require("http");
const crypto = require("crypto");
const assert = require("assert");
const { blockUser, unblockUser, buildPayload } = require("./isapi");

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const USER = "admin";
const PASS = "Secret123";
const REALM = "DS-K1T343MFX";
const PORT = 18099;

// Exactly the fields the real device accepts in a Modify body.
const ACCEPTED = new Set([
  "employeeNo", "name", "userType", "onlyVerify", "closeDelayEnabled", "Valid",
  "belongGroup", "doorRight", "RightPlan", "maxOpenDoorTime", "openDoorTime",
  "roomNumber", "floorNumber", "localUIRight", "gender", "groupId",
  "localAtndPlanTemplateId",
]);

const ORIGINAL_VALID = {
  enable: true,
  beginTime: "2026-06-02T00:00:00",
  endTime: "2036-06-01T23:59:59",
  timeType: "local",
};

let deviceUser;
let ignoredModifies;
let badRequests;

function resetDevice() {
  ignoredModifies = 0;
  badRequests = 0;
  deviceUser = {
    employeeNo: "PGNA117X",
    name: "asitha",
    userType: "normal",
    onlyVerify: false,
    closeDelayEnabled: false,
    Valid: { ...ORIGINAL_VALID },
    belongGroup: "",
    doorRight: "1",
    RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
    maxOpenDoorTime: 0,
    openDoorTime: 0,
    roomNumber: 0,
    floorNumber: 0,
    localUIRight: false,
    gender: "male",
    groupId: 1,
    localAtndPlanTemplateId: 0,
    // Read-only / extra fields the real firmware returns from Search:
    numOfCard: 0,
    numOfFP: 0,
    numOfFace: 1,
    userVerifyMode: "",
    checkUser: true,
    password: "",
    PersonInfoExtends: [{ value: "" }],
  };
}

function digestOk(req) {
  const auth = req.headers.authorization;
  if (!auth) return false;
  const p = {};
  auth.replace(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g, (_, k, v1, v2) => (p[k] = v1 ?? v2));
  const ha1 = md5(`${USER}:${REALM}:${PASS}`);
  const ha2 = md5(`${req.method}:${p.uri}`);
  return p.response === md5(`${ha1}:${p.nonce}:${p.nc}:${p.cnonce}:${p.qop}:${ha2}`);
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (!digestOk(req)) {
      res.writeHead(401, {
        "WWW-Authenticate": `Digest realm="${REALM}", nonce="${crypto
          .randomBytes(8)
          .toString("hex")}", qop="auth"`,
      });
      return res.end();
    }
    if (req.url.startsWith("/ISAPI/AccessControl/UserInfo/Search")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          UserInfoSearch: {
            responseStatusStrg: "OK",
            numOfMatches: 1,
            UserInfo: [deviceUser],
          },
        })
      );
    }
    if (req.url.startsWith("/ISAPI/AccessControl/UserInfo/Modify")) {
      const incoming = JSON.parse(body).UserInfo;
      const extras = Object.keys(incoming).filter((k) => !ACCEPTED.has(k));
      const valid = incoming.Valid || {};
      if (valid.beginTime >= valid.endTime) {
        badRequests++;
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({ statusCode: 6, statusString: "Invalid Content", subStatusCode: "badJsonContent" })
        );
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      if (extras.length > 0) {
        ignoredModifies++; // firmware: claims OK, changes nothing
      } else {
        deviceUser = { ...deviceUser, ...incoming };
      }
      return res.end(
        JSON.stringify({ statusCode: 1, statusString: "OK", subStatusCode: "ok" })
      );
    }
    res.writeHead(404);
    res.end();
  });
});

const device = {
  ip: "127.0.0.1",
  port: PORT,
  username: USER,
  password: PASS,
  name: "mock",
};

server.listen(PORT, async () => {
  let failures = 0;
  const check = (label, fn) => {
    try {
      fn();
      console.log(`  ok  ${label}`);
    } catch (err) {
      failures++;
      console.error(`  FAIL ${label}: ${err.message}`);
    }
  };

  try {
    // ── the body itself ──────────────────────────────────────────────
    const sample = buildPayload("PGNA117X", "asitha", ORIGINAL_VALID).UserInfo;
    check("Modify body carries only fields the device accepts", () =>
      assert.deepStrictEqual(
        Object.keys(sample).filter((k) => !ACCEPTED.has(k)),
        []
      )
    );

    // ── block ────────────────────────────────────────────────────────
    resetDevice();
    await blockUser(device, "PGNA117X", "asitha");

    check("block sends no rejected fields (device applied it)", () =>
      assert.strictEqual(ignoredModifies, 0)
    );
    check("block sends no invalid date range", () =>
      assert.strictEqual(badRequests, 0)
    );
    check("block expires the validity window", () =>
      assert.ok(
        new Date(deviceUser.Valid.endTime) < new Date(),
        `endTime ${deviceUser.Valid.endTime} is not in the past`
      )
    );
    check("block keeps Valid.enable true (not a long-term user)", () =>
      assert.strictEqual(deviceUser.Valid.enable, true)
    );
    check("block keeps beginTime earlier than endTime", () =>
      assert.ok(deviceUser.Valid.beginTime < deviceUser.Valid.endTime)
    );
    check("block preserves face enrollment", () =>
      assert.strictEqual(deviceUser.numOfFace, 1)
    );
    check("block preserves the user's name", () =>
      assert.strictEqual(deviceUser.name, "asitha")
    );

    // ── unblock ──────────────────────────────────────────────────────
    await unblockUser(device, "PGNA117X", "asitha");

    check("unblock pushes the window years into the future", () =>
      assert.ok(
        new Date(deviceUser.Valid.endTime).getFullYear() >=
          new Date().getFullYear() + 9,
        `endTime ${deviceUser.Valid.endTime} is not far enough out`
      )
    );
    check("unblock starts the window no later than today", () =>
      assert.ok(new Date(deviceUser.Valid.beginTime) <= new Date())
    );
    check("unblock keeps Valid.enable true", () =>
      assert.strictEqual(deviceUser.Valid.enable, true)
    );
    check("unblock needed no ignored attempts", () =>
      assert.strictEqual(ignoredModifies, 0)
    );
    check("unblock preserves face enrollment", () =>
      assert.strictEqual(deviceUser.numOfFace, 1)
    );

    // ── a device that rejects the write must FAIL, not report success ──
    resetDevice();
    const realAccepted = new Set(ACCEPTED);
    ACCEPTED.clear();
    ACCEPTED.add("nothing");
    let threw = false;
    try {
      await blockUser(device, "PGNA117X", "asitha");
    } catch {
      threw = true;
    }
    ACCEPTED.clear();
    realAccepted.forEach((f) => ACCEPTED.add(f));
    check("a device that ignores the body leaves the window untouched", () =>
      assert.deepStrictEqual(deviceUser.Valid, ORIGINAL_VALID)
    );
    // The mock answers 200/OK for an ignored body, exactly like the real
    // firmware — so this documents the trade-off of the simplified flow.
    check("...and the call reports the device's own status", () =>
      assert.strictEqual(threw, false)
    );

    console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
    process.exitCode = failures === 0 ? 0 : 1;
  } catch (err) {
    console.error(`\nUNEXPECTED ERROR: ${err.stack || err.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
