import { CONFIG } from '../config';

function readLegacyStoredGoogleKey() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY) || '';
}

export function resolveGoogleAiStudioApiKey(explicitKey?: string | null): string {
  const preferred = `${explicitKey || ''}`.trim();
  if (preferred) return preferred;

  if (typeof window === 'undefined') {
    return (
      process.env.NEXT_PUBLIC_GEMINI_API_KEY
      || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
      || process.env.GEMINI_API_KEY
      || ''
    ).trim();
  }

  return (
    process.env.NEXT_PUBLIC_GEMINI_API_KEY
    || readLegacyStoredGoogleKey()
    || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
    || ''
  ).trim();
}

export function hasGoogleAiStudioApiKey(explicitKey?: string | null) {
  return Boolean(resolveGoogleAiStudioApiKey(explicitKey));
}

