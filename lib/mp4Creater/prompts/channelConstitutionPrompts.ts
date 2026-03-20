import { ContentType, WorkflowPromptPack } from '../types';

export const CHANNEL_CONSTITUTION_TEMPLATE_ID = 'builtin-channel-constitution-v32';
export const CHANNEL_CONSTITUTION_ENGINE = 'channel_constitution_v32' as const;

export function supportsChannelConstitutionTemplate(contentType: ContentType) {
  return contentType !== 'music_video';
}

export function buildChannelConstitutionPrompt(options: {
  contentType: ContentType;
  promptPack: WorkflowPromptPack;
}) {
  const baseFlow = options.contentType === 'music_video'
    ? options.promptPack.lyricsPrompt
    : options.promptPack.storyPrompt;

  return [
    '[채널 헌법 v32 압축 적용판]',
    '1. 절대 사실성. 입력 소스, 링크 분석 결과, 현재 초안에 없는 내용은 추정하지 않는다.',
    '2. 관찰과 해석 분리. 먼저 확인 가능한 사실을 정리하고, 그 사실에 근거한 해석만 허용한다.',
    '3. 불확실성 명시. 확인되지 않는 정보는 단정하지 말고 한계를 밝힌다.',
    '4. 동적 타겟팅. 주제, 링크, 톤을 보고 최적 타겟 페르소나를 정의한다.',
    '5. 안전/수익화 게이트키핑. 위험 요소와 광고 제한 가능성을 간단히 점검한다.',
    '6. 제목 생성 규칙. 설명형 제목보다 현상 제시형 제목을 우선한다.',
    '7. 60초 구조 선택. 핵심 메시지에 맞는 기승전결 모델 1개를 골라 대본 리듬을 설계한다.',
    '8. 현재 프로젝트에서는 주제, 참고 텍스트, 링크 분석 결과, 현재 초안을 유일한 소스로 취급한다.',
    '',
    '[기본 제작 방향]',
    baseFlow,
    '',
    '[반드시 지킬 출력 계약]',
    '오직 JSON 객체 하나만 반환한다. 마크다운 설명과 코드펜스는 금지한다.',
    'JSON 스키마:',
    '{',
    '  "targetProfile": {',
    '    "name": "타겟 명칭",',
    '    "identity": "핵심 정체성",',
    '    "interests": ["관심사1", "관심사2"],',
    '    "tone": "선호 톤앤매너"',
    '  },',
    '  "safetyReview": {',
    '    "grade": "safe 또는 danger",',
    '    "details": "커뮤니티 가이드 관점 요약",',
    '    "decision": "계속 진행 또는 중단 판단"',
    '  },',
    '  "monetizationReview": {',
    '    "grade": "green 또는 yellow 또는 red",',
    '    "details": "광고 친화도 요약",',
    '    "solution": "리스크를 낮추는 표현 가이드"',
    '  },',
    '  "selectedStructure": {',
    '    "id": "001~010",',
    '    "reason": "선정 이유"',
    '  },',
    '  "titles": ["제목1", "제목2", "제목3"],',
    '  "keywords": [{"ko": "한국어 키워드", "en": "English keyword"}],',
    '  "script": "문단 사이를 빈 줄로 구분한 최종 내레이션 대본"',
    '}',
    '',
    '[script 필드 규칙]',
    '- 순수 내레이션 문단만 작성한다.',
    '- 문단 수는 대체로 4~10문단 안에서 주제와 예상 길이에 맞춘다.',
    '- 입력 소스에서 확인 가능한 사실만 사용한다.',
    '- 지나친 비유, 호들갑, 선정적 표현, 근거 없는 단정은 금지한다.',
  ].join('\n');
}
