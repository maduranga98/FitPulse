#!/usr/bin/env node
// Direct device test — runs the relay's ISAPI code against the terminal
// WITHOUT the app or Firestore, so results are directly comparable with
// Postman. Run this on a machine on the same LAN as the device.
//
// Usage:
//   node test-device.js --ip 192.168.8.126 --user admin --pass 'SECRET' \
//        --employee PGNA117X --action status
//
// Actions:
//   status   — Search the user and print their current UserInfo/Valid
//   block    — set an already-elapsed validity window (door stays shut)
//   unblock  — set a validity window 10 years into the future

const { blockUser, unblockUser, searchUser } = require("./isapi");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const device = {
  ip: arg("ip"),
  port: Number(arg("port", "80")),
  username: arg("user", "admin"),
  password: arg("pass"),
  name: "test",
};
const employeeNo = arg("employee");
const action = arg("action", "status");

if (!device.ip || !device.password || !employeeNo) {
  console.error(
    "Usage: node test-device.js --ip <device-ip> --user admin --pass '<password>' --employee <memberCode> --action status|block|unblock [--name <name>]"
  );
  process.exit(1);
}

(async () => {
  try {
    if (action === "status") {
      const info = await searchUser(device, employeeNo);
      console.log(JSON.stringify(info, null, 2));
      const expired = info.Valid?.endTime && new Date(info.Valid.endTime) < new Date();
      console.log(
        `\nValid: enable=${info.Valid?.enable} ${info.Valid?.beginTime} → ${info.Valid?.endTime}` +
          ` — ${expired ? "EXPIRED (blocked)" : "active"}`
      );
    } else if (action === "block") {
      const name = arg("name") || (await searchUser(device, employeeNo)).name;
      await blockUser(device, employeeNo, name);
      const after = await searchUser(device, employeeNo);
      console.log(`\nBLOCK VERIFIED — device Valid is now: ${JSON.stringify(after.Valid)}`);
    } else if (action === "unblock") {
      const name = arg("name") || (await searchUser(device, employeeNo)).name;
      await unblockUser(device, employeeNo, name);
      const after = await searchUser(device, employeeNo);
      console.log(`\nUNBLOCK VERIFIED — device Valid is now: ${JSON.stringify(after.Valid)}`);
    } else {
      console.error(`Unknown action: ${action}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`\nFAILED: ${err.message}`);
    process.exit(1);
  }
})();
