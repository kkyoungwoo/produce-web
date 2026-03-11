import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = ".";
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".css"]);
const IGNORED_DIRS = new Set([".git", ".next", "node_modules", "out", ".firebase"]);
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...walk(fullPath));
      }
      continue;
    }

    if (EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

const violations = [];

for (const file of walk(ROOT)) {
  const buffer = readFileSync(file);
  const text = buffer.toString("utf8");

  if (hasUtf8Bom(buffer)) {
    violations.push(`${file}: UTF-8 BOM detected`);
  }

  if (text.includes(REPLACEMENT_CHAR)) {
    violations.push(`${file}: replacement character detected`);
  }
}

if (violations.length > 0) {
  console.error("[encoding-check] Failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("[encoding-check] OK");