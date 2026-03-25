import { AspectRatio, GeneratedAsset, ScriptScene, StorySelectionState, WorkflowDraft } from '../types';
import { buildFreshIdeaRule, createCreativeDirection } from '../config/creativeVariance';
import {
  buildLocalVisualPrompt,
  estimateClipDuration,
  makeScenePlaceholderImage,
  splitStoryIntoParagraphScenes,
} from '../utils/storyHelpers';

const SILENT_SCENE_MIN_SECONDS = 3;
const SILENT_SCENE_MAX_SECONDS = 6;
const SILENT_SCENE_TARGET_SECONDS = 5;

function isMuteDraft(draft: WorkflowDraft) {
  return draft.customScriptSettings?.language === 'mute';
}

function clampSilentSceneDuration(value: number) {
  return Math.min(SILENT_SCENE_MAX_SECONDS, Math.max(SILENT_SCENE_MIN_SECONDS, Number(value.toFixed(1))));
}

function getMuteSceneCount(draft: WorkflowDraft) {
  const minutes = Math.max(1, Math.round(draft.customScriptSettings?.expectedDurationMinutes || 1));
  const totalSeconds = minutes * 60;
  return Math.max(4, Math.ceil(totalSeconds / SILENT_SCENE_TARGET_SECONDS));
}

function getSelectedCharacterNames(draft: WorkflowDraft) {
  const selectedIds = draft.selectedCharacterIds?.length
    ? draft.selectedCharacterIds
    : (draft.extractedCharacters || []).map((item) => item.id);
  const names = (draft.extractedCharacters || [])
    .filter((item) => selectedIds.includes(item.id))
    .map((item) => item.name?.trim())
    .filter(Boolean) as string[];
  return names.length ? names : [draft.selections?.protagonist?.trim() || '주요 인물'];
}

function getContentModeGuide(draft: WorkflowDraft) {
  if (draft.contentType === 'music_video') {
    return '가사 없이도 리듬이 보이는 뮤직비디오형 장면';
  }
  if (draft.contentType === 'cinematic') {
    return '대사 없이 표정과 공간으로 밀어붙이는 영화형 장면';
  }
  if (draft.contentType === 'info_delivery') {
    return '설명 대신 흐름과 포인트가 보이는 정보 전달형 장면';
  }
  return '대사 없이 상황과 감정이 읽히는 스토리형 장면';
}

