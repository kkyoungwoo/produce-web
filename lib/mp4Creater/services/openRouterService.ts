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
    const content = `${message.content || ''}`;
    if (!content.trim()) continue;

    const trimmed = content.length > remaining ? content.slice(content.length - remaining) : content;
    if (!trimmed.trim()) continue;

    kept.push({ ...message, content: trimmed });
    remaining -= trimmed.length;
    if (remaining <= 0) break;
  }

  return kept.reverse();
}

function normalizeGoogleTextModel(model?: string | null) {
  const trimmed = `${model || ''}`.trim();
  if (!trimmed || trimmed === 'openrouter/auto') return CONFIG.DEFAULT_SCRIPT_MODEL;
  return trimmed;
}

function buildGeminiError(status: number, text: string) {
  if (status === 400) return 'Google AI Studio 요청 형식이 올바르지 않습니다. 모델이나 입력을 다시 확인해 주세요.';
  if (status === 401 || status === 403) return 'Google AI Studio API 키가 올바르지 않거나 접근 권한이 없습니다.';
  if (status === 402 || status === 429) return 'Google AI Studio 요청 한도 또는 결제 제한에 걸렸습니다. 무료/유료 사용량을 확인해 주세요.';
  return `Google AI Studio 요청이 실패했습니다: ${status}${text ? ` - ${text.slice(0, 200)}` : ''}`;
}

function extractTextFromGeminiResponse(json: any): string {
  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const joined = parts
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
    if (joined.trim()) return joined.trim();
  }
  return '';
}

export async function runOpenRouterText(request: OpenRouterRequest): Promise<string> {
  const apiKey =
    localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY) ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
    '';

  if (!apiKey) {
    throw new Error('The Google AI Studio API key is not configured.');
  }

  const { maxTokens, inputMaxChars } = resolveTokenLimits(request);
  const messages = trimMessagesByBudget(request.messages, inputMaxChars);
  const systemText = messages.filter((item) => item.role === 'system').map((item) => item.content.trim()).filter(Boolean).join('\n\n');
  const conversationMessages = messages.filter((item) => item.role !== 'system');
  const contents = conversationMessages.length
    ? conversationMessages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }))
    : [{ role: 'user', parts: [{ text: 'Respond to the latest instruction.' }] }];

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeGoogleTextModel(request.model))}:generateContent`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: maxTokens,
        ...(request.responseFormat ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildGeminiError(response.status, text));
  }

  const json = await response.json();
  return extractTextFromGeminiResponse(json);
}
