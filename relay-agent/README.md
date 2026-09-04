# FitPulse Device Relay Agent

Small always-on Node.js service that runs **on the gym's local network**
(same LAN as the Hikvision DS-K1T343MFX terminal). It executes member
block/unblock commands queued from the FitPulse web app.

## Why this exists

The terminal's ISAPI interface is only reachable on the local network.
Cloud Functions run on GCP and **cannot** reach a gym's private
`192.168.x.x` IP. So:

1. The React app writes a command to `gyms/{gymId}/deviceCommands`
   with `status: "pending"` — it never talks to the device directly.
2. This relay (listening via `firebase-admin`) picks up the command and
   makes the actual ISAPI call with HTTP Digest Auth.
3. It updates the member document and marks the command
   `completed` or `failed`; the app reflects the result in real time.

## How block/unblock works on the device

It is **one call**, and the validity window is the entire mechanism:

```
PUT http://<device-ip>/ISAPI/AccessControl/UserInfo/Modify?format=json
```

(HTTP Digest auth with the device admin user; body is the payload verified
in Postman, with only `Valid` changing.)

- **Block** → `beginTime: 2020-01-01T00:00:00`, `endTime: yesterday 23:59:59`.
  The window has elapsed, so the device refuses the user at the door on its
  own. Face/fingerprint enrollment is untouched.
- **Unblock** → `beginTime: today 00:00:00`, `endTime: today + 10 years`.
- `Valid.enable` is always `true`. `enable: false` means "long-term user,
  ignore the validity period" — the **opposite** of blocking.
- Door rights are **not** touched: the same static `doorRight` / `RightPlan`
  from the verified payload is sent every time. Nothing else about the user
  is read or rewritten.
- `UserInfo/Modify` is sent as `PUT` (what the Postman test uses), falling
  back to `POST` once if the firmware answers `methodNotAllowed`.
- `UserInfo/Search` is only used to read a member's name when the app has
  none, and by `test-device.js --action status`.

## Setup (per gym)

Requirements: Node.js 18+, on a machine that stays powered on and on the
same WiFi/LAN as the terminal (a Raspberry Pi, the front-desk PC, etc.).

1. Copy this `relay-agent/` folder to that machine.

2. Create a **service account key**:
   Firebase Console → Project settings (`gymnex-65440`) → Service accounts
   → *Generate new private key*. Save it as `service-account.json` in this
   folder. **Never commit this file.**

3. Configure:

   ```bash
   cp .env.example .env
   # edit .env — set GYM_ID to this gym's Firestore document ID
   ```

   Device IPs come from the app's Devices page (`gyms/{gymId}/devices`).
   Admin credentials are resolved in priority order:

   1. `gyms/{gymId}/deviceConfig/{deviceId}` — fields `adminUsername` /
      `adminPassword` (+ optional `ip`, `port`). **Preferred**: Firestore
      rules deny all client access to this subcollection, so passwords are
      only readable by this relay (Admin SDK bypasses rules). Create these
      docs from the Firebase Console or a script — not from the app.
   2. `username` / `password` fields on the device doc itself (legacy —
      note these docs are client-readable, avoid storing passwords there).
   3. `DEVICE_USERNAME` / `DEVICE_PASSWORD` from `.env`.

4. Install and test in the foreground:

   ```bash
   npm install
   npm start
   # you should see: "Relay agent starting for gym <GYM_ID>"
   # then block a member from the app and watch the log lines
   ```

## Running persistently

### Option A — pm2 (simplest)

```bash
npm install -g pm2
pm2 start index.js --name fitpulse-relay
pm2 save
pm2 startup   # follow the printed instructions so it survives reboots
pm2 logs fitpulse-relay
```

### Option B — systemd (Linux / Raspberry Pi)

Create `/etc/systemd/system/fitpulse-relay.service`:

```ini
[Unit]
Description=FitPulse Hikvision relay agent
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/fitpulse/relay-agent
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fitpulse-relay
journalctl -u fitpulse-relay -f
```

## Offline test (no hardware)

```bash
npm test
```

Runs the block/unblock logic against a mock terminal that enforces the two
firmware rules that broke this in the field: a Modify body containing any
field outside the accepted set is silently ignored (while answering
`200 OK`), and `beginTime` must be earlier than `endTime`. Guards against
reintroducing either bug.

## Testing directly against the device (no app / Firestore)

`test-device.js` runs the relay's exact ISAPI code against the terminal,
so results are directly comparable with Postman:

```bash
# See a user's current validity window
node test-device.js --ip 192.168.8.126 --user admin --pass 'SECRET' \
  --employee PGNA117X --action status

# Block / unblock (each reads the window back from the device afterwards)
node test-device.js --ip 192.168.8.126 --user admin --pass 'SECRET' \
  --employee PGNA117X --action block
node test-device.js --ip 192.168.8.126 --user admin --pass 'SECRET' \
  --employee PGNA117X --action unblock
```

It prints the full Modify request body, the device's response, and the
resulting validity window.

## Debugging in the field

- Everything is logged to `relay-agent.log` (path configurable via
  `LOG_FILE`) as well as stdout.
- Command failures are also written to the command doc's `errorMessage`
  field, visible in the app.
- Common failures:
  - `timed out` → device IP wrong or relay not on the same LAN.
  - `Digest authentication failed` → wrong device admin credentials.
  - `employeeNo ... not found` → member's `memberCode` doesn't match any
    user on the terminal (not enrolled, or enrolled under another number).
  - `matches N users` → duplicate employeeNo on the device; clean up the
    duplicate on the terminal itself before retrying.
- A command stuck in `pending` in the app means this relay isn't running
  or can't reach Firestore — check the service and internet connection.
