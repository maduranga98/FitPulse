// File + console logger for field debugging — the relay runs on-prem
// where remote log access is limited, so everything goes to a local file.

const fs = require("fs");
const path = require("path");

const LOG_FILE =
  process.env.LOG_FILE || path.join(__dirname, "relay-agent.log");

function write(level, msg) {
  const line = `${new Date().toISOString()} [${level}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // never let logging take the relay down
  }
}

module.exports = {
  info: (msg) => write("INFO", msg),
  warn: (msg) => write("WARN", msg),
  error: (msg) => write("ERROR", msg),
};
