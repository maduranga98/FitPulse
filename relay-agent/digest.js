// Minimal HTTP Digest Auth client for Hikvision ISAPI (MD5 / qop=auth).
// Implemented on Node's http module directly — Hikvision's digest
// implementation is picky and this keeps the handshake fully under our
// control (no external auth dependency to debug in the field).

const http = require("http");
const crypto = require("crypto");

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

function parseDigestChallenge(header) {
  // header: 'Digest realm="...", nonce="...", qop="auth", opaque="..."'
  const params = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
  let m;
  while ((m = re.exec(header.replace(/^Digest\s+/i, "")))) {
    params[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  return params;
}

function buildAuthHeader({ username, password, method, uri, challenge, nc, cnonce }) {
  const { realm, nonce, qop, opaque, algorithm } = challenge;
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  let response;
  if (qop) {
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
  }
  let header =
    `Digest username="${username}", realm="${realm}", nonce="${nonce}", ` +
    `uri="${uri}", response="${response}"`;
  if (qop) header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (opaque) header += `, opaque="${opaque}"`;
  if (algorithm) header += `, algorithm=${algorithm}`;
  return header;
}

function rawRequest({ host, port, method, path, headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host, port, method, path, headers, timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`Request to ${host}:${port} timed out`));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Perform an HTTP request with Digest Auth against a device.
 * @returns {Promise<{status:number, body:string, json:object|null}>}
 */
async function digestRequest({ host, port = 80, method, path, username, password, jsonBody, timeoutMs = 10000 }) {
  const body = jsonBody ? JSON.stringify(jsonBody) : null;
  // Header set mirrors Postman's (which is verified working against the
  // real device) to keep the requests as identical as possible.
  const baseHeaders = {
    "Content-Type": "application/json",
    Accept: "*/*",
    Connection: "keep-alive",
    ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
  };

  // First request — expect 401 with a Digest challenge.
  let res = await rawRequest({ host, port, method, path, headers: baseHeaders, body, timeoutMs });

  if (res.status === 401) {
    const wwwAuth = res.headers["www-authenticate"];
    if (!wwwAuth || !/digest/i.test(wwwAuth)) {
      throw new Error(`Device returned 401 without a Digest challenge (got: ${wwwAuth || "none"})`);
    }
    const challenge = parseDigestChallenge(wwwAuth);
    const cnonce = crypto.randomBytes(8).toString("hex");
    const authHeader = buildAuthHeader({
      username,
      password,
      method,
      uri: path,
      challenge,
      nc: "00000001",
      cnonce,
    });
    res = await rawRequest({
      host,
      port,
      method,
      path,
      headers: { ...baseHeaders, Authorization: authHeader },
      body,
      timeoutMs,
    });
    if (res.status === 401) {
      throw new Error("Digest authentication failed — check the device admin username/password");
    }
  }

  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch {
    // non-JSON body (some errors come back as XML) — leave json null
  }
  return { status: res.status, body: res.body, json };
}

module.exports = { digestRequest, parseDigestChallenge, buildAuthHeader };
