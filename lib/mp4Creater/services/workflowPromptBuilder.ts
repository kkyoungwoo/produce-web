import {
  ContentType,
  StorySelectionState,
  WorkflowPromptPack,
  WorkflowPromptTemplate,
} from '../types';

function sectionText(contentType: ContentType) {
  if (contentType === 'music_video') {
    return '뮤직비디오 제작 흐름에 맞춰 주제, 대본, 가사, 장면, 행동 프롬프트가 서로 어긋나지 않게 설계한다.';
  }
  if (contentType === 'news') {
    return '뉴스형 전달 구조를 유지하되, 정보 전달력과 장면 명확성을 우선한다.';
  }
  return '기승전결이 분명한 이야기 구조를 유지하고, 장면 전환이 자연스럽게 이어지게 설계한다.';
}

/**
 * Step 3에서 보여주는 기본 프롬프트 묶음입니다.
 * - 기존 프롬프트 팩은 유지
 * - 아래 템플릿 시스템이 이 프롬프트들을 관리 가능한 카드로 감쌉니다.
 */
export function buildWorkflowPromptPack(options: {
  contentType: ContentType;
  topic: string;
  selections: StorySelectionState;
  script: string;
}): WorkflowPromptPack {
  const { contentType, topic, selections, script } = options;
  const baseSummary = [
    `주제: ${topic || '미정'}`,
    `장르: ${selections.genre}`,
    `분위기: ${selections.mood}`,
    `배경: ${selections.setting}`,
    `주인공: ${selections.protagonist}`,
    `갈등: ${selections.conflict}`,
    `엔딩 톤: ${selections.endingTone}`,
  ].join('\n');

  const sharedProcess = `
${sectionText(contentType)}
아래 원칙을 반드시 반영한다.
1. 첫 문단은 짧고 강하게 시작한다.
2. 사용자가 이미 알고 있는 사실을 먼저 꺼내 공감대를 만든다.
3. 어려워하는 지점을 눌러 긴장감을 만든다.
4. 끝까지 보면 해결책이 있다는 확신을 준다.
5. 최소 두 가지 방법을 제시한다.
6. 그중 한 방법의 현실적 한계를 짚어 신뢰를 만든다.
7. 실제로 밀고 싶은 방법을 사례, 구조, 장점과 함께 올린다.
8. 마지막에는 요약과 지금 행동해야 하는 이유를 넣는다.
9. 감사 인사로 톤을 부드럽게 정리한다.
10. 필요한 링크 삽입 전략을 맥락에 따라 선택한다.
추가로 전체 서사는 발단 → 전개 → 위기 → 절정 → 결말 구조를 반드시 유지한다.
중요 문장은 짧고 선명하게 쓰고, 반복 훅과 기억 포인트를 분명히 만든다.
`.trim();

  const storyPrompt = `${sharedProcess}

[입력 정보]
${baseSummary}

[대본 초안]
${script || '대본 없음'}

위 내용을 바탕으로, 사용자가 바로 영상 제작에 넣을 수 있는 최종 스토리 대본을 다시 정리하라.
- 한국어로 작성
- 첫 문장은 강한 도입
- 비유법을 적극 사용
- 너무 무겁지 않지만 여운이 남게
- 오디오북 낭독과 쇼츠 분해가 둘 다 가능하게
- 결과는 [전체 이야기 요약] 3줄 + [최종 나레이션 대본] 형식으로 출력`;

  const lyricsPrompt = `${sharedProcess}

[입력 정보]
${baseSummary}

[현재 원문 또는 가사 초안]
${script || '가사 초안 없음'}

아래 조건으로 노래 가사와 유튜브 메타데이터를 생성한다.
- 반드시 한국어 가사 본문을 먼저 출력한다
- 구조: [Title] - [Intro] - [Verse 1] - [Chorus] - [Hook A] - [Verse 2] - [Chorus] - [Hook B] - [Bridge] - [Chorus] - [Outro]
- Hook A와 Hook B는 서로 다른 메시지
- 가사는 비유 중심으로 작성하고 외계/행성/인류 같은 직접 표현은 피한다
- 각 블록은 실제 노래 가사처럼 짧은 줄바꿈을 사용한다
- 제목은 40자 이내, 보고서 톤, 반드시 "위기" 또는 "반전" 포함
- 설명은 5~6줄, 감정 과장 최소화
- 마지막에 SUNO 분석 프롬프트 2종도 함께 출력
- 결과 형식은 [제목] [가사] [유튜브 설명] [SUNO Prompt A] [SUNO Prompt B] 순서로 고정한다`;

  const characterPrompt = `${sharedProcess}

[입력 정보]
${baseSummary}

[대본]
${script || '대본 없음'}

위 스토리텔링 대본을 기준으로 주요 인물만 선별하고, 각 인물별 캐릭터 참조 이미지용 프롬프트를 만든다.
- 얼굴 클로즈업 금지
- full body, full figure, clear silhouette 포함
- 배경 없는 전신 이미지
- 모든 캐릭터는 동일한 이미지 스타일 적용
- 이름과 제목은 한국어, 나머지는 영어
- 주인공 및 조연, 화풍 추천까지 함께 제안`;

  const scenePrompt = `${sharedProcess}

[입력 정보]
${baseSummary}

[가사/대본]
${script || '대본 없음'}

가사 또는 대본을 분석하여 핵심 장면 이미지 프롬프트를 시간 순서대로 생성한다.
- simple anime background, clean line art, minimal scenery, soft cel shading, simple shapes, flat anime colors, wide shot environment
- 장면은 밝고 뮤직비디오 친화적으로
- 캐릭터 외형은 직접 묘사하지 말고 "based on reference images" 문구만 사용
- 결과는 [EN – Image Prompts] 와 [KR – Prompt Meaning] 1:1 대응으로 출력`;

  const actionPrompt = `${sharedProcess}

[입력 정보]
${baseSummary}

이미지 프롬프트에 대응하는 장면 행동 프롬프트를 작성한다.
- 한국어만 사용
- 외형, 의상, 배경, 스타일 재설명 금지
- 한 줄 = 한 장면 = 하나의 핵심 행동
- 정적인 장면이 자연스럽게 살아 움직이도록 행동만 묘사
- 그대로 영상 도구에 복사해 넣을 수 있게 간결하게`;

  const persuasionStoryPrompt = `${sharedProcess}

사용자가 아래처럼 읽다 멈추지 않게 설계한다.
- 첫 문단은 2~3문장으로 끝까지 읽게 만드는 후킹 문단
- 중요한 포인트는 키워드 중심으로 짧게 반복
- 공감 → 긴장 → 해결 기대 → 방법 2개 → 한계 인정 → 진짜 제안 → 요약 → 감사 흐름 유지
- 각 장면 또는 문단마다 시각적으로 강조될 핵심 문장을 뽑기 쉽게 작성
- 블로그, 내레이션, 영상 자막 어디에도 재활용 가능하게 문장을 단단하게 만든다.`;

  return {
    storyPrompt,
    lyricsPrompt,
    characterPrompt,
    scenePrompt,
    actionPrompt,
    persuasionStoryPrompt,
  };
}

