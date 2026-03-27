import { CharacterProfile, PromptedImageAsset, SavedProject, ScriptScene } from '../types';
import { buildCreativeDirectionBlock, buildGenerationSignature } from '../config/creativeVariance';
import {
  buildConceptDirectionLines,
  buildMarkdownSection,
  buildSimilarityControlLines,
  joinPromptBlocks,
} from './promptMarkdown';

export interface ThumbnailComposerOptions {
  titleText?: string;
  subtitleText?: string;
  backgroundText?: string;
  leadCharacterId?: string | null;
  leadDirectionText?: string;
  extraDirectionText?: string;
  customPrompt?: string;
  similarPrompt?: string;
}

const SAMPLE_THUMBNAIL_BACKGROUNDS = [
  '/mp4Creater/samples/styles/cold_rational_architecture.png',
  '/mp4Creater/samples/styles/dawn_of_recovery.png',
  '/mp4Creater/samples/styles/dynamic_road_sprint.png',
  '/mp4Creater/samples/styles/ethereal_dreamscape_fog.png',
  '/mp4Creater/samples/styles/minimal_purity_void.png',
  '/mp4Creater/samples/styles/mysterious_night_cityscape.png',
  '/mp4Creater/samples/styles/nostalgic_film_fragments.png',
  '/mp4Creater/samples/styles/radiant_nature_bliss.png',
  '/mp4Creater/samples/styles/soft_pastel_first_blush.png',
  '/mp4Creater/samples/styles/still_moment_dust.png',
  '/mp4Creater/samples/styles/unyielding_landscape_grit.png',
  '/mp4Creater/samples/styles/vibrant_festival_lights.png',
] as const;

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function pickSampleThumbnailBackground(project: SavedProject, variantSeed: number, options: ThumbnailComposerOptions = {}) {
  const seed = [
    project.id || project.name || project.topic || 'thumbnail',
    project.workflowDraft?.selectedStyleImageId || '',
    options.customPrompt || '',
    options.titleText || '',
    options.similarPrompt || '',
    String(variantSeed),
  ].join('|');
  return SAMPLE_THUMBNAIL_BACKGROUNDS[hashSeed(seed) % SAMPLE_THUMBNAIL_BACKGROUNDS.length];
}

function pickLeadCharacter(project: SavedProject, options?: ThumbnailComposerOptions): CharacterProfile | null {
  const draft = project.workflowDraft;
  if (!draft?.extractedCharacters?.length) return null;
  const selected = draft.extractedCharacters.filter((item) => draft.selectedCharacterIds.includes(item.id));
  if (options?.leadCharacterId) {
    return selected.find((item) => item.id === options.leadCharacterId)
      || draft.extractedCharacters.find((item) => item.id === options.leadCharacterId)
      || selected.find((item) => item.role === 'lead')
      || selected[0]
      || draft.extractedCharacters[0]
      || null;
  }
  return selected.find((item) => item.role === 'lead') || selected[0] || draft.extractedCharacters[0] || null;
}

function pickSelectedStyle(project: SavedProject): PromptedImageAsset | null {
  const draft = project.workflowDraft;
  if (!draft?.styleImages?.length) return null;
  return draft.styleImages.find((item) => item.id === draft.selectedStyleImageId) || draft.styleImages[0] || null;
}

function buildTitleFromTopic(topic: string, override?: string) {
  const safe = (override || topic || '지금 꼭 봐야 할 장면').trim() || '지금 꼭 봐야 할 장면';
  const trimmed = safe.length > 22 ? `${safe.slice(0, 22)}…` : safe;
  return trimmed;
}

function buildSceneSnippet(project: SavedProject, override?: string) {
  const narration = override || project.assets?.[0]?.narration || project.workflowDraft?.script || project.topic || '장면을 요약하는 문장';
  return narration.replace(/\s+/g, ' ').trim().slice(0, 78);
}

