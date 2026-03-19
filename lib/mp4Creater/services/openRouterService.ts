import { CONFIG } from '../config';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  inputMaxChars?: number;
  responseFormat?: { type: 'json_object' } | undefined;
}

function parsePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function resolveTokenLimits(request: OpenRouterRequest) {
  const defaultMaxTokens = CONFIG.OPENROUTER_DEFAULT_MAX_TOKENS;
  const defaultInputChars = CONFIG.OPENROUTER_DEFAULT_INPUT_MAX_CHARS;

  if (typeof window === 'undefined') {
    return {
      maxTokens: Math.min(1200, Math.max(200, parsePositiveNumber(request.maxTokens, defaultMaxTokens))),
      inputMaxChars: Math.min(20000, Math.max(1200, parsePositiveNumber(request.inputMaxChars, defaultInputChars))),
    };
  }

  const storedMaxTokens = window.localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_MAX_TOKENS);
  const storedInputChars = window.localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_INPUT_MAX_CHARS);
  const maxTokens = parsePositiveNumber(request.maxTokens ?? storedMaxTokens, defaultMaxTokens);
  const inputMaxChars = parsePositiveNumber(request.inputMaxChars ?? storedInputChars, defaultInputChars);

  return {
    maxTokens: Math.min(1200, Math.max(200, maxTokens)),
    inputMaxChars: Math.min(20000, Math.max(1200, inputMaxChars)),
  };
}

function trimMessagesByBudget(messages: OpenRouterMessage[], inputMaxChars: number): OpenRouterMessage[] {
  const reversed = [...messages].reverse();
  const kept: OpenRouterMessage[] = [];
  let remaining = inputMaxChars;

  for (const message of reversed) {
    const content = `${message.content || ""}`;
    if (!content.trim()) continue;

    const trimmed = content.length > remaining ? content.slice(content.length - remaining) : content;
    if (!trimmed.trim()) continue;

    kept.push({ ...message, content: trimmed });
    remaining -= trimmed.length;
    if (remaining <= 0) break;
  }

  return kept.reverse();
}

function buildOpenRouterError(status: number, text: string) {
  if (status === 401 || status === 403) {
    return 'The OpenRouter API key is invalid. Please enter it again.';
  }

  if (status === 402 || status === 429) {
    return 'The OpenRouter balance or request quota is not available. Recharge it or enter another key.';
  }

  return `OpenRouter request failed: ${status}${text ? ` - ${text.slice(0, 200)}` : ""}`;
}

export async function runOpenRouterText(request: OpenRouterRequest): Promise<string> {
  const apiKey =
    localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY) ||
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
    '';

  if (!apiKey) {
    throw new Error('The OpenRouter API key is not configured.');
  }

  const { maxTokens, inputMaxChars } = resolveTokenLimits(request);
  const messages = trimMessagesByBudget(request.messages, inputMaxChars);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      'X-Title': 'TubeGen Studio',
    },
    body: JSON.stringify({
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: maxTokens,
      ...(request.responseFormat ? { response_format: request.responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildOpenRouterError(response.status, text));
  }

  const json = await response.json();
  return json?.choices?.[0]?.message?.content ?? '';
}
