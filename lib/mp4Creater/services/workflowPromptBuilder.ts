import {
  ContentType,
  StorySelectionState,
  WorkflowPromptPack,
  WorkflowPromptTemplate,
} from '../types';
import {
  buildChannelConstitutionPrompt,
  CHANNEL_CONSTITUTION_ENGINE,
  CHANNEL_CONSTITUTION_TEMPLATE_ID,
  supportsChannelConstitutionTemplate,
} from '../prompts/channelConstitutionPrompts';
import { getPromptRegistry } from './promptRegistryService';

const WORKFLOW_TEMPLATE_IDS = {
  core: 'builtin-core-script',
  dialogue: 'builtin-dialogue-script',
  sceneHeavy: 'builtin-scene-heavy',
} as const;

function getContentTypePromptLabel(contentType: ContentType) {
  if (contentType === 'music_video') return '뮤직비디오';
  if (contentType === 'news') return '영화';
  if (contentType === 'info_delivery') return '정보 전달';
  return '이야기';
}

export function getDefaultWorkflowPromptTemplateId(_contentType: ContentType) {
  return WORKFLOW_TEMPLATE_IDS.core;
}

function buildBaseSummary(topic: string, selections: StorySelectionState) {
  return [
    `Topic: ${topic || 'Untitled'}`,
    `Genre: ${selections.genre}`,
    `Mood: ${selections.mood}`,
    `Setting: ${selections.setting}`,
    `Lead: ${selections.protagonist}`,
    `Conflict: ${selections.conflict}`,
    `Ending tone: ${selections.endingTone}`,
  ].join('\n');
}

function buildConceptLock(contentType: ContentType) {
  if (contentType === 'music_video') {
    return [
      '- Step 1 concept is locked to music video.',
      '- Write singable lyrics and visual rhythm, not prose explanation.',
      '- Keep hook, chorus lift, and repeatable emotional phrases obvious.',
    ].join('\n');
  }

  if (contentType === 'news') {
    return [
      '- Step 1 concept is locked to cinematic movie-style storytelling.',
      '- Every paragraph should feel like a visible scene with action, tension, and mood.',
      '- Avoid explainer tone or planning-note phrasing inside the final script body.',
    ].join('\n');
  }

  if (contentType === 'info_delivery') {
    return [
      '- Step 1 concept is locked to explainer / information-delivery format.',
      '- Open with the key question or why-now context, then explain through order, example, comparison, or numbers.',
      '- Avoid dramatic movie prose when a clear explanation would work better.',
    ].join('\n');
  }

  return [
    '- Step 1 concept is locked to narrative storytelling.',
    '- Each paragraph should push the story forward through emotion, action, and scene progression.',
    '- Avoid turning the script into abstract explanation or planning notes.',
  ].join('\n');
}

function buildParagraphFlowGuide(contentType: ContentType) {
  if (contentType === 'music_video') {
    return [
      '- Use lyric blocks separated by blank lines.',
      '- Prefer 4 to 6 short blocks such as Intro / Verse / Chorus / Bridge / Outro.',
      '- Keep each line singable and visually evocative.',
    ].join('\n');
  }

  if (contentType === 'news') {
    return [
      '- Use 4 to 6 blank-line-separated cinematic paragraphs.',
      '- Each paragraph should read like one scene beat with visible motion, setting, and emotional pressure.',
      '- Script body only. Do not print labels like Goal, Topic, Genre, Mood, or Notes.',
    ].join('\n');
  }

  if (contentType === 'info_delivery') {
    return [
      '- Use 4 to 6 blank-line-separated explainer paragraphs.',
      '- Paragraph 1 introduces the key question or why-now context.',
      '- Middle paragraphs should use order, example, comparison, or numbers.',
      '- Final paragraph closes with summary and next action.',
    ].join('\n');
  }

  return [
    '- Use 4 to 6 blank-line-separated story paragraphs.',
    '- Each paragraph should feel like a new beat, not a planning memo.',
    '- Script body only. Do not print labels like Goal, Topic, Genre, Mood, or Notes.',
  ].join('\n');
}

