export const FALLBACK_PREVIEW_SERVICE_KEY = "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

export function getPreviewServiceKeys(primaryKey?: string) {
  const keys = [primaryKey?.trim() ?? "", FALLBACK_PREVIEW_SERVICE_KEY]
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(keys));
}