/**
 * Step 3 프롬프트 카드 기본 세트.
 * - builtIn 템플릿은 promptPack이 바뀌면 자동 갱신됩니다.
 * - custom 템플릿은 사용자가 계속 관리할 수 있도록 별도로 유지합니다.
 */
export function createBuiltInWorkflowPromptTemplates(
  contentType: ContentType,
  promptPack: WorkflowPromptPack
): WorkflowPromptTemplate[] {
  const isMusic = contentType === 'music_video';

  return [
    {
      id: 'builtin-core-script',
      name: isMusic ? '가사 초안 01' : '내레이션 초안 01',
      description: isMusic ? '현재 선택값을 기반으로 가사 구조를 정리합니다.' : '현재 선택값을 기반으로 장면형 나레이션을 정리합니다.',
      prompt: isMusic ? promptPack.lyricsPrompt : promptPack.storyPrompt,
      mode: 'narration',
      builtIn: true,
      basePrompt: isMusic ? promptPack.lyricsPrompt : promptPack.storyPrompt,
      isCustomized: false,
      updatedAt: 1,
    },
    {
      id: 'builtin-dialogue-script',
      name: '대화형 초안 02',
      description: 'AI가 인물 간 대화가 살아 있는 형식으로 변환합니다.',
      prompt: `${promptPack.storyPrompt}\n\n추가 규칙:\n- 대사와 지문을 섞어도 되지만 읽기 쉽게 구분한다\n- 인물 이름을 앞에 붙여 대화형 흐름으로 전개한다\n- 나레이션만 길게 이어지지 않게 한다\n- 마지막은 씬 제작에 바로 넣기 쉽게 문단 형태로 다시 정리한다`,
      mode: 'dialogue',
      builtIn: true,
      basePrompt: `${promptPack.storyPrompt}

추가 규칙:
- 대사와 지문을 섞어도 되지만 읽기 쉽게 구분한다
- 인물 이름을 앞에 붙여 대화형 흐름으로 전개한다
- 나레이션만 길게 이어지지 않게 한다
- 마지막은 씬 제작에 바로 넣기 쉽게 문단 형태로 다시 정리한다`,
      isCustomized: false,
      updatedAt: 2,
    },
    {
      id: 'builtin-scene-heavy',
      name: '씬 강조형 구성안',
      description: '문단마다 장면 전환이 또렷하게 보이도록 씬 단서를 강화합니다.',
      prompt: `${promptPack.scenePrompt}\n\n추가 규칙:\n- 결과는 최종 제작 대본으로 다시 정리한다\n- 각 문단 첫 문장에 장면 변화를 암시한다\n- 4~8개 문단 구조로 정리한다`,
      mode: 'narration',
      builtIn: true,
      basePrompt: `${promptPack.scenePrompt}

추가 규칙:
- 결과는 최종 제작 대본으로 다시 정리한다
- 각 문단 첫 문장에 장면 변화를 암시한다
- 4~8개 문단 구조로 정리한다`,
      isCustomized: false,
      updatedAt: 3,
    },
  ];
}

