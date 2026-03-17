import { CONFIG } from '../config';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  responseFormat?: { type: 'json_object' } | undefined;
}

export async function runOpenRouterText(request: OpenRouterRequest): Promise<string> {
  const apiKey =
    localStorage.getItem(CONFIG.STORAGE_KEYS.OPENROUTER_API_KEY) ||
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
    '';

  if (!apiKey) {
    throw new Error('OpenRouter API 키가 설정되지 않았습니다.');
  }

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
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      ...(request.responseFormat ? { response_format: request.responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter 요청 실패: ${response.status}`);
  }

  const json = await response.json();
  return json?.choices?.[0]?.message?.content ?? '';
}
