#!/usr/bin/env node
// Offline regression test for the ISAPI block/unblock logic.
// Runs against a mock Hikvision terminal — no real hardware needed:
//
//   node test-isapi.js
//
// The mock reproduces the two firmware behaviors that broke this feature
// in the field:
//   1. Search returns extra fields (numOfFace, userVerifyMode, checkUser,
//      password, ...) that must NOT be echoed back in Modify.
//   2. A Modify containing any field outside the accepted set is answered
//      with 200 OK / statusCode 1 but silently ignored.
// If buildModifyPayload ever starts echoing the Search response back
// wholesale again, this test fails instead of the real door.

const http = require("http");
const crypto = require("crypto");
const assert = require("assert");
const { blockUser, unblockUser } = require("./isapi");

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

function resetDevice() {
  ignoredModifies = 0;
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
    // ── block ────────────────────────────────────────────────────────
    resetDevice();
    const { current } = await blockUser(device, "PGNA117X");

    check("block sends no rejected fields (device applied it)", () =>
      assert.strictEqual(ignoredModifies, 0)
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
    check("block reports the original window for later restore", () =>
      assert.deepStrictEqual(current.Valid, ORIGINAL_VALID)
    );

    // ── unblock ──────────────────────────────────────────────────────
    await unblockUser(device, "PGNA117X", {
      beginTime: ORIGINAL_VALID.beginTime,
      endTime: ORIGINAL_VALID.endTime,
    });

    check("unblock restores the exact original window", () =>
      assert.deepStrictEqual(deviceUser.Valid, ORIGINAL_VALID)
    );
    check("unblock needed no ignored attempts", () =>
      assert.strictEqual(ignoredModifies, 0)
    );

    // ── a device that ignores everything must FAIL, not report success ──
    resetDevice();
    const strict = new Set(["nothing"]);
    const realAccepted = new Set(ACCEPTED);
    ACCEPTED.clear();
    strict.forEach((f) => ACCEPTED.add(f));
    let threw = false;
    try {
      await blockUser(device, "PGNA117X");
    } catch {
      threw = true;
    }
    realAccepted.forEach((f) => ACCEPTED.add(f));
    check("a silently-ignoring device makes block fail loudly", () =>
      assert.ok(threw, "blockUser resolved even though nothing changed")
    );
    check("...and leaves the window untouched", () =>
      assert.deepStrictEqual(deviceUser.Valid, ORIGINAL_VALID)
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