export function resolveWorkflowPromptTemplates(
  contentType: ContentType,
  promptPack: WorkflowPromptPack,
  existingTemplates?: WorkflowPromptTemplate[]
): WorkflowPromptTemplate[] {
  const builtIns = createBuiltInWorkflowPromptTemplates(contentType, promptPack);
  const existing = existingTemplates || [];

  const mergedBuiltIns = builtIns.map((builtIn) => {
    const saved = existing.find((item) => item.id === builtIn.id);
    if (!saved) return builtIn;
    if (saved.isCustomized) {
      return {
        ...builtIn,
        name: saved.name,
        description: saved.description,
        prompt: saved.prompt,
        updatedAt: saved.updatedAt || builtIn.updatedAt,
        isCustomized: true,
      };
    }
    return {
      ...builtIn,
      name: saved.name || builtIn.name,
      description: saved.description || builtIn.description,
      updatedAt: saved.updatedAt || builtIn.updatedAt,
    };
  });

  const customTemplates = existing.filter((item) => !item.builtIn);
  return [...mergedBuiltIns, ...customTemplates];
}

export function getSelectedWorkflowPromptTemplate(
  templates: WorkflowPromptTemplate[],
  selectedPromptTemplateId?: string | null
): WorkflowPromptTemplate {
  return templates.find((item) => item.id === selectedPromptTemplateId) || templates[0];
}
