import "server-only";

/**
 * env 없이 파일 내부에서 직접 관리하는 미리보기 키 설정
 */
const DEFAULT_PREVIEW_SERVICE_KEY =
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

const PREVIEW_SERVICE_KEY_MAP = new Map<string, string>([
  ["vip", "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b"],
  ["beta", "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b"],
]);

function normalizePreviewKey(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)),
  );
}

export { normalizePreviewKey };

export function resolvePreviewServiceKey(inputKey?: string | null) {
  const rawInput = String(inputKey ?? "").trim();
  const normalizedInput = normalizePreviewKey(inputKey);

  if (!normalizedInput) {
    return DEFAULT_PREVIEW_SERVICE_KEY;
  }

  const mappedKey = PREVIEW_SERVICE_KEY_MAP.get(normalizedInput);
  if (mappedKey) {
    return mappedKey;
  }

  return rawInput;
}

export function getPreviewServiceKey(inputKey?: string | null) {
  return resolvePreviewServiceKey(inputKey);
}

export function getPreviewServiceKeys(inputKey?: string | null) {
  const resolvedKey = resolvePreviewServiceKey(inputKey);

  return uniqueStrings([
    resolvedKey,
    DEFAULT_PREVIEW_SERVICE_KEY,
    ...Array.from(PREVIEW_SERVICE_KEY_MAP.values()),
  ]);
}

export function getAllPreviewServiceKeys() {
  return uniqueStrings([
    DEFAULT_PREVIEW_SERVICE_KEY,
    ...Array.from(PREVIEW_SERVICE_KEY_MAP.values()),
  ]);
}

export function hasPreviewServiceKey() {
  return getAllPreviewServiceKeys().length > 0;
}

export function getPreviewAliases() {
  return Array.from(PREVIEW_SERVICE_KEY_MAP.keys());
}

export function getPreviewKeyDebug() {
  const allKeys = getAllPreviewServiceKeys();

  return {
    defaultKeyExists: Boolean(DEFAULT_PREVIEW_SERVICE_KEY),
    aliasCount: PREVIEW_SERVICE_KEY_MAP.size,
    totalPreviewKeys: allKeys.length,
    maskedKeys: allKeys.map((key) =>
      key.length <= 8 ? "********" : `${key.slice(0, 4)}...${key.slice(-4)}`,
    ),
  };
}
