import "server-only";

const DEFAULT_PREVIEW_SERVICE_KEY =
  process.env.PREVIEW_DEFAULT_SERVICE_KEY?.trim() || "";

function normalizePreviewKey(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function parsePreviewAliasMap(): Map<string, string> {
  const raw = process.env.PREVIEW_SERVICE_KEY_MAP?.trim();

  if (!raw) {
    return new Map<string, string>();
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const entries = Object.entries(parsed)
      .map(([alias, key]): [string, string] => [
        normalizePreviewKey(alias),
        String(key ?? "").trim(),
      ])
      .filter(
        (entry): entry is [string, string] =>
          Boolean(entry[0]) && Boolean(entry[1]),
      );

    return new Map<string, string>(entries);
  } catch {
    return new Map<string, string>();
  }
}

const PREVIEW_SERVICE_KEY_MAP = parsePreviewAliasMap();

export { normalizePreviewKey };

export function resolvePreviewServiceKey(inputKey?: string | null) {
  const normalizedInput = normalizePreviewKey(inputKey);

  if (!normalizedInput) {
    return DEFAULT_PREVIEW_SERVICE_KEY;
  }

  const mappedKey = PREVIEW_SERVICE_KEY_MAP.get(normalizedInput);
  if (mappedKey) {
    return mappedKey;
  }

  if (inputKey?.trim() === DEFAULT_PREVIEW_SERVICE_KEY) {
    return DEFAULT_PREVIEW_SERVICE_KEY;
  }

  return DEFAULT_PREVIEW_SERVICE_KEY;
}

export function getPreviewServiceKey(inputKey?: string | null) {
  return resolvePreviewServiceKey(inputKey);
}

export function getPreviewServiceKeys(inputKey?: string | null) {
  const resolvedKey = resolvePreviewServiceKey(inputKey);

  return Array.from(
    new Set(
      [resolvedKey, DEFAULT_PREVIEW_SERVICE_KEY].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
}

export function hasPreviewServiceKey() {
  return Boolean(DEFAULT_PREVIEW_SERVICE_KEY);
}

export function getPreviewAliases() {
  return Array.from(PREVIEW_SERVICE_KEY_MAP.keys());
}
