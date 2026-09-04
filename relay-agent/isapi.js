// Hikvision ISAPI AccessControl helpers (DS-K1T343MFX and similar).
//
// Blocking and unblocking a member is ONE call — the validity window is the
// whole mechanism:
//
//   PUT /ISAPI/AccessControl/UserInfo/Modify?format=json  (digest auth)
//
// - Block   → Valid window is set to an already-elapsed range (end = yesterday).
//             The device stops recognising the user for door opening by itself.
// - Unblock → Valid window is set to a long future range (10 years out).
//
// Notes that cost real hardware time to learn:
// - Valid.enable=false means "long-term user, ignore the validity period" —
//   the OPPOSITE of blocking. It always stays true.
// - beginTime must be strictly earlier than endTime, or the device answers
//   badJsonContent.
// - The body must be exactly the field set below (the payload verified in
//   Postman). Echoing back everything UserInfo/Search returns makes some
//   firmwares answer 200 OK while silently ignoring the change.
// - Door rights are NOT touched here: the same static doorRight/RightPlan
//   from the verified payload is sent every time. Access is governed purely
//   by the dates.

const crypto = require("crypto");
const { digestRequest } = require("./digest");
const log = require("./logger");

// "YYYY-MM-DDTHH:mm:ss" in the relay host's local time (timeType: "local").
function toLocalIso(date) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
  );
}

// Expired window → device blocks the user and the door.
function blockedWindow() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 0);
  return {
    enable: true,
    beginTime: "2020-01-01T00:00:00",
    endTime: toLocalIso(end),
    timeType: "local",
  };
}

// Long future window → device lets the user in again.
function activeWindow(years = 10) {
  const begin = new Date();
  begin.setHours(0, 0, 0, 0);
  const end = new Date(begin);
  end.setFullYear(end.getFullYear() + years);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 0);
  return {
    enable: true,
    beginTime: toLocalIso(begin),
    endTime: toLocalIso(end),
    timeType: "local",
  };
}

// Exactly the body proven against the real DS-K1T343MFX.
function buildPayload(employeeNo, name, valid) {
  return {
    UserInfo: {
      employeeNo: String(employeeNo),
      name: name || String(employeeNo),
      userType: "normal",
      onlyVerify: false,
      closeDelayEnabled: false,
      Valid: valid,
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
    },
  };
}

function throwIsapiError(action, res) {
  const sub = res.json?.subStatusCode || res.json?.statusString;
  throw new Error(
    `${action} failed: HTTP ${res.status}${sub ? ` (${sub})` : ""} — ${res.body.slice(0, 300)}`
  );
}

// Read the user back — used only to keep the device's stored name when the
// app has none, and to log/verify what the device ended up with.
async function searchUser(device, employeeNo) {
  const res = await digestRequest({
    host: device.ip,
    port: device.port || 80,
    method: "POST",
    path: "/ISAPI/AccessControl/UserInfo/Search?format=json",
    username: device.username,
    password: device.password,
    jsonBody: {
      UserInfoSearchCond: {
        searchID: crypto.randomUUID(),
        searchResultPosition: 0,
        maxResults: 5,
        EmployeeNoList: [{ employeeNo: String(employeeNo) }],
      },
    },
  });
  if (res.status !== 200 || !res.json) throwIsapiError("UserInfo/Search", res);

  const search = res.json.UserInfoSearch;
  const matches = search?.UserInfo || [];
  if (search?.responseStatusStrg === "NO MATCH" || matches.length === 0) {
    throw new Error(`employeeNo ${employeeNo} not found on device ${device.ip}`);
  }
  return (
    matches.find((u) => String(u.employeeNo) === String(employeeNo)) || matches[0]
  );
}

// PUT is what the verified Postman request uses; a few firmwares only take
// POST and answer methodNotAllowed to PUT, so fall back once.
async function setValidity(device, employeeNo, name, valid) {
  const body = buildPayload(employeeNo, name, valid);
  let lastError = null;

  for (const method of ["PUT", "POST"]) {
    log.info(`${method} UserInfo/Modify → ${device.ip}: ${JSON.stringify(body)}`);
    const res = await digestRequest({
      host: device.ip,
      port: device.port || 80,
      method,
      path: "/ISAPI/AccessControl/UserInfo/Modify?format=json",
      username: device.username,
      password: device.password,
      jsonBody: body,
    });
    log.info(
      `${method} UserInfo/Modify ← HTTP ${res.status}: ${(res.body || "").slice(0, 300)}`
    );

    const ok =
      res.status === 200 &&
      (res.json?.statusCode === undefined || res.json.statusCode === 1);
    if (ok) return;

    lastError = () => throwIsapiError(`UserInfo/Modify (${method})`, res);
  }
  lastError();
}

/** Block: expire the validity window. */
async function blockUser(device, employeeNo, name) {
  await setValidity(device, employeeNo, name, blockedWindow());
}

/** Unblock: push the validity window years into the future. */
async function unblockUser(device, employeeNo, name) {
  await setValidity(device, employeeNo, name, activeWindow());
}

module.exports = {
  blockUser,
  unblockUser,
  searchUser,
  setValidity,
  blockedWindow,
  activeWindow,
  buildPayload,
  toLocalIso,
};
