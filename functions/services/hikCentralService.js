/**
 * HikCentral / Hikvision OpenAPI client.
 *
 * Implements AK/SK (HMAC-SHA256) request signing as used by Hikvision's
 * Artemis-style OpenAPI. Every request is signed with the partner AppKey
 * and AppSecret, plus a timestamp and a per-request nonce.
 *
 * Credentials are read from environment variables / Firebase functions
 * config:
 *   HIKCENTRAL_HOST     e.g. https://192.0.0.64
 *   HIKCENTRAL_APP_KEY  e.g. 54001767
 *   HIKCENTRAL_APP_SECRET
 */
import crypto from "node:crypto";
import https from "node:https";

const HOST = (process.env.HIKCENTRAL_HOST || "").replace(/\/$/, "");
const APP_KEY = process.env.HIKCENTRAL_APP_KEY || "";
const APP_SECRET = process.env.HIKCENTRAL_APP_SECRET || "";

// Test devices use self-signed certs.
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

function assertConfigured() {
  if (!HOST || !APP_KEY || !APP_SECRET) {
    throw new Error(
      "HikCentral not configured. Set HIKCENTRAL_HOST, HIKCENTRAL_APP_KEY, HIKCENTRAL_APP_SECRET.",
    );
  }
}

/**
 * Build the Artemis signing string and HMAC-SHA256 signature.
 *
 * stringToSign =
 *   METHOD\n
 *   Accept\n
 *   Content-MD5\n
 *   Content-Type\n
 *   Date\n
 *   <signed headers, sorted, joined by \n>\n
 *   <path + sorted query string>
 */
function sign({ method, path, headers, signedHeaderKeys }) {
  const sortedHeaders = signedHeaderKeys
    .slice()
    .sort()
    .map((k) => `${k.toLowerCase()}:${headers[k]}`)
    .join("\n");

  const stringToSign = [
    method.toUpperCase(),
    headers["Accept"] || "",
    headers["Content-MD5"] || "",
    headers["Content-Type"] || "",
    headers["Date"] || "",
    sortedHeaders,
    path,
  ].join("\n");

  return crypto
    .createHmac("sha256", APP_SECRET)
    .update(stringToSign, "utf8")
    .digest("base64");
}

/**
 * Make a signed POST request to a HikCentral OpenAPI endpoint.
 */
export async function callApi(path, body = {}) {
  assertConfigured();

  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const payload = JSON.stringify(body);

  const baseHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Ca-Key": APP_KEY,
    "X-Ca-Timestamp": timestamp,
    "X-Ca-Nonce": nonce,
  };

  const signedHeaderKeys = ["X-Ca-Key", "X-Ca-Nonce", "X-Ca-Timestamp"];

  const signature = sign({
    method: "POST",
    path,
    headers: baseHeaders,
    signedHeaderKeys,
  });

  const headers = {
    ...baseHeaders,
    "X-Ca-Signature": signature,
    "X-Ca-Signature-Headers": signedHeaderKeys
      .map((k) => k.toLowerCase())
      .join(","),
  };

  const url = `${HOST}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: payload,
    // Node 20 fetch uses undici; pass agent via dispatcher only if needed.
    // For self-signed certs in dev, set NODE_TLS_REJECT_UNAUTHORIZED=0 in env.
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(`HikCentral ${path} HTTP ${res.status}: ${text}`);
  }
  // Hikvision returns { code: "0", msg: "success", data: ... } on success.
  if (data && data.code && data.code !== "0" && data.code !== 0) {
    throw new Error(`HikCentral ${path} error ${data.code}: ${data.msg}`);
  }
  return data;
}

// ─── Person (Member) Management ──────────────────────────────────────────

/**
 * Add a person (member). Optionally include face / fingerprint / card credentials.
 * person fields:
 *   personCode, personFamilyName, personGivenName, gender, orgIndexCode,
 *   phoneNo, email, jobNo, birthday ("YYYY-MM-DD"),
 *   beginTime, endTime (ISO8601 validity window — set endTime to past to block),
 *   faces: [{ faceData: <base64 JPEG> }],
 *   fingerPrint: [{ fingerPrintData, fingerPrintType }],
 *   cards: [{ cardNo }]
 */
export function addPerson(person) {
  return callApi("/artemis/api/resource/v1/person/single/add", person);
}

export function updatePerson(updates) {
  // updates MUST include personId
  return callApi("/artemis/api/resource/v1/person/single/update", updates);
}

export function searchPersons({
  pageNo = 1,
  pageSize = 100,
  personName,
  personCode,
  orgIndexCodes,
} = {}) {
  return callApi("/artemis/api/resource/v1/person/advance/personList", {
    pageNo, pageSize, personName, personCode, orgIndexCodes,
  });
}

export function deletePersons(personIds) {
  return callApi("/artemis/api/resource/v1/person/batch/delete", {
    personIds: personIds.map((id) => ({ personId: id })),
  });
}

// ─── Face Credentials ────────────────────────────────────────────────────

export function addFace({ personId, faceData }) {
  return callApi("/artemis/api/resource/v1/face/single/add", { personId, faceData });
}

export function deleteFaces(faceIds) {
  return callApi("/artemis/api/resource/v1/face/batch/delete", {
    faceIds: faceIds.map((id) => ({ faceId: id })),
  });
}

// ─── Attendance ──────────────────────────────────────────────────────────

/**
 * Processed daily attendance report (late/absent/work duration).
 */
export function getAttendanceReport({
  startTime,
  endTime,
  personIndexCodes,
  pageNo = 1,
  pageSize = 100,
} = {}) {
  return callApi("/artemis/api/attendance/v1/report", {
    startTime, endTime, personIndexCodes, pageNo, pageSize,
  });
}

/**
 * Raw door events — every card / face / fingerprint swipe.
 */
export function getDoorEvents({
  startTime,
  endTime,
  doorIndexCodes,
  personName,
  cardNo,
  eventType,
  pageNo = 1,
  pageSize = 100,
} = {}) {
  return callApi("/artemis/api/acs/v1/door/events", {
    startTime, endTime, doorIndexCodes, personName, cardNo, eventType, pageNo, pageSize,
  });
}

/**
 * Kept for backwards compatibility with existing callers.
 */
export function getAccessRecords(params) {
  return getDoorEvents(params);
}

// ─── Temporary Blocking (suspend without delete) ─────────────────────────

/**
 * Remove a person from a privilege group (revokes door access for that group).
 */
export function revokePrivilege({ privilegeGroupId, personIds }) {
  return callApi("/artemis/api/acs/v1/privilege/group/single/deletePersons", {
    privilegeGroupId,
    list: personIds.map((id) => ({ personId: id })),
  });
}

/**
 * Block by expiring validity: set endTime to now (or any past date).
 * Caller must invoke reapplyPrivileges() after this for the device to enforce it.
 */
export function blockPersonByValidity(personId, endTime = new Date().toISOString()) {
  return updatePerson({ personId, endTime });
}

/**
 * Unblock: extend validity into the future.
 */
export function unblockPerson(personId, endTime) {
  return updatePerson({ personId, endTime });
}

/**
 * Push privilege / validity changes from HikCentral to the physical devices.
 * MUST be called after revokePrivilege / blockPersonByValidity / unblockPerson.
 */
export function reapplyPrivileges() {
  return callApi("/artemis/api/visitor/v1/auth/reapplication", {});
}
