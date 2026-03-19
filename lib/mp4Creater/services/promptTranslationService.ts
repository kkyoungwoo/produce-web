import { CONFIG } from '../config';
import { runOpenRouterText } from './openRouterService';

const TRANSLATION_CACHE_KEY = 'mp4creater_prompt_translation_cache_v1';
const memoryCache = new Map<string, string>();

interface TranslationOptions {
  label?: string;
  preserveLineBreaks?: boolean;
  maxChars?: number;
}

function normalizePromptText(value: string): string {
  return `${value || ''}`.replace(/\r\n/g, '\n').trim();
}

function readPersistentCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TRANSLATION_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePersistentCache(cache: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(cache).slice(-120);
    window.localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

function getCachedTranslation(text: string): string | null {
  if (memoryCache.has(text)) return memoryCache.get(text) || null;
  const persistentCache = readPersistentCache();
  const saved = persistentCache[text];
  if (saved) {
    memoryCache.set(text, saved);
    return saved;
  }
  return null;
}

function setCachedTranslation(text: string, translated: string) {
  memoryCache.set(text, translated);
  const persistentCache = readPersistentCache();
  persistentCache[text] = translated;
  writePersistentCache(persistentCache);
}

function hasMeaningfulNonEnglishText(text: string): boolean {
  if (!text.trim()) return false;
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text)) return true;
  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) return true;
  return /[^\u0000-\u007F]/.test(text);
}

function buildTranslationInstruction(text: string, preserveLineBreaks: boolean) {
  return [
    'Translate the following generative-AI prompt into clear natural English.',
    'Keep the original meaning, specificity, and production intent.',
    'Do not summarize, do not censor, and do not add commentary.',
    preserveLineBreaks
      ? 'Preserve line breaks, list structure, labels, and section order.'
      : 'You may smooth wording, but keep all concrete details.',
    'Return only the translated English prompt.',
    '',
    text,
  ].join('\n');
}

async function translateWithOpenRouter(text: string, options: TranslationOptions): Promise<string | null> {
  const apiKey =
    (typeof window !== 'undefined' && window.localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY)) ||
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
    '';

  if (!apiKey) return null;

  const response = await runOpenRouterText({
    model: 'openrouter/auto',
    temperature: 0.1,
    maxTokens: 900,
    inputMaxChars: options.maxChars || 12000,
    messages: [
      {
        role: 'system',
        content: 'You translate prompts for image, video, and script generation systems into production-ready English.',
      },
      {
        role: 'user',
        content: buildTranslationInstruction(text, options.preserveLineBreaks !== false),
      },
    ],
  });

  return normalizePromptText(response);
}

export async function translatePromptToEnglish(input: string, options: TranslationOptions = {}): Promise<string> {
  const text = normalizePromptText(input);
  if (!text) return '';
  if (!hasMeaningfulNonEnglishText(text)) return text;

  const cached = getCachedTranslation(text);
  if (cached) return cached;

  try {
    const translated = (await translateWithOpenRouter(text, options)) || text;
    const finalText = normalizePromptText(translated) || text;
    setCachedTranslation(text, finalText);
    return finalText;
  } catch (error) {
    console.warn(`[Prompt Translation] ${options.label || 'prompt'} translation skipped:`, error);
    return text;
  }
}