function buildConceptOutputGuide(contentType: ContentType) {
  if (contentType === 'music_video') {
    return [
      '[출력 규칙]',
      '- 결과는 설명문이 아니라 실제로 부를 수 있는 가사형 텍스트로 작성한다.',
      '- [Intro], [Verse 1], [Chorus], [Verse 2], [Outro] 같은 블록 제목을 유지한다.',
      '- 각 블록 안에는 짧은 가사 줄을 2~4줄 배치한다.',
      '- 감정, 반복 훅, 후렴 포인트가 분명하게 들리도록 쓴다.',
      '',
      '[최종 예시]',
      '[Intro]',
      '젖은 새벽 끝에 네 이름이 번져 와',
      '멈춘 줄 알았던 심장이 다시 박자를 타',
      '',
      '[Chorus]',
      '나는 너를 다시 불러, 후렴처럼 다시 불러',
      '오늘의 밤이 끝나도 이 장면은 남아',
    ].join('\n');
  }

  if (contentType === 'news') {
    return [
      '[출력 규칙]',
      '- 결과는 영화처럼 장면이 보이는 시네마틱 문단형 대본으로 작성한다.',
      '- 각 문단은 새 장면처럼 읽혀야 하며 감정과 행동이 함께 보여야 한다.',
      '- 설명만 나열하지 말고 화면이 그려지는 문장으로 쓴다.',
      '- 목표, 주제, 장르 같은 메타 문구는 본문에 넣지 않는다.',
      '',
      '[최종 예시]',
      '젖은 골목 끝에 선 주인공은 오래전 약속의 흔적을 다시 발견한다. 네온은 흔들리고, 표정은 대답보다 먼저 무너진다.',
    ].join('\n');
  }

  if (contentType === 'info_delivery') {
    return [
      '[출력 규칙]',
      '- 결과는 정보 전달용 문단형 대본으로 작성한다.',
      '- 첫 문단에서 핵심 질문 또는 핵심 맥락을 바로 제시한다.',
      '- 중간 문단은 순서, 예시, 숫자, 비교가 보이게 정리한다.',
      '- 마지막 문단은 요약과 다음 행동으로 마무리한다.',
      '- 목표, 주제, 장르 같은 메타 문구는 본문에 넣지 않는다.',
      '',
      '[최종 예시]',
      '오늘은 왜 이 변화가 중요한지부터 짚고 시작한다. 먼저 일정과 비용을 보고, 그다음 실제 생활비 체감이 어디서 달라지는지 예시로 확인한다.',
    ].join('\n');
  }

  return [
    '[출력 규칙]',
    '- 결과는 이야기형 문단 대본으로 작성한다.',
    '- 각 문단은 다음 장면이 궁금해지도록 감정과 사건을 함께 전개한다.',
    '- 설명보다 장면과 행동이 먼저 보이게 쓴다.',
    '- 목표, 주제, 장르 같은 메타 문구는 본문에 넣지 않는다.',
    '',
    '[최종 예시]',
    '편의점 문이 닫히기 직전, 주인공은 끝내 보내지 못한 메시지를 다시 열어 본다. 작은 숨 한 번이 오늘 밤의 방향을 바꾼다.',
  ].join('\n');
}

export function buildWorkflowPromptPack(options: {
  contentType: ContentType;
  topic: string;
  selections: StorySelectionState;
  script: string;
}): WorkflowPromptPack {
  const bundle = getPromptRegistry(options.contentType);
  const summary = buildBaseSummary(options.topic, options.selections);
  const currentDraft = options.script?.trim() || 'No draft';

  const outputGuide = buildConceptOutputGuide(options.contentType);
  const conceptLock = buildConceptLock(options.contentType);
  const paragraphGuide = buildParagraphFlowGuide(options.contentType);
  const storyPrompt = `${bundle.story}

[CONCEPT LOCK]
${conceptLock}

[PARAGRAPH FLOW]
${paragraphGuide}

${outputGuide}

[PROJECT BRIEF]
${summary}

[CURRENT DRAFT]
${currentDraft}`;
  const lyricsPrompt = `${bundle.story}

[CONCEPT LOCK]
${buildConceptLock('music_video')}

[PARAGRAPH FLOW]
${buildParagraphFlowGuide('music_video')}

${buildConceptOutputGuide('music_video')}

[MUSIC VIDEO FLOW]
${summary}

[CURRENT DRAFT]
${currentDraft}`;
  const characterPrompt = `${bundle.story}

[CONCEPT LOCK]
${conceptLock}

[PARAGRAPH FLOW]
${paragraphGuide}

${outputGuide}

[CHARACTERS]
${summary}

[SCRIPT]
${currentDraft}`;
  const scenePrompt = `${bundle.story}

[CONCEPT LOCK]
${conceptLock}

[PARAGRAPH FLOW]
${paragraphGuide}

${outputGuide}

[SCENE PROMPTS]
${summary}

[SCRIPT]
${currentDraft}`;
  const actionPrompt = `${bundle.story}

[CONCEPT LOCK]
${conceptLock}

[PARAGRAPH FLOW]
${paragraphGuide}

${outputGuide}

[SCENE ACTIONS]
${summary}`;
  const persuasionStoryPrompt = `${bundle.story}

[CONCEPT LOCK]
${conceptLock}

[PARAGRAPH FLOW]
${paragraphGuide}

${outputGuide}

[RECOMMENDED PHRASES]
${bundle.recommendations.join('\n')}`;

  return {
    storyPrompt,
    lyricsPrompt,
    characterPrompt,
    scenePrompt,
    actionPrompt,
    persuasionStoryPrompt,
  };
}

