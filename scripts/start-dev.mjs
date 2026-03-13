import { spawn } from "node:child_process";
import { access, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const basePort = Number.parseInt(process.env.PORT || "3000", 10);
const maxOffset = 10;
const lockPath = path.join(repoRoot, ".next", "dev", "lock");
const nextBin = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");

async function fileExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

async function isLikelyNextServer(port) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(`http://127.0.0.1:${port}`, { signal: controller.signal });
    clearTimeout(timer);

    const text = await response.text();
    return text.includes("_next/static") || text.includes("__next");
  } catch {
    return false;
  }
}

async function findRunningPort() {
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const port = basePort + offset;
    if (await isLikelyNextServer(port)) {
      return port;
    }
  }
  return null;
}

async function findFreePort() {
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const port = basePort + offset;
    if (await isPortFree(port)) {
      return port;
    }
  }
  return null;
}

const hasLock = await fileExists(lockPath);
const runningPort = await findRunningPort();

if (hasLock && runningPort !== null) {
  console.log(`[dev] 이미 실행 중입니다: http://localhost:${runningPort}`);
  process.exit(0);
}

if (hasLock) {
  try {
    await rm(lockPath);
    console.log("[dev] 이전 개발 서버의 잠금 파일을 정리했습니다.");
  } catch (error) {
    console.error("[dev] 잠금 파일 정리에 실패했습니다.", error);
    process.exit(1);
  }
}

const targetPort = await findFreePort();
if (targetPort === null) {
  console.error(`[dev] ${basePort}~${basePort + maxOffset} 포트에서 사용 가능한 포트를 찾지 못했습니다.`);
  process.exit(1);
}

if (targetPort !== basePort) {
  console.log(`[dev] ${basePort} 포트가 사용 중이라 http://localhost:${targetPort} 에서 실행합니다.`);
}

const child = spawn(process.execPath, [nextBin, "dev", "-p", String(targetPort)], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(targetPort),
  },
});

child.on("error", (error) => {
  console.error("[dev] Next 개발 서버를 시작하지 못했습니다.", error);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});