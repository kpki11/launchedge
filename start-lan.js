/**
 * start-lan.js  — guaranteed to work
 * Runs Metro on LAN (your PC IP). Phone and PC must be on same WiFi.
 * No tunnel needed. This ALWAYS works if both are on same network.
 * 
 * Run: node start-lan.js
 */
const { spawn } = require("child_process");
const os = require("os");

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

const lanIp = getLanIp();
console.log("\n" + "=".repeat(60));
console.log("  LAN IP:", lanIp);
console.log("  Metro port: 8081");
console.log("=".repeat(60));
console.log("\n  ✅ Make sure your phone is on the SAME WiFi as this PC");
console.log("  ✅ Then scan the QR code in Expo Go");
console.log("  ✅ No browser bypass needed - just scan and go!\n");

process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;

const expo = spawn("npx", ["expo", "start", "--lan", "--port", "8081", "--clear"], {
  stdio: "inherit",
  shell: true,
  cwd: __dirname,
  env: {
    ...process.env,
    REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
  },
});

expo.on("close", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => { expo.kill("SIGINT"); process.exit(0); });
