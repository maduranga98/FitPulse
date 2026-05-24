/**
 * HikCentral / Hikvision Artemis OpenAPI client.
 *
 * Implements AK/SK (HMAC-SHA256) request signing as used by Hikvision's
 * Artemis-style OpenAPI. Every request is signed with the partner AppKey
 * and AppSecret, plus a timestamp and a per-request nonce.
 *
 * Credentials are read from environment variables:
 *   HIKCENTRAL_HOST        e.g. https://136.116.31.22
 *   HIKCENTRAL_APP_KEY     e.g. 18560347
 *   HIKCENTRAL_APP_SECRET
 */
import crypto from "node:crypto";
import { Agent } from "undici";

const HOST = (process.env.HIKCENTRAL_HOST || "").replace(/\/$/, "");
const APP_KEY = process.env.HIKCENTRAL_APP_KEY || "";
const APP_SECRET = process.env.HIKCENTRAL_APP_SECRET || "";

// Test devices use self-signed certs.
const insecureDispatcher = new Agent({
  connect: { rejectUnauthorized: false },
});

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
 *   {timestamp}\n
 *   x-ca-key:{APP_KEY}\n
 *   x-ca-nonce:{nonce}\n
 *   x-ca-timestamp:{timestamp}\n
 *   {path}
 */
function buildSignature({ method, path, timestamp, nonce }) {
  const stringToSign = [
    method.toUpperCase(),
    "application/json",
    "",
    "application/json",
    timestamp,
    `x-ca-key:${APP_KEY}`,
    `x-ca-nonce:${nonce}`,
    `x-ca-timestamp:${timestamp}`,
    path,
  ].join("\n");

  return crypto
    .createHmac("sha256", APP_SECRET)
    .update(stringToSign, "utf8")
    .digest("base64");
}

/**
 * Make a signed request to a HikCentral OpenAPI endpoint.
 * Returns the inner `data` field of the Artemis response envelope.
 */
export async function callApi(path, body = {}, method = "POST") {
  assertConfigured();

  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();

  const signature = buildSignature({ method, path, timestamp, nonce });

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Ca-Key": APP_KEY,
    "X-Ca-Timestamp": timestamp,
    "X-Ca-Nonce": nonce,
    "X-Ca-Signature": signature,
    "X-Ca-Signature-Headers": "x-ca-key,x-ca-nonce,x-ca-timestamp",
  };

  const init = {
    method: method.toUpperCase(),
    headers,
    dispatcher: insecureDispatcher,
  };

  if (init.method !== "GET") {
    init.body = JSON.stringify(body);
  }

  const url = `${HOST}${path}`;
  const res = await fetch(url, init);

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`HikCentral ${path} HTTP ${res.status}: ${text}`);
  }

  // Hikvision returns { code: "0", msg: "success", data: ... } on success.
  if (parsed && String(parsed.code) !== "0") {
    throw new Error(
      `HikCentral ${path} error ${parsed.code}: ${parsed.msg || "unknown"}`,
    );
  }

  return parsed.data;
}

// ─── Endpoint wrappers ──────────────────────────────────────────────────

export function addPerson(person = {}) {
  const {
    personCode,
    personName,
    gender,
    phoneNo,
    email,
    orgIndexCode,
    beginTime,
    endTime,
  } = person;

  return callApi("/api/resource/v1/person", {
    personCode,
    personName,
    gender,
    phoneNo,
    email,
    orgIndexCode,
    beginTime,
    endTime,
    personType: 1,
  });
}

export function searchPersons({
  pageNo = 1,
  pageSize = 100,
  personName,
  personCode,
} = {}) {
  return callApi("/api/resource/v1/person/advance/search", {
    pageNo,
    pageSize,
    personName,
    personCode,
  });
}

export function updatePerson(personId, updates = {}) {
  return callApi(`/api/resource/v1/person/${personId}`, updates);
}

export function deletePersons(personIds = []) {
  return callApi("/api/resource/v1/person/batch/delete", {
    personIds: personIds.map((id) => ({ personId: id })),
  });
}

export function addFace({ personId, faceData } = {}) {
  const stripped = (faceData || "").replace(/^data:image\/[^;]+;base64,/, "");
  return callApi("/api/resource/v1/face", { personId, faceData: stripped });
}

export function deleteFaces(faceIds = []) {
  return callApi("/api/resource/v1/face/batch/delete", {
    faceIds: faceIds.map((id) => ({ faceId: id })),
  });
}

export function getAccessRecords({
  startTime,
  endTime,
  personName,
  doorIndexCodes,
  pageNo = 1,
  pageSize = 100,
} = {}) {
  return callApi("/api/acs/v1/door/access/record/search", {
    startTime,
    endTime,
    personName,
    doorIndexCodes,
    pageNo,
    pageSize,
  });
}

export function getDoors({ pageNo = 1, pageSize = 100 } = {}) {
  return callApi("/api/resource/v1/door/search", { pageNo, pageSize });
}

export function getDeviceList({ pageNo = 1, pageSize = 100 } = {}) {
  return callApi("/api/resource/v1/acsDevice/acsDeviceList", {
    pageNo,
    pageSize,
  });
}

export function viewSubscriptions() {
  return callApi("/api/eventService/v1/eventSubscriptionView", {});
}

export function controlDoor(doorIndexCode, controlType) {
  // controlType: 0=close, 1=open, 2=always open, 3=always close
  return callApi("/api/acs/v1/door/doControl", { doorIndexCode, controlType });
}

export function addPersonsToAccessGroup(personIds = [], acsGroupId) {
  return callApi("/api/acs/v1/acsDevice/person/privilege/set", {
    personIds,
    acsGroupId,
  });
}

export function subscribeEvents(callbackUrl, eventTypes = []) {
  return callApi("/api/eventService/v1/eventSubscriptionByEventTypes", {
    eventDest: callbackUrl,
    eventTypes,
  });
}

export function getApiInfo() {
  return callApi("/api/apiInfo", {}, "GET");
}
