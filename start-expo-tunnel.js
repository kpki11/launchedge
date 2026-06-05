/**
 * start-expo-tunnel.js
 * Uses Expo built-in @expo/ngrok tunnel.
 * Works when phone and PC are on different WiFi/networks.
 * Run: node start-expo-tunnel.js
 */
const { spawn } = require("child_process");

console.log("\n============================================================");
console.log("  LaunchEdge Labs — Expo Tunnel Mode (@expo/ngrok)");
console.log("  Works on ANY network — phone does not need same WiFi");
console.log("============================================================");
console.log("\n  Scan the QR code in Expo Go once it appears.\n");

const expo = spawn(
  "npx",
  ["expo", "start", "--tunnel", "--clear"],
  {
    stdio: "inherit",
    shell: true,
    cwd: __dirname,
    env: { ...process.env },
  }
);

expo.on("close", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => { expo.kill("SIGINT"); process.exit(0); });
