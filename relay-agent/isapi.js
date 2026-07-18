// Hikvision ISAPI AccessControl helpers (DS-K1T343MFX and similar).
//
// Hard-won firmware facts baked in here:
// - Valid.enable=false means "ignore validity period" (long-term user),
//   NOT "disable user". Blocking is done by keeping enable=true and
//   setting an already-elapsed beginTime/endTime window.
// - beginTime must be strictly earlier than endTime or the device
//   returns badJsonContent.
// - The Modify body must contain EXACTLY the field set proven to work on
//   the real hardware (see MODIFY_FIELDS below, from the Postman test).
//   Echoing back everything Search returns can make firmware answer
//   200 OK while silently ignoring the change — extra/read-only fields
//   (numOfFace, userVerifyMode, checkUser, …) poison the request.
// - Some firmwares accept PUT on UserInfo/Modify, others only POST
//   (returning methodNotAllowed for PUT). We try PUT, fall back to POST.

const crypto = require("crypto");
const { digestRequest } = require("./digest");
const log = require("./logger");

// Field whitelist for the Modify body — exactly the set AND order from the
// payload verified working against the real DS-K1T343MFX in Postman
// (employeeNo, then these up to Valid, then the rest). Values are taken
// from the device's Search response when present so nothing gets
// overwritten with a guess; Valid is replaced by us.
const MODIFY_FIELDS_BEFORE_VALID = [
  "name",
  "userType",
  "onlyVerify",
  "closeDelayEnabled",
];
const MODIFY_FIELDS_AFTER_VALID = [
  "belongGroup",
  "doorRight",
  "RightPlan",
  "maxOpenDoorTime",
  "openDoorTime",
  "roomNumber",
  "floorNumber",
  "localUIRight",
  "gender",
  "groupId",
  "localAtndPlanTemplateId",
];

// "YYYY-MM-DDTHH:mm:ss" in the relay host's local time (device uses timeType: local)
function toLocalIso(date) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
  );
}

function yesterdayEnd() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 0);
  return toLocalIso(d);
}

function throwIsapiError(action, res) {
  const sub = res.json?.subStatusCode || res.json?.statusString;
  throw new Error(
    `${action} failed: HTTP ${res.status}${sub ? ` (${sub})` : ""} — ${res.body.slice(0, 300)}`
  );
}

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
  // Duplicate-employeeNo edge case seen during testing: fail loudly rather
  // than modify an ambiguous record.
  const exact = matches.filter((u) => String(u.employeeNo) === String(employeeNo));
  if (exact.length > 1) {
    throw new Error(
      `employeeNo ${employeeNo} matches ${exact.length} users on device ${device.ip} — resolve duplicates on the device first`
    );
  }
  return exact[0] || matches[0];
}

async function modifyUser(device, userInfo, method) {
  const body = { UserInfo: userInfo };
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
  if (res.status !== 200) throwIsapiError(`UserInfo/Modify (${method})`, res);
  const statusCode = res.json?.statusCode;
  if (statusCode !== undefined && statusCode !== 1) {
    throwIsapiError(`UserInfo/Modify (${method})`, res);
  }
  return res.json;
}

// Some firmwares only accept PUT on UserInfo/Modify, others only POST —
// and worse, a firmware can answer 200 OK for the wrong method without
// actually applying the change. So after each attempt we Search the user
// back and check the validity window really changed; only a verified
// write counts as success.
async function modifyAndVerify(device, employeeNo, payload, isApplied) {
  let lastError = null;
  for (const method of ["PUT", "POST"]) {
    try {
      await modifyUser(device, payload, method);
    } catch (err) {
      lastError = err;
      continue;
    }
    const after = await searchUser(device, employeeNo);
    log.info(
      `verify after ${method}: device Valid is now ${JSON.stringify(after.Valid)}`
    );
    if (isApplied(after.Valid || {})) return after;
    lastError = new Error(
      `device accepted UserInfo/Modify via ${method} but did not apply it — ` +
        `Valid is still ${JSON.stringify(after.Valid)}`
    );
  }
  throw lastError;
}

function buildModifyPayload(current, employeeNo, valid) {
  const payload = { employeeNo: String(employeeNo) };
  for (const f of MODIFY_FIELDS_BEFORE_VALID) {
    if (current[f] !== undefined) payload[f] = current[f];
  }
  payload.Valid = valid;
  for (const f of MODIFY_FIELDS_AFTER_VALID) {
    if (current[f] !== undefined) payload[f] = current[f];
  }
  return payload;
}

/**
 * Block: keep Valid.enable=true, force the validity window into the past.
 * Returns { current, payload } — current is the pre-modification UserInfo
 * (used to capture the original validity window on first block).
 */
async function blockUser(device, employeeNo) {
  const current = await searchUser(device, employeeNo);
  const endTime = yesterdayEnd();
  let beginTime = current.Valid?.beginTime || "2020-01-01T00:00:00";
  if (beginTime >= endTime) beginTime = "2020-01-01T00:00:00";

  const payload = buildModifyPayload(current, employeeNo, {
    enable: true,
    beginTime,
    endTime,
    timeType: current.Valid?.timeType || "local",
  });
  // Applied = validity is enforced and already expired.
  await modifyAndVerify(device, employeeNo, payload, (valid) => {
    return valid.enable === true && new Date(valid.endTime) < new Date();
  });
  return { current };
}

/**
 * Unblock: restore the member's original validity window.
 * validPeriod: { beginTime, endTime } captured at enrollment / first block.
 */
async function unblockUser(device, employeeNo, validPeriod) {
  const current = await searchUser(device, employeeNo);

  let { beginTime, endTime } = validPeriod || {};
  if (!beginTime || !endTime || beginTime >= endTime) {
    // No stored window — grant a fresh 10-year validity from now.
    const now = new Date();
    const end = new Date(now);
    end.setFullYear(end.getFullYear() + 10);
    beginTime = toLocalIso(now);
    endTime = toLocalIso(end);
  }

  const payload = buildModifyPayload(current, employeeNo, {
    enable: true,
    beginTime,
    endTime,
    timeType: current.Valid?.timeType || "local",
  });
  // Applied = validity window extends into the future again.
  await modifyAndVerify(device, employeeNo, payload, (valid) => {
    return new Date(valid.endTime) > new Date();
  });
  return { current };
}

module.exports = { blockUser, unblockUser, searchUser, toLocalIso };
