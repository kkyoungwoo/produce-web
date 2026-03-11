import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = ".";
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".css"]);
const IGNORED_DIRS = new Set([".git", ".next", "node_modules", "out", ".firebase"]);

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

function stripBom(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3);
  }
  return buffer;
}

let changed = 0;
let scanned = 0;

for (const filePath of walk(ROOT)) {
  scanned += 1;

  const original = readFileSync(filePath);
  const withoutBom = stripBom(original);
  const text = withoutBom.toString("utf8");
  const normalized = Buffer.from(text, "utf8");

  if (!original.equals(normalized)) {
    writeFileSync(filePath, normalized);
    changed += 1;
  }
}

console.log(`[encoding-normalize] scanned=${scanned} changed=${changed}`);