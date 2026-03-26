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
import { buildPromptStudioStepBlock } from '../prompt-center';

const WORKFLOW_TEMPLATE_IDS = {
  core: 'builtin-core-script',
  dialogue: 'builtin-dialogue-script',
  sceneHeavy: 'builtin-scene-heavy',
} as const;

function getContentTypePromptLabel(contentType: ContentType) {
  if (contentType === 'music_video') return '뮤직비디오';
  if (contentType === 'cinematic') return '영화';
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

function buildGlobalExecutionGuide(contentType: ContentType) {
  return [
    '- 사용자가 최종으로 고른 언어를 끝까지 유지한다.',
    '- 선택 언어가 한국어가 아니어도 그 언어로 자연스럽게 읽고, 말하고, 노래할 수 있는 문장 호흡을 우선한다.',
    contentType === 'music_video'
      ? '- 보컬이 있는 장면은 해당 언어의 노래 음절 흐름이 자연스럽고 입모양 싱크가 가능한 길이로 쓴다.'
      : '- 말하는 장면은 해당 언어의 TTS와 입모양 싱크가 가능한 길이와 어순으로 쓴다.',
    '- 실사 또는 반실사 인물이라면 자연스러운 한국인 인상과 과장되지 않은 얼굴 비율을 유지한다.',
    '- 프로젝트에서 실제로 쓰지 않는 출력은 만들지 않는다. 설명문, 분석문, 장황한 서론보다 바로 사용 가능한 결과 형식을 우선한다.',
  ].join('\n');
}

function buildSongProductionGuide(contentType: ContentType, selections: StorySelectionState) {
  const hookMood = selections.mood || '몰입감 있는';
  const hookSetting = selections.setting || '장면 중심 공간';
  const lead = selections.protagonist || '주요 인물';
  const conflict = selections.conflict || '핵심 변화';

  if (contentType === 'music_video') {
    return [
      '[SONG PRODUCTION RULE]',
      `- 후렴은 한 번만 들어도 기억되는 반복 훅으로 만든다. 감정 축은 ${hookMood}, 핵심 배경은 ${hookSetting}, 중심 인물은 ${lead}, 감정 갈등은 ${conflict}다.`,
      '- 출력은 이 프로젝트에서 바로 사용할 가사 본문만 작성한다. 유튜브 제목, 설명, 해설, 분석 보고서는 출력하지 않는다.',
      '- 구조는 [Intro] - [Verse 1] - [Chorus] - [Hook A] - [Verse 2] - [Chorus] - [Hook B] - [Bridge] - [Chorus] - [Outro] 순서를 유지한다.',
      '- [Instrumental Solo], [Change], [Start], [Silence] 같은 연주/상태 메타 지시어는 넣지 않는다.',
      '- Hook A와 Hook B는 서로 다른 메시지를 가져야 하며, 각 Hook의 첫 줄은 반복 가능한 고정 훅처럼 들려야 한다.',
      '- 각 Verse/Hook/Bridge는 실제로 부를 수 있어야 하며, 산문형 긴 문장과 발음이 뭉개지는 표현을 피한다.',
      '- 영어 단어나 문장은 각 Verse/Hook/Bridge마다 최대 1회만 허용하고, Hook은 최대 2회까지만 허용한다.',
      '- 외계, 행성, 인류 같은 세계관 핵심어를 직접 설명하지 말고 비유와 장면 이미지로 변환한다.',
      '- 장면 전환 포인트가 떠오를 수 있게 빛, 몸짓, 시선, 거리, 소품, 날씨, 도시, 반사광 같은 시각 단어를 적절히 넣는다.',
      '- 보컬 입모양이 잘 맞도록 지나치게 긴 라임, 발음이 무너지는 영어 남발, 한 줄에 과하게 많은 음절을 피한다.',
    ].join('\n');
  }

  return [
    '[MUSIC-DERIVED RHYTHM RULE]',
    '- 문장 리듬은 뮤직비디오처럼 강한 훅과 반복 포인트를 참고하되, 결과물의 목적은 현재 콘텐츠 타입에 맞춰 조절한다.',
    '- 장면 전환이 살아나도록 반복 가능한 키워드, 운율, 호흡 포인트를 일부 사용하되, 설명성과 서사를 해치지 않는다.',
    '- 시각적으로 잘게 분해될 수 있는 문장을 우선하고, 나중 단계의 장면 분해와 립싱크를 방해하는 장문을 피한다.',
  ].join('\n');
}

function buildCharacterGenerationGuide(contentType: ContentType) {
  return [
    '[CHARACTER IMAGE GENERATION RULE]',
    '- 최종 대본을 기준으로 이야기 흐름상 중요한 인물만 추린다.',
    '- 각 인물은 이후 씬 이미지와 씬 영상까지 이어질 기준 얼굴과 실루엣을 가진 고유 캐릭터로 설계한다.',
    '- 각 캐릭터는 한 장의 전신 참조 이미지로 이해되도록 full body, full figure, clear silhouette, neutral pose, stable composition을 기본으로 둔다.',
    '- 얼굴 클로즈업, 과한 원근 왜곡, 불안정한 포즈, 배경 설명이 긴 구도를 피하고 background removed 상태를 기본값으로 둔다.',
    '- 같은 프로젝트 안에서는 모든 캐릭터가 동일한 이미지 스타일 계열을 공유해야 한다.',
    '- 외계인, 판타지 존재, 초현실 설정이 등장해도 얼굴은 사람처럼 읽히고 불쾌하지 않게 표현한다. 비인간적이더라도 그로테스크하게 만들지 않는다.',
    '- 실사 캐릭터를 선택한 경우 반드시 자연스러운 한국인 느낌이 나야 하며, 특정 연예인 복제처럼 보이면 안 된다.',
    '- 입이 잘 보이는 얼굴 구조와 구도를 우선하고, 입을 가리는 손, 마스크, 과한 액세서리, 극단적 측면샷 남발을 피한다.',
    contentType === 'music_video'
      ? '- 뮤직비디오 인물은 무대 위 보컬/퍼포머처럼 카메라 존재감이 있고, 노래할 때 입모양이 잘 읽히는 얼굴과 포즈를 우선한다.'
      : '- 이야기/영화/정보전달 인물은 말할 때는 또렷하고, 말하지 않을 때는 표정과 시선으로 감정을 전달할 수 있어야 한다.',
  ].join('\n');
}

function buildSceneMotionGuide(contentType: ContentType) {
  return [
    '[STEP6 SCENE / MOTION RULE]',
    '- 장면은 시간 순서를 유지하며, 한 장면은 하나의 핵심 순간만 담당한다.',
    '- 가장 시각적으로 강한 순간만 남기고, 같은 의미의 장면을 중복 생성하지 않는다.',
    '- 이미지 프롬프트는 장면의 핵심 사건, 감정, 공간 반응을 설명하되, 이미 선택된 캐릭터 외형을 매번 장황하게 재설명하지 않는다.',
    '- 캐릭터가 등장하면 가능하면 based on reference images 원칙을 적용해 참조 이미지 기반 정체성을 유지한다.',
    '- 동영상 움직임 프롬프트는 외형, 의상, 배경, 스타일을 다시 설명하지 말고 한 줄에 하나의 핵심 행동만 적는다.',
    '- 동영상 움직임 프롬프트는 그대로 복사해 사용할 수 있을 정도로 짧고 분명해야 하며, 과도한 기술적 영상 용어를 피한다.',
    contentType === 'music_video'
      ? '- 뮤직비디오라면 보컬이 들리는 구간의 입모양은 해당 음악 보컬과 맞추고, 간주에서는 퍼포먼스와 리듬감을 우선한다.'
      : '- 뮤직비디오가 아니라면 말하는 장면의 입모양은 대본과 TTS를 따르고, 비발화 장면은 억지 립싱크 없이 표정과 행동을 우선한다.',
    '- 자막 없이도 장면 의미가 전달되게 하고, 이전 씬과 다음 씬의 연속성을 유지한다.',
  ].join('\n');
}

function buildWorkflowLinkGuide(contentType: ContentType) {
  return [
    '[STEP LINK RULE]',
    '- Step1~2에서 고른 콘텐츠 타입, 분위기, 배경, 주인공, 갈등, 엔딩 톤은 이후 Step3~6까지 계속 동일한 프로젝트 축으로 유지한다.',
    '- Step3 대본은 Step4 캐릭터 추출, Step5 화풍 선택, Step6 씬 이미지/영상, Thumbnail Studio까지 재사용되는 원본이므로 장면화 가능한 문장으로 작성한다.',
    '- Step4 캐릭터는 이후 모든 씬과 썸네일의 기준 얼굴/실루엣/입모양 구조가 되어야 한다.',
    '- Step5 화풍은 Step6 씬 이미지, 씬 영상, 썸네일의 공통 스타일 기준점이 되어야 한다.',
    '- Step6은 각 문단이 개별 컷으로 끊겨도 전체 프로젝트는 하나의 영상처럼 자연스럽게 이어지게 만든다.',
    contentType === 'music_video'
      ? '- 썸네일과 모든 씬은 같은 노래 세계관 안에서 후렴, 벌스, 훅의 감정 차이가 읽히도록 연결한다.'
      : '- 썸네일과 모든 씬은 같은 이야기/영화/정보전달 프로젝트처럼 인물, 공간, 감정선이 이어지게 설계한다.',
  ].join('\n');
}

function buildFreshnessGuide() {
  return [
    '[FRESHNESS / ANTI-REPETITION RULE]',
    '- 기본값은 항상 새 결과다. 직전 생성의 문장, 장면 배치, 비유, 추천 문구, 이미지 구도를 그대로 반복하지 않는다.',
    '- 같은 선택값이어도 매번 새 훅, 새 세부 묘사, 새 장면 전환 포인트를 만든다.',
    '- 사용자가 비슷하게 재생성을 명시한 경우에만 핵심 정체성을 유지한 근접 변형을 만든다. 그 외에는 캐시된 느낌을 답습하지 않는다.',
    '- 추천, 대본, 이미지 프롬프트, 영상 프롬프트, 썸네일 프롬프트 모두 최근 결과와 결이 겹치지 않도록 새 표현을 우선한다.',
  ].join('\n');
}

function buildScriptSceneContinuityGuide(contentType: ContentType) {
  return [
    '[SCRIPT / SCENE CONTINUITY RULE]',
    '- 각 문단은 하나의 독립된 씬처럼 쓸 수 있어야 하지만, 바로 앞 문단과 뒤 문단으로 자연스럽게 연결되는 감정/행동/시선/공간 흐름을 남긴다.',
    '- 모든 씬은 이전 씬을 참고해 후속 반응처럼 이어지고, 다음 씬의 도착점을 미리 예고하는 연결 단서를 가진다.',
    contentType === 'music_video'
      ? '- 노래가 있는 장면은 실제로 입모양이 맞는 짧고 선명한 보컬 라인으로 쓰고, 간주 장면은 퍼포먼스와 감정 연결을 담당하게 한다.'
      : '- 말하는 장면은 실제 입모양 싱크가 가능한 길이의 문장으로 쓰고, 말하지 않는 장면은 표정, 시선, 몸짓, 공간 반응으로 감정을 전달하게 한다.',
    '- 씬 이미지 프롬프트는 문단의 대표 순간을 잡고, 씬 영상 프롬프트는 그 이미지가 자연스럽게 움직이는 다음 1~2초 행동처럼 설계한다.',
    '- 문단 설정을 바꿔도 전체 프로젝트의 인물 정체성, 화풍, 시간축, 감정선은 깨지지 않아야 한다.',
  ].join('\n');
}

function buildThumbnailAlignmentGuide() {
  return [
    '[THUMBNAIL ALIGNMENT RULE]',
    '- 썸네일은 실제 대본/씬/캐릭터/화풍을 기반으로 만들어야 하며, 프로젝트의 핵심 장면과 감정을 한 장으로 압축한다.',
    '- 새롭게 생성은 같은 프로젝트 안에서 새 결의 썸네일을 만들고, 비슷하게 재생성은 선택 썸네일과 핵심 구도/인물/색감 결을 유지한 근접 변형으로 만든다.',
    '- 썸네일 텍스트와 이미지가 서로 충돌하지 않게 하고, 본편 씬과 다른 세계관처럼 보이지 않게 한다.',
  ].join('\n');
}

function buildConceptLock(contentType: ContentType) {
  if (contentType === 'music_video') {
    return [
      '- Step 1 concept is locked to music video.',
      '- Write singable lyrics and visual rhythm, not prose explanation.',
      '- Keep hook, chorus lift, repeatable emotional phrases, and scene-cut energy obvious.',
      '- Step 4 character references and Step 6 scene/motion prompts must feel like one connected music-video workflow.',
    ].join('\n');
  }

  if (contentType === 'cinematic') {
    return [
      '- Step 1 concept is locked to cinematic movie-style storytelling.',
      '- Every paragraph should feel like a visible scene with action, tension, and mood.',
      '- Use the clarity and visual punch of music-video storytelling, but slow it down into film-like emotional pressure.',
      '- Avoid explainer tone or planning-note phrasing inside the final script body.',
    ].join('\n');
  }

  if (contentType === 'info_delivery') {
    return [
      '- Step 1 concept is locked to explainer / information-delivery format.',
      '- Open with the key question or why-now context, then explain through order, example, comparison, or numbers.',
      '- Borrow the hook power and scene readability of music videos, but keep the final structure optimized for clarity and understanding.',
      '- Avoid dramatic movie prose when a clear explanation would work better.',
    ].join('\n');
  }

  return [
    '- Step 1 concept is locked to narrative storytelling.',
    '- Each paragraph should push the story forward through emotion, action, and scene progression.',
    '- Use the vivid scene readability of music-video structure, but keep story and character progression at the center.',
    '- Avoid turning the script into abstract explanation or planning notes.',
  ].join('\n');
}

function buildParagraphFlowGuide(contentType: ContentType) {
  if (contentType === 'music_video') {
    return [
      '- Use sectioned lyric blocks separated by blank lines.',
      '- Follow the exact structure required by the music workflow.',
      '- Every block should remain singable, scene-friendly, and easy to break into Step 6 image moments.',
    ].join('\n');
  }

  if (contentType === 'cinematic') {
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

function buildStoryOutputGuide(contentType: ContentType) {
  if (contentType === 'cinematic') {
    return [
      '[OUTPUT RULE]',
      '- 결과는 영화처럼 장면이 보이는 시네마틱 문단형 대본으로 작성한다.',
      '- 각 문단은 새 장면처럼 읽혀야 하며 감정과 행동이 함께 보여야 한다.',
      '- 설명만 나열하지 말고 화면이 그려지는 문장으로 쓴다.',
      '- 목표, 주제, 장르 같은 메타 문구는 본문에 넣지 않는다.',
    ].join('\n');
  }

  if (contentType === 'info_delivery') {
    return [
      '[OUTPUT RULE]',
      '- 결과는 정보 전달용 문단형 대본으로 작성한다.',
      '- 첫 문단에서 핵심 질문 또는 핵심 맥락을 바로 제시한다.',
      '- 중간 문단은 순서, 예시, 숫자, 비교가 보이게 정리한다.',
      '- 마지막 문단은 요약과 다음 행동으로 마무리한다.',
      '- 목표, 주제, 장르 같은 메타 문구는 본문에 넣지 않는다.',
    ].join('\n');
  }

  return [
    '[OUTPUT RULE]',
    '- 결과는 이야기형 문단 대본으로 작성한다.',
    '- 각 문단은 다음 장면이 궁금해지도록 감정과 사건을 함께 전개한다.',
    '- 설명보다 장면과 행동이 먼저 보이게 쓴다.',
    '- 목표, 주제, 장르 같은 메타 문구는 본문에 넣지 않는다.',
  ].join('\n');
}

function buildLyricsOutputGuide() {
  return [
    '[OUTPUT RULE]',
    '- 결과는 이 프로젝트에서 바로 사용할 가사 본문만 작성한다.',
    '- 반드시 [Intro], [Verse 1], [Chorus], [Hook A], [Verse 2], [Chorus], [Hook B], [Bridge], [Chorus], [Outro] 순서를 유지한다.',
    '- 각 블록은 짧은 가사 줄 2~4줄로 정리하고, 들을 때 리듬과 장면이 동시에 떠오르게 쓴다.',
    '- 설명문, 분석문, 유튜브 제목/설명, SUNO 보고서, 메타 해설은 출력하지 않는다.',
  ].join('\n');
}

function buildCharacterOutputGuide() {
  return [
    '[OUTPUT FORMAT]',
    '- 아래 두 블록만 출력한다.',
    '- [Character List]: 등장인물 이름 + 역할 한 줄 요약을 한국어로 작성한다.',
    '- [Character Reference Image Prompts]: 이름과 제목은 한국어로 작성하고, 실제 이미지 생성 프롬프트 본문은 영어로 작성한다.',
    '- 한 줄 = 한 명의 캐릭터다.',
    '- 각 줄에는 full body, full figure, clear silhouette, neutral pose, stable composition, background removed 개념이 포함되어야 한다.',
    '- 같은 스타일을 공유하되, 각 인물은 서로 다른 실루엣과 역할감이 보이게 만든다.',
  ].join('\n');
}

function buildSceneOutputGuide(contentType: ContentType) {
  return [
    '[OUTPUT FORMAT]',
    '- 장면 수는 필요한 핵심 순간만큼만 고른다. 장면은 반드시 시간 순서를 따른다.',
    '- [EN – Image Prompts] 블록에서는 영어로만 작성하고, 한 줄 = 한 장면 프롬프트로 정리한다.',
    '- 장면마다 가장 시각적으로 강한 순간 하나만 선택한다.',
    '- 캐릭터가 등장하면 외형을 길게 재설명하지 말고 based on reference images 원칙을 우선한다.',
    contentType === 'music_video'
      ? '- 뮤직비디오라면 가사 흐름을 따라가며, 장면은 음악에 잘 붙는 시각 훅 중심으로 고른다.'
      : '- 이야기/영화/정보전달이라면 대본 흐름을 따라가며, 장면은 서사 또는 전달 포인트가 가장 분명한 순간으로 고른다.',
    '- [KR – Prompt Meaning] 블록에서는 각 장면의 의미를 한국어로 1:1 대응해 정리한다.',
  ].join('\n');
}

function buildActionOutputGuide(contentType: ContentType) {
  return [
    '[OUTPUT FORMAT]',
    '- [영상 프롬프트] 블록 하나만 출력한다.',
    '- 한국어로만 작성한다.',
    '- 한 줄 = 한 장면, 한 장면 = 하나의 핵심 행동만 적는다.',
    '- 장면 시간 순서를 유지한다.',
    '- 외형, 의상, 배경, 스타일을 재설명하지 않는다.',
    '- 기술적 영상 용어를 남발하지 않는다. 사람이 바로 붙여넣어도 이해되는 행동 문장으로 쓴다.',
    contentType === 'music_video'
      ? '- 노래가 들리는 장면은 보컬과 입모양 싱크가 자연스럽게 느껴지는 행동을 쓴다.'
      : '- 말하는 장면은 대본/TTS와 입모양이 맞게, 말하지 않는 장면은 표정과 행동 중심으로 쓴다.',
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

  const conceptLock = buildConceptLock(options.contentType);
  const paragraphGuide = buildParagraphFlowGuide(options.contentType);
  const conceptFolderGuide = `[PROMPT FOLDER / CONCEPT]\n${bundle.conceptGuide}`;
  const scriptFolderGuide = buildPromptStudioStepBlock(options.contentType, 'script');
  const characterFolderGuide = buildPromptStudioStepBlock(options.contentType, 'character');
  const styleFolderGuide = buildPromptStudioStepBlock(options.contentType, 'style');
  const sceneFolderGuide = buildPromptStudioStepBlock(options.contentType, 'scene');
  const actionFolderGuide = buildPromptStudioStepBlock(options.contentType, 'action');
  const globalExecutionGuide = buildGlobalExecutionGuide(options.contentType);
  const songProductionGuide = buildSongProductionGuide(options.contentType, options.selections);
  const characterGenerationGuide = buildCharacterGenerationGuide(options.contentType);
  const sceneMotionGuide = buildSceneMotionGuide(options.contentType);
  const workflowLinkGuide = buildWorkflowLinkGuide(options.contentType);
  const freshnessGuide = buildFreshnessGuide();
  const scriptSceneContinuityGuide = buildScriptSceneContinuityGuide(options.contentType);
  const thumbnailAlignmentGuide = buildThumbnailAlignmentGuide();

  const storyOutputGuide = buildStoryOutputGuide(options.contentType);
  const lyricsOutputGuide = buildLyricsOutputGuide();
  const characterOutputGuide = buildCharacterOutputGuide();
  const sceneOutputGuide = buildSceneOutputGuide(options.contentType);
  const actionOutputGuide = buildActionOutputGuide(options.contentType);

  const storyPrompt = `${bundle.story}

[GLOBAL EXECUTION RULE]
${globalExecutionGuide}

[CONCEPT LOCK]
${conceptLock}

[PARAGRAPH FLOW]
${paragraphGuide}

${workflowLinkGuide}

${freshnessGuide}

${scriptSceneContinuityGuide}

${thumbnailAlignmentGuide}

${conceptFolderGuide}

${scriptFolderGuide}

${songProductionGuide}

${storyOutputGuide}

[PROJECT BRIEF]
${summary}

[CURRENT DRAFT]
${currentDraft}`;
  const lyricsPrompt = `${bundle.story}

[GLOBAL EXECUTION RULE]
${globalExecutionGuide}

[CONCEPT LOCK]
${buildConceptLock('music_video')}

[PARAGRAPH FLOW]
${buildParagraphFlowGuide('music_video')}

${buildWorkflowLinkGuide('music_video')}

${freshnessGuide}

${buildScriptSceneContinuityGuide('music_video')}

${thumbnailAlignmentGuide}

${buildPromptStudioStepBlock('music_video', 'script')}

${buildPromptStudioStepBlock('music_video', 'scene')}

${songProductionGuide}

${lyricsOutputGuide}

[MUSIC VIDEO FLOW]
${summary}

[CURRENT DRAFT]
${currentDraft}`;
  const characterPrompt = `${bundle.story}

[GLOBAL EXECUTION RULE]
${globalExecutionGuide}

[CONCEPT LOCK]
${conceptLock}

${workflowLinkGuide}

${freshnessGuide}

${scriptSceneContinuityGuide}

${conceptFolderGuide}

${characterFolderGuide}

${styleFolderGuide}

${characterGenerationGuide}

${characterOutputGuide}

[CHARACTERS]
${summary}

[SCRIPT]
${currentDraft}`;
  const scenePrompt = `${bundle.story}

[GLOBAL EXECUTION RULE]
${globalExecutionGuide}

[CONCEPT LOCK]
${conceptLock}

${workflowLinkGuide}

${freshnessGuide}

${scriptSceneContinuityGuide}

${thumbnailAlignmentGuide}

${conceptFolderGuide}

${sceneFolderGuide}

${styleFolderGuide}

${sceneMotionGuide}

${sceneOutputGuide}

[SCENE PROMPTS]
${summary}

[SCRIPT]
${currentDraft}`;
  const actionPrompt = `${bundle.story}

[GLOBAL EXECUTION RULE]
${globalExecutionGuide}

[CONCEPT LOCK]
${conceptLock}

${workflowLinkGuide}

${freshnessGuide}

${scriptSceneContinuityGuide}

${conceptFolderGuide}

${actionFolderGuide}

${styleFolderGuide}

${sceneMotionGuide}

${actionOutputGuide}

[SCENE ACTIONS]
${summary}

[SCRIPT]
${currentDraft}`;
  const persuasionStoryPrompt = `${bundle.story}

[GLOBAL EXECUTION RULE]
${globalExecutionGuide}

[CONCEPT LOCK]
${conceptLock}

[PARAGRAPH FLOW]
${paragraphGuide}

${workflowLinkGuide}

${freshnessGuide}

${scriptSceneContinuityGuide}

${thumbnailAlignmentGuide}

${conceptFolderGuide}

${scriptFolderGuide}

${songProductionGuide}

${options.contentType === 'music_video' ? lyricsOutputGuide : storyOutputGuide}

[RECOMMENDED PHRASES]
${bundle.recommendations.join('\n')}`;

  return { storyPrompt, lyricsPrompt, characterPrompt, scenePrompt, actionPrompt, persuasionStoryPrompt };
}

export function createBuiltInWorkflowPromptTemplates(
  contentType: ContentType,
  promptPack: WorkflowPromptPack
): WorkflowPromptTemplate[] {
  const conceptLabel = getContentTypePromptLabel(contentType);
  const isMusic = contentType === 'music_video';
  const corePrompt = isMusic ? promptPack.lyricsPrompt : promptPack.storyPrompt;
  const dialoguePrompt = `${promptPack.storyPrompt}\n\n추가 규칙:\n- 대화와 내레이션을 자연스럽게 섞어주세요.\n- Step 1에서 고른 콘셉트 톤을 흐리지 말고 유지해주세요.\n- 시각적이고 구체적인 문장을 우선해주세요.`;
  const sceneHeavyPrompt = `${promptPack.scenePrompt}\n\n추가 규칙:\n- 각 문단은 눈에 보이는 장면 전환으로 시작해주세요.\n- Step 1 콘셉트에 맞는 장면 결을 끝까지 유지해주세요.\n- 구체적인 시각적 포인트를 추가해주세요.`;
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
