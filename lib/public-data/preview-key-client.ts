export const FALLBACK_PREVIEW_SERVICE_KEY =
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

export const PREVIEW_SERVICE_KEY_MAP: Record<string, string> = {
  beta: FALLBACK_PREVIEW_SERVICE_KEY,
  gold: FALLBACK_PREVIEW_SERVICE_KEY,
  master: FALLBACK_PREVIEW_SERVICE_KEY,
};

export function normalizePreviewKey(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

export function resolvePreviewServiceKey(inputKey?: string | null) {
  const trimmed = String(inputKey ?? "").trim();

  if (!trimmed) {
    return FALLBACK_PREVIEW_SERVICE_KEY;
  }

  return PREVIEW_SERVICE_KEY_MAP[normalizePreviewKey(inputKey)] ?? trimmed;
}
