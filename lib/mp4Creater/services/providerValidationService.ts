export type ProviderValidationKind = 'openRouter' | 'elevenLabs' | 'fal';

export interface ProviderValidationResult {
  ok: boolean;
  tone: 'success' | 'error' | 'info';
  message: string;
}

function buildFailureMessage(status: number, providerName: string) {
  if (status === 401 || status === 403) {
    return `${providerName} API가 연결되지 않았습니다. 키가 올바른지 다시 확인해 주세요.`;
  }

  if (status === 402 || status === 429) {
    return `${providerName} API가 현재 제한 상태입니다. 크레딧/요청 한도를 확인해 주세요.`;
  }

  return `${providerName} API 연결이 확인되지 않았습니다. 다시 시도해 주세요.`;
}

async function validateOpenRouter(apiKey: string): Promise<ProviderValidationResult> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      tone: 'error',
      message: buildFailureMessage(response.status, 'OpenRouter'),
    };
  }

  return {
    ok: true,
    tone: 'success',
    message: 'OpenRouter API 연결이 확인되었습니다.',
  };
}

async function validateElevenLabs(apiKey: string): Promise<ProviderValidationResult> {
  const response = await fetch('https://api.elevenlabs.io/v1/models', {
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      tone: 'error',
      message: buildFailureMessage(response.status, 'ElevenLabs'),
    };
  }

  return {
    ok: true,
    tone: 'success',
    message: 'ElevenLabs API 연결이 확인되었습니다.',
  };
}

async function validateFal(apiKey: string): Promise<ProviderValidationResult> {
  const response = await fetch('https://fal.run/fal-ai/pixverse/v5.5/image-to-video', {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: 'connection-test',
      image_url: 'https://example.com/invalid.png',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '480p',
    }),
  });

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      tone: 'error',
      message: buildFailureMessage(response.status, 'FAL'),
    };
  }

  if (response.status === 402 || response.status === 429) {
    return {
      ok: false,
      tone: 'error',
      message: buildFailureMessage(response.status, 'FAL'),
    };
  }

  if (response.ok || response.status === 400 || response.status === 422) {
    return {
      ok: true,
      tone: 'success',
      message: 'FAL API 연결 응답을 확인했습니다.',
    };
  }

  return {
    ok: false,
    tone: 'error',
    message: buildFailureMessage(response.status, 'FAL'),
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
    if (kind === 'openRouter') return await validateOpenRouter(trimmed);
    if (kind === 'elevenLabs') return await validateElevenLabs(trimmed);
    return await validateFal(trimmed);
  } catch {
    return {
      ok: false,
      tone: 'error',
      message: 'API 연결 확인에 실패했습니다. 네트워크 또는 키 상태를 확인해 주세요.',
    };
  }
}
