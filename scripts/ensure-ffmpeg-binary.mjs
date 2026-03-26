import { chmod, copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

async function resolveSourceBinary() {
  const sourcePath = require('ffmpeg-static');
  if (!sourcePath) {
    throw new Error('ffmpeg-static did not return a binary path.');
  }
  const sourceStat = await stat(sourcePath).catch(() => null);
  if (!sourceStat?.isFile()) {
    throw new Error(`ffmpeg-static binary was not found at ${sourcePath}`);
  }
  return {
    sourcePath,
    sourceStat,
  };
}

async function main() {
  const { sourcePath, sourceStat } = await resolveSourceBinary();
  const targetDir = path.join(projectRoot, 'ffmpeg', 'bin');
  const targetPath = path.join(targetDir, path.basename(sourcePath));

  await mkdir(targetDir, { recursive: true });

  const targetStat = await stat(targetPath).catch(() => null);
  const shouldCopy = !targetStat || targetStat.size !== sourceStat.size;

  if (shouldCopy) {
    await copyFile(sourcePath, targetPath);
  }

  if (process.platform !== 'win32') {
    await chmod(targetPath, 0o755).catch(() => undefined);
  }

  console.log(`[ensure-ffmpeg] ready: ${targetPath}`);
}

main().catch((error) => {
  console.error('[ensure-ffmpeg] failed', error);
  process.exitCode = 1;
});
