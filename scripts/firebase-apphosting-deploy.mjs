import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const projectId = process.env.FIREBASE_PROJECT_ID || "gorhrod-codex";
const backendId = process.env.FIREBASE_APPHOSTING_BACKEND_ID;

if (!backendId) {
  console.error("Missing FIREBASE_APPHOSTING_BACKEND_ID. Set it before running Firebase deploy.");
  process.exit(1);
}

const tempDir = mkdtempSync(path.join(tmpdir(), "produce-web-firebase-"));
const configPath = path.join(tempDir, "firebase.apphosting.json");

const config = {
  apphosting: [
    {
      backendId,
      rootDir: ".",
      ignore: [
        "firebase.json",
        "**/.*",
        "**/node_modules/**",
      ],
    },
  ],
};

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

const firebaseArgs = [
  "firebase-tools",
  "deploy",
  "--config",
  configPath,
  "--only",
  `apphosting:${backendId}`,
  "--project",
  projectId,
  ...process.argv.slice(2),
];

const result = spawnSync("npx", firebaseArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

rmSync(tempDir, { recursive: true, force: true });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