function isRealPersonStyle(draft: WorkflowDraft) {
  const selectedStyle = (draft.styleImages || []).find((item) => item.id === draft.selectedStyleImageId) || null;
  const raw = [
    draft.selectedCharacterStyleLabel,
    draft.selectedCharacterStylePrompt,
    selectedStyle?.label,
    selectedStyle?.groupLabel,
    selectedStyle?.prompt,
    ...(draft.characterImages || []).map((item) => item.label),
    ...(draft.characterImages || []).map((item) => item.prompt),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /(실사|real human|photoreal|photorealistic|live action|realistic portrait|korean presenter)/.test(raw);
}

function getLanguageLabel(draft: WorkflowDraft) {
  const language = (draft.customScriptSettings?.language || 'ko').trim().toLowerCase();
  if (language === 'mute') return 'silent / no spoken language';
  if (language.startsWith('en')) return 'English';
  if (language.startsWith('ja')) return 'Japanese';
  if (language.startsWith('zh')) return 'Chinese';
  if (language.startsWith('es')) return 'Spanish';
  if (language.startsWith('fr')) return 'French';
  if (language.startsWith('de')) return 'German';
  return language === 'ko' ? 'Korean' : language;
}

function buildLipSyncGuide(draft: WorkflowDraft) {
  const languageLabel = getLanguageLabel(draft);
  if (draft.customScriptSettings?.language === 'mute') {
    return 'No lip-synced speech. Keep lips neutral and communicate with gaze, gesture, timing, and camera movement only.';
  }
  if (draft.contentType === 'music_video') {
    return `If vocals are present, the visible singer's mouth shapes must follow the sung phonemes in ${languageLabel}. During instrumental or no-vocal sections, avoid fake singing and focus on performance, gesture, and rhythm instead.`;
  }
  return `If narration or dialogue is present, the visible speaker's mouth shapes must follow the spoken phonemes in ${languageLabel}. If the moment is silent, keep lips natural and let expression, posture, and action carry the scene.`;
}

function buildVisualTextureGuide(draft: WorkflowDraft) {
  if (isRealPersonStyle(draft)) {
    return 'If the chosen style is photoreal or live action, the character must read as a natural Korean person, with believable skin texture, hair strands, fabric detail, lens depth, and lighting continuity that blends into real video.';
  }
  if (draft.contentType === 'music_video') {
    return 'Keep the selected art style consistent across scenes, with readable silhouettes, animation-friendly motion clarity, clean backgrounds that do not overpower the performer, and texture detail that still feels natural in motion video.';
  }
  return 'Keep the selected art style consistent across scenes, with clean silhouette, readable face, stable lighting logic, and texture detail that still feels natural in motion video.';
}

function buildMuteSceneNarration(draft: WorkflowDraft, index: number, total: number) {
  const topic = draft.topic?.trim() || '새 프로젝트';
  const selections: StorySelectionState = draft.selections || { genre: '', mood: '', endingTone: '', setting: '', protagonist: '', conflict: '' };
  const protagonist = selections.protagonist?.trim() || '주요 인물';
  const setting = selections.setting?.trim() || '주요 배경';
  const mood = selections.mood?.trim() || '집중감 있는';
  const conflict = selections.conflict?.trim() || '핵심 변화';
  const endingTone = selections.endingTone?.trim() || '여운 있는';
  const characterNames = getSelectedCharacterNames(draft).join(', ');
  const direction = createCreativeDirection(`${draft.contentType}:mute:${topic}:${index + 1}`, index, draft.contentType);
  const progress = total <= 1 ? 1 : index / (total - 1);

  if (progress < 0.16) {
    return `${setting}의 공기와 소품을 먼저 보여 주며 "${topic}"의 분위기를 연다. ${characterNames}의 등장은 짧게 스치게 하고, ${mood} 무드와 ${direction.visualHook} 중심으로 오프닝을 만든다.`;
  }
  if (progress < 0.34) {
    return `${protagonist}와 ${characterNames}의 움직임을 따라가며 ${topic}의 핵심 단서를 시각적으로 드러낸다. 설명 없이도 ${setting} 안에서 무엇이 중요한지 읽히게 만들고, ${direction.narrativeAngle} 흐름을 유지한다.`;
  }
  if (progress < 0.58) {
    return `${conflict}이 점점 또렷해지는 구간이다. 인물의 시선, 손동작, 주변 사물 변화를 통해 긴장을 쌓고, ${mood} 톤을 유지한 채 화면 정보만으로 다음 전개를 예고한다.`;
  }
  if (progress < 0.8) {
    return `${topic}의 중심 감정이 가장 강하게 보이는 장면이다. ${characterNames}의 관계 변화와 공간 반응을 함께 보여 주고, 카메라 움직임과 조명 변화만으로 몰입도를 끌어올린다.`;
  }
  return `${endingTone} 여운으로 마무리하는 장면이다. 해결보다 잔상과 다음 상상을 남기는 구도로 정리하고, ${topic}를 상징하는 마지막 화면 요소가 또렷하게 남게 만든다.`;
}

function buildLocalVideoPrompt(narration: string, sceneNumber: number, draft: WorkflowDraft, targetDuration: number) {
  const direction = createCreativeDirection(`${draft.contentType}:local-motion:${sceneNumber}:${narration}`, sceneNumber, draft.contentType);
  const contentGuide = getContentModeGuide(draft);
  return [
    `${contentGuide}. Scene ${sceneNumber}.`,
    `Create a ${targetDuration.toFixed(1)} second motion beat that starts from this narration: ${narration}`,
    buildFreshIdeaRule('motion'),
    `Use ${direction.shotType}. ${direction.cameraLanguage}`,
    `Movement focus: ${direction.transitionBeat}`,
    `Lighting: ${direction.lightingDirection}. Palette: ${direction.paletteDirection}.`,
    buildLipSyncGuide(draft),
    buildVisualTextureGuide(draft),
    'Show one clear action or emotional shift, keep the main subject readable, and avoid subtitle dependence or watermark.',
    'Keep character identity and visual continuity consistent with the previous and next scenes.',
  ].join(' ');
}

function buildMuteVideoPrompt(narration: string, sceneNumber: number, draft: WorkflowDraft, targetDuration: number) {
  const direction = createCreativeDirection(`${draft.contentType}:motion:${sceneNumber}:${narration}`, sceneNumber, draft.contentType);
  const style = getContentModeGuide(draft);
  return [
    `${style}. Scene ${sceneNumber}.`,
    `Create a ${targetDuration.toFixed(1)} second motion beat with no spoken dialogue or narration.`,
    `Base the action on this visual beat: ${narration}`,
    buildFreshIdeaRule('motion'),
    `Use ${direction.shotType}. ${direction.cameraLanguage}`,
    `Movement focus: ${direction.transitionBeat}`,
    `Lighting: ${direction.lightingDirection}. Palette: ${direction.paletteDirection}.`,
    buildVisualTextureGuide(draft),
    'The motion must read clearly even on mute, relying on body movement, object interaction, environment change, rhythm, and camera movement only.',
    'No lip-synced speech, no subtitle dependence, no text overlay, keep character identity consistent across scenes.',
  ].join(' ');
}

function buildAutoMuteScene(draft: WorkflowDraft, index: number, total: number): ScriptScene {
  const aspectRatio: AspectRatio = draft.aspectRatio || '16:9';
  const totalSeconds = Math.max(60, Math.round((draft.customScriptSettings?.expectedDurationMinutes || 1) * 60));
  const targetDuration = clampSilentSceneDuration(totalSeconds / Math.max(1, total));
  const narration = buildMuteSceneNarration(draft, index, total);
  const imagePrompt = buildLocalVisualPrompt(narration, index + 1, draft.contentType, aspectRatio);

  return {
    sceneNumber: index + 1,
    narration,
    visualPrompt: imagePrompt,
    imagePrompt,
    videoPrompt: buildMuteVideoPrompt(narration, index + 1, draft, targetDuration),
    analysis: {
      composition_type: narration.length > 85 ? 'STANDARD' : 'MICRO',
      sentiment: 'NEUTRAL',
    },
    targetDuration,
    aspectRatio,
  };
}

export function createLocalScenesFromDraft(draft: WorkflowDraft): ScriptScene[] {
  const aspectRatio: AspectRatio = draft.aspectRatio || '16:9';
  const paragraphs = splitStoryIntoParagraphScenes(draft.script || '');
  if (paragraphs.length) {
    return paragraphs.map((paragraph, index) => ({
      sceneNumber: index + 1,
      narration: paragraph,
      visualPrompt: buildLocalVisualPrompt(paragraph, index + 1, draft.contentType, aspectRatio),
      imagePrompt: buildLocalVisualPrompt(paragraph, index + 1, draft.contentType, aspectRatio),
      videoPrompt: buildLocalVideoPrompt(paragraph, index + 1, draft, estimateClipDuration(paragraph)),
      analysis: {
        composition_type: paragraph.length > 85 ? 'STANDARD' : 'MICRO',
        sentiment: 'NEUTRAL',
      },
      targetDuration: estimateClipDuration(paragraph),
      aspectRatio,
    }));
  }

  if (isMuteDraft(draft)) {
    const total = getMuteSceneCount(draft);
    return Array.from({ length: total }, (_, index) => buildAutoMuteScene(draft, index, total));
  }

  return [];
}

export function buildSelectedPromptContextFromDraft(draft: WorkflowDraft) {
  const resolvedCharacterIds = (draft.selectedCharacterIds && draft.selectedCharacterIds.length)
    ? draft.selectedCharacterIds
    : (draft.extractedCharacters || []).map((item) => item.id);
  const selectedCharacters = (draft.extractedCharacters || []).filter((item) =>
    resolvedCharacterIds.includes(item.id)
  );
  const characterPromptBlock = selectedCharacters
    .map((character, index) => {
      const pickedImage = (character.generatedImages || []).find((image) => image.id === character.selectedImageId);
      const appliedPrompt = pickedImage?.prompt || character.prompt || character.description || '';
      const roleLabel =
        character.roleLabel ||
        character.rolePrompt ||
        character.description ||
        (character.role === 'lead' ? '주인공' : `조연 ${index + 1}`);
      if (draft.contentType === 'music_video') {
        return `- ${character.name} (${roleLabel}): based on reference images. Keep the selected identity consistent and do not rewrite face, hair, or outfit from scratch.${pickedImage?.label ? ` Reference label: ${pickedImage.label}.` : ''}`;
      }
      return appliedPrompt
        ? `- ${character.name} (${roleLabel}): keep the same identity as the selected reference image.${pickedImage?.label ? ` Reference label: ${pickedImage.label}.` : ''} Fallback identity cue: ${appliedPrompt.slice(0, 180)}`
        : `- ${character.name} (${roleLabel}): based on reference images.`;
    })
    .filter(Boolean)
    .join('\n');
  const selectedStyle = (draft.styleImages || []).find((item) => item.id === draft.selectedStyleImageId) || (draft.styleImages || [])[0];
  const selectedPromptTemplate = (draft.promptTemplates || []).find((item) => item.id === draft.selectedPromptTemplateId);

  return {
    characterPromptBlock,
    characterStylePrompt: draft.selectedCharacterStylePrompt || '',
    characterStyleLabel: draft.selectedCharacterStyleLabel || '',
    stylePrompt: selectedStyle?.prompt || '',
    styleLabel: selectedStyle?.groupLabel || selectedStyle?.label || '',
    promptTemplateName: selectedPromptTemplate?.name || '',
    promptTemplatePrompt: selectedPromptTemplate?.prompt || '',
    scenePrompt: draft.promptPack?.scenePrompt || '',
    actionPrompt: draft.promptPack?.actionPrompt || '',
    storyPrompt: draft.promptPack?.storyPrompt || '',
  };
}

export function applySelectionPromptsToScenes(scenes: ScriptScene[], draft: WorkflowDraft): ScriptScene[] {
  const promptContext = buildSelectedPromptContextFromDraft(draft);
  const selectionSummary = [
    `[PROJECT TOPIC] ${draft.topic || 'untitled project'}`,
    `[CONTENT TYPE] ${draft.contentType}`,
    `[ASPECT RATIO] ${draft.aspectRatio || '16:9'}`,
    `[OUTPUT MODE] ${draft.outputMode || 'video'}`,
    `[SELECTIONS] 장르=${draft.selections?.genre || ''}, 분위기=${draft.selections?.mood || ''}, 배경=${draft.selections?.setting || ''}, 주인공=${draft.selections?.protagonist || ''}, 갈등=${draft.selections?.conflict || ''}, 결말톤=${draft.selections?.endingTone || ''}`,
  ].join('\n');

  return scenes.map((scene, index) => {
    const previousScene = scenes[index - 1];
    const nextScene = scenes[index + 1];
    const direction = createCreativeDirection(`${draft.contentType}:${scene.sceneNumber}:${scene.narration}`, index, draft.contentType);
    return {
      ...scene,
      visualPrompt: [
        scene.imagePrompt || scene.visualPrompt,
        selectionSummary,
        promptContext.promptTemplateName ? `[SELECTED SCRIPT TEMPLATE] ${promptContext.promptTemplateName}` : '',
        promptContext.promptTemplatePrompt ? `[SELECTED TEMPLATE PROMPT]\n${promptContext.promptTemplatePrompt}` : '',
        promptContext.storyPrompt ? `[STORY PROMPT]\n${promptContext.storyPrompt}` : '',
        promptContext.scenePrompt ? `[SCENE PROMPT]\n${promptContext.scenePrompt}` : '',
        promptContext.actionPrompt ? `[ACTION PROMPT]\n${promptContext.actionPrompt}` : '',
        promptContext.characterPromptBlock ? `[SELECTED CHARACTER REFERENCES]\n${promptContext.characterPromptBlock}` : '',
        promptContext.stylePrompt ? `[SELECTED STYLE PROMPT]\n${promptContext.stylePrompt}` : '',
        draft.contentType === 'music_video' ? '[MUSIC VIDEO IMAGE RULE] One image = one key moment. Keep scene order chronological. When a character appears, prefer the phrase based on reference images instead of rewriting appearance in detail. Avoid readable signs, logo-like graphics, and unnecessary background clutter unless the story explicitly needs them.' : '',
        promptContext.styleLabel ? `[STYLE LABEL] ${promptContext.styleLabel}` : '',
        buildFreshIdeaRule('scene'),
        `[SCENE ANGLE] ${direction.narrativeAngle}`,
        `[SHOT TYPE] ${direction.shotType}`,
        `[LIGHTING / PALETTE] ${direction.lightingDirection} / ${direction.paletteDirection}`,
        `[VISUAL HOOK] ${direction.visualHook}`,
        `[SUBTITLE RHYTHM] ${direction.subtitleTone}`,
        previousScene?.narration ? `[PREVIOUS SCENE CONTEXT] ${previousScene.narration}` : '',
        nextScene?.narration ? `[NEXT SCENE CONTEXT] ${nextScene.narration}` : '',
        `[SCENE RULE] Scene ${index + 1} must keep the selected character roles, selected prompt template, and selected style prompt consistent, but it must not reuse the exact same framing or visual hook as the previous scene.`,
        draft.contentType === 'music_video' ? `[MOTION RULE] Motion for scene ${index + 1} should feel like one short, copy-ready action line. Avoid restating clothing, hairstyle, or background details unless absolutely necessary.` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    };
  });
}

export function createLightweightSceneAssetsFromDraft(draft: WorkflowDraft): GeneratedAsset[] {
  return applySelectionPromptsToScenes(createLocalScenesFromDraft(draft), draft).map((scene) => ({
    ...scene,
    imageData: null,
    audioData: null,
    audioDuration: null,
    subtitleData: null,
    videoData: null,
    videoDuration: null,
    targetDuration: scene.targetDuration || estimateClipDuration(scene.narration),
    sourceMode: 'sample',
    selectedVisualType: 'image',
    status: 'pending',
    imageHistory: [],
    videoHistory: [],
  }));
}

export function createInitialSceneAssetsFromDraft(draft: WorkflowDraft): GeneratedAsset[] {
  const aspectRatio: AspectRatio = draft.aspectRatio || '16:9';
  return createLightweightSceneAssetsFromDraft(draft).map((scene) => ({
    ...scene,
    imageData: makeScenePlaceholderImage(scene.sceneNumber, scene.narration, aspectRatio),
  }));
}

export function createAdditionalSceneAssetFromDraft(draft: WorkflowDraft, sceneNumber: number): GeneratedAsset {
  const fallbackNarration = `추가 문단 ${sceneNumber}. ${draft.topic || '현재 주제'} 흐름을 이어 가는 장면으로 전환하고, 앞 장면과 겹치지 않는 새 행동이나 감정 변화를 보여 준다.`;
  const sourceScene = draft.customScriptSettings?.language === 'mute'
    ? buildAutoMuteScene(draft, Math.max(0, sceneNumber - 1), Math.max(4, sceneNumber))
    : {
        sceneNumber,
        narration: fallbackNarration,
        visualPrompt: buildLocalVisualPrompt(fallbackNarration, sceneNumber, draft.contentType, draft.aspectRatio || '16:9'),
        imagePrompt: buildLocalVisualPrompt(fallbackNarration, sceneNumber, draft.contentType, draft.aspectRatio || '16:9'),
        videoPrompt: buildLocalVideoPrompt(fallbackNarration, sceneNumber, draft, clampSilentSceneDuration(SILENT_SCENE_TARGET_SECONDS)),
        analysis: {
          composition_type: 'STANDARD' as const,
          sentiment: 'NEUTRAL' as const,
        },
        targetDuration: clampSilentSceneDuration(SILENT_SCENE_TARGET_SECONDS),
        aspectRatio: draft.aspectRatio || '16:9',
      };
  const aspectRatio: AspectRatio = draft.aspectRatio || '16:9';
  const appliedScene = applySelectionPromptsToScenes([sourceScene], draft)[0] || sourceScene;
  return {
    ...appliedScene,
    sceneNumber,
    imageData: makeScenePlaceholderImage(sceneNumber, appliedScene.narration, aspectRatio),
    audioData: null,
    audioDuration: null,
    subtitleData: null,
    videoData: null,
    videoDuration: null,
    targetDuration: appliedScene.targetDuration || clampSilentSceneDuration(SILENT_SCENE_TARGET_SECONDS),
    sourceMode: 'sample',
    selectedVisualType: 'image',
    status: 'pending',
    imageHistory: [],
    videoHistory: [],
  };
}
