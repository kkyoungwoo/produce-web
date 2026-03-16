import "server-only";

/**
 * 키를 입력하지 않았거나 잘못 입력했을 때 사용할 샘플 조회용 기본 키
 */
const DEFAULT_PREVIEW_SERVICE_KEY =
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

/**
 * 전체조회용 사용자 alias -> 실제 비밀키
 * 여기서 추가/삭제 관리하면 됩니다.
 */
const FULL_ACCESS_SERVICE_KEY_MAP = new Map<string, string>([
  ["vip", "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b"],
  ["beta", "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b"],
  ["gold", "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b"],
  ["master", "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b"],
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

export function resolveFullAccessServiceKey(inputKey?: string | null) {
  const rawInput = String(inputKey ?? "").trim();
  const normalizedInput = normalizePreviewKey(inputKey);

  if (!normalizedInput) {
    return "";
  }

  const mappedKey = FULL_ACCESS_SERVICE_KEY_MAP.get(normalizedInput);
  if (mappedKey) {
    return mappedKey;
  }

  return rawInput;
}

export function getPreviewServiceKey() {
  return DEFAULT_PREVIEW_SERVICE_KEY;
}

export function getPreviewServiceKeys() {
  return uniqueStrings([DEFAULT_PREVIEW_SERVICE_KEY]);
}

export function getAllPreviewServiceKeys() {
  return uniqueStrings([DEFAULT_PREVIEW_SERVICE_KEY]);
}

export function hasPreviewServiceKey() {
  return getAllPreviewServiceKeys().length > 0;
}

export function getFullAccessAliases() {
  return Array.from(FULL_ACCESS_SERVICE_KEY_MAP.keys());
}

export function getPreviewKeyDebug() {
  const previewKeys = getAllPreviewServiceKeys();
  const fullAccessKeys = uniqueStrings(Array.from(FULL_ACCESS_SERVICE_KEY_MAP.values()));

  return {
    defaultKeyExists: Boolean(DEFAULT_PREVIEW_SERVICE_KEY),
    fullAccessAliasCount: FULL_ACCESS_SERVICE_KEY_MAP.size,
    previewKeyCount: previewKeys.length,
    fullAccessKeyCount: fullAccessKeys.length,
    aliases: getFullAccessAliases(),
    maskedPreviewKeys: previewKeys.map((key) =>
      key.length <= 8 ? "********" : `${key.slice(0, 4)}...${key.slice(-4)}`,
    ),
    maskedFullAccessKeys: fullAccessKeys.map((key) =>
      key.length <= 8 ? "********" : `${key.slice(0, 4)}...${key.slice(-4)}`,
    ),
  };
}
