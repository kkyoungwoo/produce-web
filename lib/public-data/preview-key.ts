export const FALLBACK_PREVIEW_SERVICE_KEY =
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

/**
 * 사용자가 입력하는 별칭 -> 실제 적용할 등록 키
 * 왼쪽은 사용자가 입력할 값
 * 오른쪽은 실제 적용할 키
 */
export const PREVIEW_SERVICE_KEY_MAP: Record<string, string> = {
  vip: FALLBACK_PREVIEW_SERVICE_KEY,
};

export function normalizePreviewKey(value?: string) {
  return String(value ?? "").trim().toLowerCase();
}

export function resolvePreviewServiceKey(inputKey?: string) {
  const normalizedInput = normalizePreviewKey(inputKey);

  if (!normalizedInput) {
    return FALLBACK_PREVIEW_SERVICE_KEY;
  }

  const mappedKey = PREVIEW_SERVICE_KEY_MAP[normalizedInput];
  if (mappedKey) {
    return mappedKey.trim();
  }

  if (inputKey?.trim() === FALLBACK_PREVIEW_SERVICE_KEY) {
    return FALLBACK_PREVIEW_SERVICE_KEY;
  }

  return FALLBACK_PREVIEW_SERVICE_KEY;
}

export function getPreviewServiceKey(primaryKey?: string) {
  return resolvePreviewServiceKey(primaryKey);
}

export function getPreviewServiceKeys(primaryKey?: string) {
  const resolvedKey = resolvePreviewServiceKey(primaryKey);

  return Array.from(
    new Set([resolvedKey, FALLBACK_PREVIEW_SERVICE_KEY].filter(Boolean))
  );
}
