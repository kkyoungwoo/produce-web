#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const publicRoot = path.join(repoRoot, 'public', 'mp4Creater', 'samples');
const outputPath = path.join(publicRoot, 'manifest.generated.json');

const CATEGORY_ORDER = ['characters', 'styles', 'images', 'videos', 'audio', 'thumbnails'];
const KIND_BY_EXT = {
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.svg': 'image',
  '.mp4': 'video',
  '.webm': 'video',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.m4a': 'audio',
};

function toLabel(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readFiles(category) {
  const dir = path.join(publicRoot, category);
  if (!(await exists(dir))) return [];

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith('.')) continue;

    const ext = path.extname(entry.name).toLowerCase();
    const kind = KIND_BY_EXT[ext] || 'unknown';
    const id = entry.name.replace(/\.[^.]+$/, '');
    const relativePath = `/mp4Creater/samples/${category}/${entry.name}`;

    files.push({
      id,
      label: toLabel(entry.name),
      path: relativePath,
      kind,
      filename: entry.name,
      ext,
      tags: [category, ...id.split(/[-_]/g).filter(Boolean)],
    });
  }

  return files.sort((a, b) => a.filename.localeCompare(b.filename));
}

async function main() {
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    root: '/mp4Creater/samples',
    categories: {},
    summary: {
      total: 0,
      characters: 0,
      styles: 0,
      images: 0,
      videos: 0,
      audio: 0,
      thumbnails: 0,
    },
  };

  for (const category of CATEGORY_ORDER) {
    const items = await readFiles(category);
    manifest.categories[category] = items;
    manifest.summary[category] = items.length;
    manifest.summary.total += items.length;
  }

  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log('[mp4-samples] manifest generated');
  console.log(`- output: ${path.relative(repoRoot, outputPath)}`);
  console.log(`- total files: ${manifest.summary.total}`);
  for (const category of CATEGORY_ORDER) {
    console.log(`  - ${category}: ${manifest.summary[category]}`);
  }
}

main().catch((error) => {
  console.error('[mp4-samples] failed to generate manifest');
  console.error(error);
  process.exit(1);
});
