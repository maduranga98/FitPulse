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

// ─── 7 endpoint wrappers ────────────────────────────────────────────────

export function addPerson(person) {
  // person: { personCode, personFamilyName, personGivenName, gender, phoneNo, email, ... }
  return callApi("/api/resource/v1/person", person);
}

export function searchPersons({ pageNo = 1, pageSize = 100, personName, personCode } = {}) {
  return callApi("/api/resource/v1/person/advance/search", {
    pageNo, pageSize, personName, personCode,
  });
}

export function updatePerson(personId, updates) {
  return callApi(`/api/resource/v1/person/${personId}`, updates);
}

export function deletePersons(personIds) {
  // personIds: string[]
  return callApi("/api/resource/v1/person/batch/delete", {
    personIds: personIds.map((id) => ({ personId: id })),
  });
}

export function addFace({ personId, faceData }) {
  // faceData: base64-encoded JPEG of the face
  return callApi("/api/resource/v1/face", { personId, faceData });
}

export function deleteFaces(faceIds) {
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
    startTime, endTime, personName, doorIndexCodes, pageNo, pageSize,
  });
}
