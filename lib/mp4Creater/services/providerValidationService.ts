export type ProviderValidationKind = 'openRouter' | 'elevenLabs' | 'heygen' | 'fal';

export interface ProviderValidationResult {
  ok: boolean;
  tone: 'success' | 'error' | 'info';
  message: string;
}

const GOOGLE_VALIDATION_MODEL = 'gemini-2.5-flash-lite';
const ELEVENLABS_VALIDATION_MODEL = 'eleven_flash_v2_5';
const ELEVENLABS_VALIDATION_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

function buildFailureMessage(status: number, providerName: string, detail?: string) {
  if (status === 401 || status === 403) {
    return `${providerName} API 키가 유효하지 않거나 권한이 없습니다. 키 값을 다시 확인해 주세요.`;
  }

  if (status === 402 || status === 429) {
    return `${providerName} 요청 한도/요금 상태로 인해 검증에 실패했습니다. 사용량과 결제 상태를 확인해 주세요.`;
  }

  if (detail) {
    return `${providerName} API 연결 확인에 실패했습니다. (${status}) ${detail}`;
  }
  return `${providerName} API 연결 확인에 실패했습니다. (${status})`;
}

function readGoogleText(json: any): string {
  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        return part.text.trim();
      }
    }
  }
  return '';
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function validateGoogleAiStudio(apiKey: string): Promise<ProviderValidationResult> {
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GOOGLE_VALIDATION_MODEL)}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: {
        maxOutputTokens: 8,
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    return {
      ok: false,
      tone: 'error',
      message: buildFailureMessage(response.status, 'Google AI Studio', detail),
    };
  }

  const json = await response.json().catch(() => ({}));
  const responseText = readGoogleText(json);
  if (!responseText) {
    return {
      ok: false,
      tone: 'error',
      message: 'Google AI Studio 응답은 받았지만 텍스트 출력이 비어 있습니다. 모델/권한 상태를 다시 확인해 주세요.',
    };
  }

  return {
    ok: true,
    tone: 'success',
    message: 'Google AI Studio 실호출 검증 완료 (gemini-2.5-flash-lite, maxOutputTokens=8).',
  };
}

async function validateElevenLabs(apiKey: string): Promise<ProviderValidationResult> {
  const response = await fetchWithTimeout(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VALIDATION_VOICE_ID)}?output_format=mp3_22050_32`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: '테스트',
      model_id: ELEVENLABS_VALIDATION_MODEL,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    if (response.status === 402 && /paid_plan_required|payment_required/i.test(detail)) {
      return {
        ok: true,
        tone: 'info',
        message: 'ElevenLabs 키 검증은 완료되었지만 현재 플랜에서는 API TTS가 제한됩니다. 무료 모델(qwen/chatterbox) 또는 유료 플랜으로 진행해 주세요.',
      };
    }
    return {
      ok: false,
      tone: 'error',
      message: buildFailureMessage(response.status, 'ElevenLabs', detail),
    };
  }

  const contentType = response.headers.get('content-type') || '';
  const byteLength = (await response.arrayBuffer()).byteLength;
  if (!contentType.includes('audio') || byteLength < 200) {
    return {
      ok: false,
      tone: 'error',
      message: 'ElevenLabs 응답은 받았지만 오디오 데이터가 비정상입니다. 키/모델 상태를 다시 확인해 주세요.',
    };
  }

  return {
    ok: true,
    tone: 'success',
    message: 'ElevenLabs 실호출 검증 완료 (eleven_flash_v2_5, 짧은 테스트 문장).',
  };
}

export async function validateProviderConnection(
  kind: ProviderValidationKind,
  apiKey: string
): Promise<ProviderValidationResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return {
      ok: false,
      tone: 'error',
      message: 'API 키를 입력한 뒤 연결 확인을 눌러 주세요.',
    };
  }

  try {
    if (kind === 'openRouter') return await validateGoogleAiStudio(trimmed);
    if (kind === 'elevenLabs') return await validateElevenLabs(trimmed);

    return {
      ok: true,
      tone: 'info',
      message: '이 공급자는 별도 검증 루트가 없어 키 저장만 진행됩니다.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return {
      ok: false,
      tone: 'error',
      message: `API 연결 확인에 실패했습니다. 네트워크 또는 키 상태를 확인해 주세요. (${message})`,
    };
  }
}