export function createBuiltInWorkflowPromptTemplates(
  contentType: ContentType,
  promptPack: WorkflowPromptPack
): WorkflowPromptTemplate[] {
  const conceptLabel = getContentTypePromptLabel(contentType);
  const isMusic = contentType === 'music_video';
  const corePrompt = isMusic ? promptPack.lyricsPrompt : promptPack.storyPrompt;
  const dialoguePrompt = `${promptPack.storyPrompt}

추가 규칙:
- 대화와 내레이션을 자연스럽게 섞어주세요.
- Step 1에서 고른 콘셉트 톤을 흐리지 말고 유지해주세요.
- 시각적이고 구체적인 문장을 우선해주세요.`;
  const sceneHeavyPrompt = `${promptPack.scenePrompt}

추가 규칙:
- 각 문단은 눈에 보이는 장면 전환으로 시작해주세요.
- Step 1 콘셉트에 맞는 장면 결을 끝까지 유지해주세요.
- 구체적인 시각적 포인트를 추가해주세요.`;
  const templates: WorkflowPromptTemplate[] = [
    {
      id: WORKFLOW_TEMPLATE_IDS.core,
      name: `${conceptLabel} 기본 프롬프트`,
      description: `${conceptLabel} 콘셉트에 맞는 기본 대본 프롬프트`,
      prompt: corePrompt,
      mode: 'narration',
      engine: 'default',
      builtIn: true,
      basePrompt: corePrompt,
      isCustomized: false,
      updatedAt: 1,
    },
    {
      id: WORKFLOW_TEMPLATE_IDS.dialogue,
      name: `${conceptLabel} 대화형 프롬프트`,
      description: '대화와 내레이션을 함께 쓰는 변형 프롬프트',
      prompt: dialoguePrompt,
      mode: 'dialogue',
      engine: 'default',
      builtIn: true,
      basePrompt: dialoguePrompt,
      isCustomized: false,
      updatedAt: 2,
    },
    {
      id: WORKFLOW_TEMPLATE_IDS.sceneHeavy,
      name: `${conceptLabel} 장면 강조 프롬프트`,
      description: '장면 전환과 시각 요소를 더 강조하는 변형 프롬프트',
      prompt: sceneHeavyPrompt,
      mode: 'narration',
      engine: 'default',
      builtIn: true,
      basePrompt: sceneHeavyPrompt,
      isCustomized: false,
      updatedAt: 3,
    },
  ];

  if (supportsChannelConstitutionTemplate(contentType)) {
    const constitutionPrompt = buildChannelConstitutionPrompt({ contentType, promptPack });
    templates.push({
      id: CHANNEL_CONSTITUTION_TEMPLATE_ID,
      name: `${conceptLabel} 구조 분석 프롬프트`,
      description: '채널 헌법 규칙을 함께 적용하는 고정 구조 프롬프트',
      prompt: constitutionPrompt,
      mode: 'narration',
      engine: CHANNEL_CONSTITUTION_ENGINE,
      builtIn: true,
      basePrompt: constitutionPrompt,
      isCustomized: false,
      updatedAt: 4,
    });
  }

  return templates;
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
        engine: saved.engine || builtIn.engine || 'default',
        updatedAt: saved.updatedAt || builtIn.updatedAt,
        isCustomized: true,
      };
    }
    return {
      ...builtIn,
      name: saved.name || builtIn.name,
      description: saved.description || builtIn.description,
      engine: saved.engine || builtIn.engine || 'default',
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
