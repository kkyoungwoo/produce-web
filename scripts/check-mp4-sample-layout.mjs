#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const publicRoot = path.join(repoRoot, 'public', 'mp4Creater', 'samples');
const localRoot = path.join(repoRoot, 'local-data', 'tubegen-studio', 'sample-library');

const EXPECTED = {
  public: ['characters', 'styles', 'images', 'videos', 'audio', 'thumbnails'],
  local: ['characters', 'styles', 'images', 'videos', 'audio'],
};

const ALLOWED = {
  characters: new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']),
  styles: new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']),
  images: new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']),
  videos: new Set(['.mp4', '.webm']),
  audio: new Set(['.mp3', '.wav', '.ogg', '.m4a']),
  thumbnails: new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']),
};

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(baseDir, category) {
  const dir = path.join(baseDir, category);
  if (!(await exists(dir))) return { missing: true, files: [] };

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && !entry.name.startsWith('.')).map((entry) => entry.name);
  return { missing: false, files };
}

async function inspectRoot(label, baseDir, categories) {
  const warnings = [];
  const ids = new Map();

  for (const category of categories) {
    const { missing, files } = await listFiles(baseDir, category);
    if (missing) {
      warnings.push(`[${label}] missing directory: ${path.relative(repoRoot, path.join(baseDir, category))}`);
      continue;
    }

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const allowed = ALLOWED[category];
      if (allowed && !allowed.has(ext)) {
        warnings.push(`[${label}] invalid extension in ${category}: ${file}`);
      }

      const id = file.replace(/\.[^.]+$/, '');
      const key = `${category}:${id}`;
      if (ids.has(key)) {
        warnings.push(`[${label}] duplicate id in same category: ${id}`);
      } else {
        ids.set(key, file);
      }
    }
  }

  return warnings;
}

async function main() {
  const warnings = [
    ...(await inspectRoot('public', publicRoot, EXPECTED.public)),
    ...(await inspectRoot('local', localRoot, EXPECTED.local)),
  ];

  if (!warnings.length) {
    console.log('[mp4-samples] layout check passed');
    return;
  }

  console.log('[mp4-samples] layout check finished with warnings');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error('[mp4-samples] layout check failed');
  console.error(error);
  process.exit(1);
});
