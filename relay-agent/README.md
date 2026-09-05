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

### Option A — Windows service (recommended on Windows)

A terminal window running `npm start` dies when the window is closed, the
staff member logs out, or Windows reboots after an update — and door
blocking silently stops until someone notices. A service starts **before
anyone logs in**, restarts itself if it crashes, and survives reboots.

```powershell
winget install NSSM.NSSM          # once

# then, from an ADMINISTRATOR PowerShell, in this folder:
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install-service.ps1
```

The script refuses to install until `.env`, `service-account.json` and
`node_modules` are all present, so a broken setup fails at install time
rather than silently at 2am. To remove it: `.\install-service.ps1
-Uninstall`.

Day to day:

```powershell
nssm restart FitPulseRelay   # after every git pull
nssm stop FitPulseRelay
Get-Service FitPulseRelay
```

Logs stay in `relay-agent.log` (plus `service-out.log` / `service-err.log`
for anything the service itself reports).

**Stop the PC sleeping**, or the relay sleeps with it:

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

Set the machine to log back in automatically after a power cut, and leave
it on the gym's WiFi with a DHCP reservation for the terminal's IP.

### Option B — pm2 (cross-platform, needs a logged-in user)

```bash
npm install -g pm2
pm2 start index.js --name fitpulse-relay
pm2 save
pm2 startup   # follow the printed instructions so it survives reboots
pm2 logs fitpulse-relay
```

On Windows `pm2 startup` is unsupported — use `npm install -g
pm2-windows-startup && pm2-startup install`, or prefer Option A, which
does not depend on a user staying logged in.

### Option C — systemd (Linux / Raspberry Pi)

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

## Nothing happens when I click Block ("Door: syncing…")

That means the command reached Firestore and **no relay consumed it** — no
ISAPI call was ever made. Run the diagnostics on the gym machine:

```bash
npm run doctor
# or, to also check one member on the device:
npm run doctor -- --employee PGNA117X
```

It walks the whole chain — `.env` → Firebase credentials → the gym document
→ devices and their credentials → TCP reachability → ISAPI digest auth →
the member's record on the device → commands stuck in the queue → whether a
relay is heartbeating — and prints the fix for whatever fails. It writes
nothing to the device.

The usual causes, in order of how often they bite:

1. **The relay isn't running.** Start it (`npm start`). Any commands already
   queued are picked up immediately — a stuck "syncing…" resolves on its own
   within a second or two.
2. **`GYM_ID` doesn't match the gym you clicked in.** Commands queue under a
   gym nobody is watching. The relay now refuses to start on an unknown
   `GYM_ID`, and `doctor` names the mismatch.
3. **The machine isn't on the terminal's LAN**, or the device IP changed
   (give the terminal a DHCP reservation).
4. **No device credentials**, so the relay skips the device. Set
   `adminUsername` / `adminPassword` on `gyms/{gymId}/deviceConfig/{deviceId}`.
5. **`memberCode` ≠ the `employeeNo` enrolled on the device.** The relay
   fails loudly with `employeeNo … not found`.

While the relay runs it writes a heartbeat to
`gyms/{gymId}/relayStatus/agent` every 30s. The app's Block Access tab reads
it and shows "Gym relay agent is offline" instead of waiting forever, and a
command with no response after 60s is marked failed rather than left
spinning.

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