export function buildThumbnailLabel(project: SavedProject, customPrompt?: string) {
  const promptLabel = (customPrompt || '').replace(/\s+/g, ' ').trim();
  if (promptLabel) {
    return promptLabel.length > 28 ? `${promptLabel.slice(0, 28)}…` : promptLabel;
  }
  const fallback = (project.thumbnailTitle || project.topic || project.name || '프로젝트 썸네일').trim() || '프로젝트 썸네일';
  return fallback.length > 28 ? `${fallback.slice(0, 28)}…` : fallback;
}

function buildThumbnailStoryBeat(project: SavedProject) {
  const candidates = [
    ...(project.assets || []).map((item) => item.narration || ''),
    project.workflowDraft?.script || '',
    project.topic || '',
  ]
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const joined = candidates.slice(0, 3).join(' / ');
  return joined.slice(0, 320);
}

export function buildThumbnailPrompt(project: SavedProject, variantSeed = 0, options: ThumbnailComposerOptions = {}) {
  const lead = pickLeadCharacter(project, options);
  const style = pickSelectedStyle(project);
  const draft = project.workflowDraft;
  const rolePrompts = project.prompts?.rolePrompts || draft?.promptStore?.rolePrompts;
  const customPrompt = options.customPrompt?.trim();
  const title = buildTitleFromTopic(project.topic || project.name || '프로젝트 썸네일', options.titleText || undefined);
  const subtitle = buildSceneSnippet(project, options.subtitleText);
  const storyBeat = buildThumbnailStoryBeat(project);
  const backgroundHint = options.backgroundText?.trim() || draft?.selections?.setting || '핵심 사건이 벌어지는 공간';
  const mood = draft?.selections?.mood || '선명하고 강한 감정';
  const leadPrompt = options.leadDirectionText?.trim() || lead?.prompt || lead?.description || '핵심 감정을 보여주는 주인공 상반신 클로즈업';
  const stylePrompt = style?.prompt || '깔끔하고 클릭을 부르는 유튜브 썸네일 아트 디렉션';
  const extraDirection = options.extraDirectionText?.trim();
  const similarDirection = options.similarPrompt?.trim() || '';
  const selectedTemplate = draft?.promptTemplates?.find((item) => item.id === draft?.selectedPromptTemplateId) || draft?.promptTemplates?.[0] || null;
  const selectionSummary = [
    `콘텐츠 타입 ${draft?.contentType || 'story'}`,
    `비율 ${draft?.aspectRatio || '16:9'}`,
    draft?.selections?.genre ? `장르 ${draft.selections.genre}` : '',
    draft?.selections?.mood ? `분위기 ${draft.selections.mood}` : '',
    draft?.selections?.setting ? `배경 ${draft.selections.setting}` : '',
    draft?.selections?.protagonist || lead?.name ? `주인공 ${draft?.selections?.protagonist || lead?.name}` : '',
    draft?.selections?.conflict ? `갈등 ${draft.selections.conflict}` : '',
    draft?.selections?.endingTone ? `엔딩 톤 ${draft.selections.endingTone}` : '',
  ].filter(Boolean).join(' · ');
  const packSummary = [
    rolePrompts?.script?.finalPrompt ? `대본 프롬프트 ${rolePrompts.script.finalPrompt}` : draft?.promptPack?.storyPrompt ? `스토리 프롬프트 ${draft.promptPack.storyPrompt}` : '',
    rolePrompts?.character?.finalPrompt ? `캐릭터 프롬프트 ${rolePrompts.character.finalPrompt}` : '',
    rolePrompts?.style?.finalPrompt ? `스타일 프롬프트 ${rolePrompts.style.finalPrompt}` : '',
    rolePrompts?.scene?.finalPrompt ? `장면 프롬프트 ${rolePrompts.scene.finalPrompt}` : draft?.promptPack?.scenePrompt ? `씬 프롬프트 ${draft.promptPack.scenePrompt}` : '',
    rolePrompts?.video?.finalPrompt ? `영상 프롬프트 ${rolePrompts.video.finalPrompt}` : draft?.promptPack?.actionPrompt ? `액션 프롬프트 ${draft.promptPack.actionPrompt}` : '',
    rolePrompts?.backgroundMusic?.finalPrompt ? `배경음 프롬프트 ${rolePrompts.backgroundMusic.finalPrompt}` : '',
    selectedTemplate?.prompt ? `선택 템플릿 ${selectedTemplate.prompt}` : '',
  ].filter(Boolean).join(' · ');
  const sceneReferenceSummary = (project.assets || [])
    .slice(0, 4)
    .map((item) => [item.narration, item.imagePrompt || item.visualPrompt].filter(Boolean).join(' / '))
    .filter(Boolean)
    .join(' · ');
  const freshnessMode = similarDirection ? 'similar' : 'fresh';
  const creativeBlock = buildCreativeDirectionBlock({
    task: 'image',
    seedText: `${project.id || project.name || project.topic}:${title}:${subtitle}:${similarDirection || customPrompt || ''}`,
    index: variantSeed,
    mode: freshnessMode,
    contentType: draft?.contentType,
  });
  return joinPromptBlocks([
    buildMarkdownSection('Goal', [
      'Create a Korean YouTube thumbnail art direction.',
      `[GENERATION SIGNATURE] ${buildGenerationSignature('image', `${project.id || project.name || project.topic}:${variantSeed}`, variantSeed)}`,
      'The thumbnail must read as the final representative cut that summarizes Step1 through Step6 in one glance.',
    ]),
    buildMarkdownSection('Concept Direction', [
      ...buildConceptDirectionLines(draft?.contentType || 'story', 'thumbnail'),
      'Keep the thumbnail in the same world, same emotional arc, and same character relationships as the main video.',
    ]),
    buildMarkdownSection('Similarity Control', [
      ...buildSimilarityControlLines(),
      similarDirection
        ? 'The user asked for a similar thumbnail. Preserve the core character, composition family, color energy, and click hook while still creating a new adjacent variation.'
        : 'Default to a fresh representative cut with a new hook, new placement emphasis, or new gaze guidance inside the same project continuity.',
    ]),
    buildMarkdownSection('Project Summary', [
      `Project title: ${project.topic || project.name || 'Project'}.`,
      `Step1 format: ${draft?.contentType || 'story'} / ${draft?.aspectRatio || '16:9'}.`,
      `Step2 world: ${selectionSummary || 'Default story setup'}.`,
      `Step3 core beat: ${storyBeat || subtitle}.`,
      `Thumbnail main line: ${title}.`,
      `Thumbnail support line: ${subtitle}.`,
      `Lead character hint: ${leadPrompt}.`,
      `Background / space hint: ${backgroundHint}.`,
      `Mood: ${mood}.`,
      `Step5 style hint: ${stylePrompt}.`,
    ]),
    sceneReferenceSummary ? buildMarkdownSection('Step6 Scene Reference', [sceneReferenceSummary], { bullet: false }) : '',
    packSummary ? buildMarkdownSection('Workflow Prompt Pack', [packSummary], { bullet: false }) : '',
    buildMarkdownSection('Extra Direction', [
      customPrompt ? `User direction: ${customPrompt}. Blend it naturally into the default art direction.` : 'No extra user direction. Maximize quality from the workflow context alone.',
      extraDirection ? `Additional staging: ${extraDirection}.` : '',
      similarDirection ? `Near-match reference: ${(similarDirection || '').slice(0, 220)}.` : '',
      creativeBlock,
    ], { bullet: false }),
    buildMarkdownSection('Do Not', [
      'Do not make the thumbnail feel unrelated to the video world.',
      'Do not let text placement and image storytelling fight each other.',
      'No watermark, clutter, weak focal point, or low-contrast layout.',
      'Use a 16:9 composition with strong readability and an immediate click-worthy focal hierarchy.',
      `Thumbnail variant ${variantSeed + 1}.`,
    ]),
  ]);

  return [
    '한국어 유튜브 썸네일 생성용 아트 디렉션.',
    `[GENERATION SIGNATURE] ${buildGenerationSignature('image', `${project.id || project.name || project.topic}:${variantSeed}`, variantSeed)}`,
    creativeBlock,
    similarDirection
      ? '비슷하게 재생성 모드다. 선택 썸네일의 핵심 인물, 구도 계열, 색감 결, 텍스트 무게중심은 유지하되 복제본이 아니라 새 근접 변형을 만든다.'
      : '새롭게 생성 모드다. 같은 프로젝트 안에서 일관성은 유지하되 직전 썸네일 후보와 다른 훅, 다른 배치 포인트, 다른 시선 유도를 우선한다.',
    '개발단 기본 규칙: 썸네일은 Step1~Step6 전체를 종합한 최종 대표 컷이어야 하며, 대본과 같은 맥락, 같은 감정선, 같은 인물 관계가 한눈에 보여야 한다.',
    `프로젝트 제목: ${project.topic || project.name || '프로젝트'}.`,
    `Step1 형식: ${draft?.contentType || 'story'} / ${draft?.aspectRatio || '16:9'}.`,
    `Step2 세계관: ${selectionSummary || '기본 스토리 구성'}.`,
    `메인 문구: ${title}. 너무 길게 넣지 말고 크게, 즉시 읽히게 배치한다.`,
    `보조 문구 힌트: ${subtitle}.`,
    `Step3 대본 핵심 감정: ${storyBeat || '첫 장면과 핵심 대사 기준'}.`,
    `주인공/표정/포즈: ${lead?.name || '주인공'} / ${leadPrompt}.`,
    `Step4 캐릭터 기준: ${lead?.prompt || lead?.description || lead?.name || '주인공 기준 유지'}.`,
    `배경/공간 힌트: ${backgroundHint}.`,
    `분위기: ${mood}.`,
    `Step5 스타일 힌트: ${stylePrompt}.`,
    sceneReferenceSummary ? `Step6 실제 씬 기준: ${sceneReferenceSummary}.` : '',
    packSummary ? `워크플로우 프롬프트 팩: ${packSummary}.` : '',
    customPrompt ? `사용자 추가 요청: ${customPrompt}. 이 요청은 기본 연출 위에 자연스럽게 덧입힌다.` : '사용자 추가 요청이 없으면 기본 연출만으로 완성도 높게 구성한다.',
    extraDirection ? `추가 연출: ${extraDirection}.` : '',
    similarDirection ? `직전 후보의 결 유지: ${similarDirection.slice(0, 220)}.` : '',
    '16:9 비율, 고대비, 클릭을 부르는 집중 구도, 인물과 사건이 즉시 이해되는 썸네일, 워터마크와 과한 군더더기 금지.',
    `썸네일 변형 ${variantSeed + 1}.`,
  ].filter(Boolean).join(' ');
}

export function createSampleThumbnail(project: SavedProject, variantSeed = 0, options: ThumbnailComposerOptions = {}): { dataUrl: string; title: string; prompt: string } {
  const customPrompt = options.customPrompt?.trim();
  const title = buildThumbnailLabel(project, customPrompt || options.titleText);
  return {
    dataUrl: pickSampleThumbnailBackground(project, variantSeed, options),
    title,
    prompt: buildThumbnailPrompt(project, variantSeed, options),
  };
}

export function buildThumbnailScene(project: SavedProject, variantSeed = 0, options: ThumbnailComposerOptions = {}): ScriptScene {
  return {
    sceneNumber: 1,
    narration: buildSceneSnippet(project, options.subtitleText),
    visualPrompt: buildThumbnailPrompt(project, variantSeed, options),
    targetDuration: 5,
    aspectRatio: '16:9',
  };
}
