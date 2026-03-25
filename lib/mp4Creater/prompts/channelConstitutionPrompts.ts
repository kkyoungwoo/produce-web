import { ContentType, WorkflowPromptPack } from '../types';

export const CHANNEL_CONSTITUTION_TEMPLATE_ID = 'builtin-channel-constitution-v32';
export const CHANNEL_CONSTITUTION_ENGINE = 'channel_constitution_v32' as const;

export function supportsChannelConstitutionTemplate(contentType: ContentType) {
  return contentType !== 'music_video';
}

function getConstitutionRoleLabel(contentType: ContentType) {
  if (contentType === 'cinematic') return '영화형 시네마틱 내레이션';
  if (contentType === 'info_delivery') return '정보 전달형 내레이션';
  return '이야기형 내레이션';
}

function getConstitutionFlowRules(contentType: ContentType) {
  if (contentType === 'cinematic') {
    return [
      '- script는 영화 예고편식 호들갑이 아니라, 실제 화면이 떠오르는 절제된 시네마틱 내레이션으로 작성한다.',
      '- 각 문단은 하나의 장면 비트처럼 읽혀야 하며, 감정 변화와 행동 변화가 함께 보여야 한다.',
      '- 무드 설명만 길게 늘어놓지 말고 장소, 시선, 움직임, 표정, 전환 계기를 분명히 넣는다.',
      '- 화자 설명은 허용하지만, 대사집처럼 직접 대사를 길게 쓰지는 않는다.',
    ].join('\n');
  }

  if (contentType === 'info_delivery') {
    return [
      '- script는 설명형 콘텐츠에 맞는 명확한 내레이션으로 작성한다.',
      '- 첫 문단은 핵심 질문, 변화 포인트, 왜 지금 봐야 하는지를 바로 제시한다.',
      '- 중간 문단은 순서, 비교, 예시, 수치, 실제 체감 포인트가 보이게 정리한다.',
      '- 마지막 문단은 짧은 정리와 다음 행동 또는 핵심 결론으로 닫는다.',
    ].join('\n');
  }

  return [
    '- script는 이야기형 영상에 맞는 몰입형 내레이션으로 작성한다.',
    '- 각 문단은 이전 문단 다음에 반드시 일어나야 하는 사건 또는 감정 변화가 있어야 한다.',
    '- 감정보다 장면, 장면보다 행동이 먼저 보이게 쓰고, 추상적 설명문으로 흐르지 않는다.',
    '- 도입, 전개, 전환, 여운이 짧은 영상 안에서 자연스럽게 이어지도록 리듬을 설계한다.',
  ].join('\n');
}

function getScriptFieldRules(contentType: ContentType) {
  const baseRules = [
    '- 순수 내레이션 문단만 작성한다. 장면 제목, 섹션 제목, 마크다운, 코드펜스는 금지한다.',
    '- 문단 사이는 빈 줄 하나로 구분한다.',
    '- 문단 수는 대체로 4~10문단 안에서 주제와 예상 길이에 맞춘다.',
    '- 입력 소스에서 확인 가능한 사실만 사용한다. 확인되지 않은 디테일은 추가하지 않는다.',
    '- 선택된 프로젝트 언어를 끝까지 유지한다. 번역투 대신 실제 화자가 자연스럽게 말할 법한 문장으로 쓴다.',
    '- TTS로 읽어도 어색하지 않게 한 문장은 너무 길지 않게 유지하고, 발화 리듬이 끊기지 않도록 쓴다.',
    '- 각 문단은 step6에서 한 개의 핵심 장면 비트로 확장될 수 있게 시각 단서를 포함한다.',
    '- 지나친 비유, 호들갑, 선정적 표현, 근거 없는 단정은 금지한다.',
  ];

  if (contentType === 'cinematic') {
    baseRules.splice(4, 0, '- 영화형 톤을 유지하되 설명 자막처럼 딱딱하게 쓰지 않고, 화면과 감정이 함께 느껴지는 문장으로 쓴다.');
  } else if (contentType === 'info_delivery') {
    baseRules.splice(4, 0, '- 정보 전달형 콘텐츠이므로 핵심이 흐려지는 추상적 감성 문장을 줄이고, 이해를 돕는 선명한 표현을 우선한다.');
  } else {
    baseRules.splice(4, 0, '- 이야기형 콘텐츠이므로 감정선은 유지하되, 다음 컷이 떠오르는 구체 행동과 상황 변화를 계속 넣는다.');
  }

  return baseRules.join('\n');
}

export function buildChannelConstitutionPrompt(options: {
  contentType: ContentType;
  promptPack: WorkflowPromptPack;
}) {
  const { contentType, promptPack } = options;
  const productionRole = getConstitutionRoleLabel(contentType);

  return [
    '[구조 분석 프롬프트]',
    `현재 작업은 ${productionRole} 초안 생성이다.`,
    '이 프롬프트는 Step 1~Step 6 전체 흐름과 맞물리는 대본을 만들기 위한 구조 분석 프롬프트다.',
    '특히 script는 이후 캐릭터, 장면, 동작, TTS, 립싱크 설계의 기준 문서가 되므로 화면이 보이는 문단으로 작성한다.',
    '',
    '[핵심 규칙]',
    '1. 절대 사실성. 입력 소스, 링크 분석 결과, 현재 초안에 없는 내용은 추정하지 않는다.',
    '2. 관찰과 해석 분리. 먼저 확인 가능한 사실을 정리하고, 그 사실에 근거한 해석만 허용한다.',
    '3. 불확실성 명시. 확인되지 않는 정보는 단정하지 말고 한계를 밝힌다.',
    '4. 동적 타겟팅. 주제, 링크, 톤을 보고 최적 타겟 페르소나를 정의한다.',
    '5. 안전/수익화 게이트키핑. 위험 요소와 광고 제한 가능성을 간단히 점검한다.',
    '6. 제목 생성 규칙. 설명형 제목보다 현상 제시형 제목을 우선한다.',
    '7. 구조 선택. 핵심 메시지에 맞는 기승전결 모델 1개를 골라 대본 리듬을 설계한다.',
    '8. 현재 프로젝트에서는 주제, 참고 텍스트, 링크 분석 결과, 현재 초안을 유일한 소스로 취급한다.',
    '9. script는 읽기용 초안이 아니라 실제 영상 제작용 초안으로 작성한다. 문단마다 시각화 가능한 핵심 비트가 있어야 한다.',
    '10. 선택된 언어를 유지하고, TTS와 입모양 싱크에 무리가 없는 자연스러운 발화 길이를 우선한다.',
    '',
    '[기본 제작 방향]',
    promptPack.storyPrompt,
    '',
    '[캐릭터/비주얼 일관성 참고]',
    promptPack.characterPrompt,
    '',
    '[핵심 장면 참고]',
    promptPack.scenePrompt,
    '',
    '[동작/움직임 참고]',
    promptPack.actionPrompt,
    '',
    '[콘텐츠 타입별 작성 규칙]',
    getConstitutionFlowRules(contentType),
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
    getScriptFieldRules(contentType),
  ].join('\n');
}
