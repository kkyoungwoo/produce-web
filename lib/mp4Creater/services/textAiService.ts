import { CONFIG } from '../config';
import { runOpenRouterText } from './openRouterService';

export async function runTextAi(options: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  fallback: string;
}): Promise<{ text: string; source: 'ai' | 'sample' }> {
  const apiKey =
    (typeof window !== 'undefined' && localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY)) ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
    '';

  if (!apiKey) return { text: options.fallback, source: 'sample' };

  try {
    const text = await runOpenRouterText({
      model: options.model || CONFIG.DEFAULT_SCRIPT_MODEL,
      maxTokens: options.maxTokens || CONFIG.OPENROUTER_DEFAULT_MAX_TOKENS,
      temperature: options.temperature ?? 0.7,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
    });
    return { text: text?.trim() || options.fallback, source: 'ai' };
  } catch {
    return { text: options.fallback, source: 'sample' };
  }
}
