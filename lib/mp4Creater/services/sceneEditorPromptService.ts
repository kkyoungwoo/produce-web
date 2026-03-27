import { CONFIG } from '../config';
import { buildCreativeDirectionBlock, createCreativeDirection } from '../config/creativeVariance';
import { GeneratedAsset, WorkflowDraft } from '../types';
import { buildSelectedPromptContextFromDraft } from './sceneAssemblyService';
import { runTextAi } from './textAiService';

export type SceneEditorPromptMode = 'narration' | 'image' | 'video';

interface GenerateSceneEditorContentOptions {
  mode: SceneEditorPromptMode;
  draft: WorkflowDraft;
  asset: GeneratedAsset;
  previousAsset?: GeneratedAsset | null;
  nextAsset?: GeneratedAsset | null;
  model?: string | null;
}

function normalizeInlineText(value?: string | null, max = 260) {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}...`;
}

function resolveNarrationLanguageLabel(draft: WorkflowDraft) {
  const language = `${draft.customScriptSettings?.language || 'ko'}`.trim().toLowerCase();
  if (language === 'mute') return 'English';
  if (language.startsWith('en')) return 'English';
  if (language.startsWith('ja')) return 'Japanese';
  if (language.startsWith('zh')) return 'Chinese';
  if (language.startsWith('vi')) return 'Vietnamese';
  if (language.startsWith('mn')) return 'Mongolian';
  if (language.startsWith('th')) return 'Thai';
  if (language.startsWith('uz')) return 'Uzbek';
  return 'Korean';
}

function buildNoTextFrameRule() {
  return 'Do not rely on readable text in frame. Avoid signage, storefront lettering, posters, UI, captions, labels, logo marks, and decorative typography. If background text is unavoidable, keep it abstract, cropped, blurred, or unreadable.';
}

function buildProjectContinuityBlock(draft: WorkflowDraft, asset: GeneratedAsset, previousAsset?: GeneratedAsset | null, nextAsset?: GeneratedAsset | null) {
  const promptContext = buildSelectedPromptContextFromDraft(draft);
  const selectedCharacters = (draft.selectedCharacterIds?.length
    ? draft.extractedCharacters.filter((item) => draft.selectedCharacterIds.includes(item.id))
    : draft.extractedCharacters
  )
    .map((item) => item.name?.trim())
    .filter(Boolean)
    .join(', ');

  return [
    `[PROJECT]
topic=${draft.topic || 'untitled project'}
contentType=${draft.contentType}
aspectRatio=${draft.aspectRatio || '16:9'}`,
    `[SCENE POSITION]
sceneNumber=${asset.sceneNumber}
previous=${normalizeInlineText(previousAsset?.narration, 180) || '(none)'}
current=${normalizeInlineText(asset.narration || asset.imagePrompt || asset.videoPrompt, 220) || '(empty)'}
next=${normalizeInlineText(nextAsset?.narration, 180) || '(none)'}`,
    selectedCharacters ? `[SELECTED CHARACTERS]
${selectedCharacters}` : '',
    promptContext.characterStylePrompt ? `[CHARACTER CONTINUITY]
${promptContext.characterStylePrompt}` : '',
    promptContext.stylePrompt ? `[STYLE CONTINUITY]
${promptContext.stylePrompt}` : '',
    promptContext.storyPrompt ? `[SCRIPT ROLE]
${promptContext.storyPrompt}` : '',
    promptContext.scenePrompt ? `[SCENE ROLE]
${promptContext.scenePrompt}` : '',
    promptContext.actionPrompt ? `[VIDEO ROLE]
${promptContext.actionPrompt}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildNarrationSystemPrompt(languageLabel: string) {
  return [
    'You rewrite only one short-form video scene narration line.',
    `Return natural ${languageLabel} speech that sounds ready to be spoken out loud.`,
    'Keep continuity with the surrounding scenes, but deliver a fresh new attempt instead of paraphrasing the last draft.',
    'Prioritize speech timing, mouth-shape-friendly pacing, and emotionally clear delivery over literary complexity.',
    'Return only the final narration text. No bullets, labels, quotes, or explanations.',
  ].join(' ');
}

function buildImageSystemPrompt() {
  return [
    'You write one production-ready image prompt for a single short-form video scene.',
    'Preserve story, character, and style continuity while still creating a fresh composition, emotional density, and camera idea.',
    'Make the prompt action-led, visually specific, and suitable as the first frame of a later image-to-video step.',
    'Return only the final prompt text in English. No labels or commentary.',
  ].join(' ');
}

function buildVideoSystemPrompt() {
  return [
    'You write one production-ready motion prompt for a single image-to-video scene.',
    'Preserve story, character, and style continuity while still creating a fresh motion concept, blocking, timing, and emotional intensity.',
    'Make the prompt action-led and camera-aware, and avoid text-heavy set dressing.',
    'Return only the final prompt text in English. No labels or commentary.',
  ].join(' ');
}

function buildNarrationUserPrompt(draft: WorkflowDraft, asset: GeneratedAsset, previousAsset?: GeneratedAsset | null, nextAsset?: GeneratedAsset | null) {
  const direction = buildCreativeDirectionBlock({
    task: 'script',
    seedText: `${Date.now()}:${draft.topic}:${asset.sceneNumber}:${asset.narration || asset.imagePrompt || ''}`,
    index: asset.sceneNumber,
    contentType: draft.contentType,
  });

  return [
    buildProjectContinuityBlock(draft, asset, previousAsset, nextAsset),
    `[CURRENT FIELD]
${asset.narration || '(empty)'}`,
    `[TASK]
Rewrite only the current scene narration. Keep the same story placement and continuity with the previous and next scenes, but make this try feel newly authored.

Rules:
- Keep it concise enough for one Step6 scene.
- Keep the spoken flow easy to articulate and sync to visible mouth movement.
- Do not summarize the whole story.
- Do not add stage directions, prompt labels, or camera language.
- If characters are speaking, make the line feel naturally speakable rather than literary.`,
    direction,
  ].join('\n\n');
}

function buildImageUserPrompt(draft: WorkflowDraft, asset: GeneratedAsset, previousAsset?: GeneratedAsset | null, nextAsset?: GeneratedAsset | null) {
  const currentField = asset.imagePrompt || asset.visualPrompt || '';
  const direction = buildCreativeDirectionBlock({
    task: 'image',
    seedText: `${Date.now()}:${draft.topic}:${asset.sceneNumber}:${currentField || asset.narration || ''}`,
    index: asset.sceneNumber,
    contentType: draft.contentType,
  });

  return [
    buildProjectContinuityBlock(draft, asset, previousAsset, nextAsset),
    `[CURRENT FIELD]
${currentField || '(empty)'}`,
    `[TASK]
Write a fresh Step6 image prompt for only this scene.

Rules:
- Focus on one decisive visible beat from the current scene.
- Preserve the selected character identity and selected style continuity.
- Vary composition, framing, camera distance, and emotional density from the most recent try.
- Keep the shot action-led, not text-led.
- Make it useful as the exact still frame that could animate naturally into a later scene video.
- Return plain prompt text only.`,
    `[NO TEXT RULE]
${buildNoTextFrameRule()}`,
    direction,
  ].join('\n\n');
}

function buildVideoUserPrompt(draft: WorkflowDraft, asset: GeneratedAsset, previousAsset?: GeneratedAsset | null, nextAsset?: GeneratedAsset | null) {
  const currentField = asset.videoPrompt || '';
  const direction = buildCreativeDirectionBlock({
    task: 'motion',
    seedText: `${Date.now()}:${draft.topic}:${asset.sceneNumber}:${currentField || asset.narration || asset.imagePrompt || ''}`,
    index: asset.sceneNumber,
    contentType: draft.contentType,
  });

  return [
    buildProjectContinuityBlock(draft, asset, previousAsset, nextAsset),
    `[CURRENT FIELD]
${currentField || '(empty)'}`,
    `[TASK]
Write a fresh Step6 motion prompt for only this scene.

Rules:
- Keep the same scene beat and continuity with the previous and next scenes.
- Emphasize body action, gaze, blocking, camera movement, and emotional timing.
- If speech is implied, the motion should leave room for believable lip-sync and motivated dialogue timing.
- Do not turn the scene into a text-reading setup.
- Return plain prompt text only.`,
    `[NO TEXT RULE]
${buildNoTextFrameRule()}`,
    direction,
  ].join('\n\n');
}

function buildNarrationFallback(draft: WorkflowDraft, asset: GeneratedAsset, previousAsset?: GeneratedAsset | null, nextAsset?: GeneratedAsset | null) {
  const direction = createCreativeDirection(`${Date.now()}:${draft.topic}:${asset.sceneNumber}:narration`, asset.sceneNumber, draft.contentType);
  const protagonist = draft.selections?.protagonist?.trim() || draft.extractedCharacters?.[0]?.name || '주인공';
  const topic = draft.topic?.trim() || '프로젝트';
  const currentBeat = normalizeInlineText(asset.narration, 120) || normalizeInlineText(asset.imagePrompt || asset.videoPrompt, 120) || `${topic}의 현재 장면`;
  const previousBeat = normalizeInlineText(previousAsset?.narration, 60);
  const nextBeat = normalizeInlineText(nextAsset?.narration, 60);

  return [
    previousBeat ? `${previousBeat}의 여운이 남은 채` : '',
    `${protagonist}의 감정이 더 짙어지며 ${currentBeat}의 핵심 순간이 드러난다.`,
    `${direction.narrativeAngle.replace(/\.$/, '')} 분위기로 이어지고, ${nextBeat ? `다음 장면의 ${nextBeat}로 자연스럽게 넘어갈 여지를 남긴다.` : '다음 장면으로 자연스럽게 넘어갈 여지를 남긴다.'}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildImageFallback(draft: WorkflowDraft, asset: GeneratedAsset) {
  const direction = createCreativeDirection(`${Date.now()}:${draft.topic}:${asset.sceneNumber}:image`, asset.sceneNumber, draft.contentType);
  return [
    `Scene ${asset.sceneNumber}.`,
    normalizeInlineText(asset.imagePrompt || asset.visualPrompt || asset.narration, 260) || 'One decisive scene beat.',
    `Shot design: ${direction.shotType}. ${direction.cameraLanguage}`,
    `Emotion and staging: ${direction.narrativeAngle}`,
    `Lighting: ${direction.lightingDirection}. Palette: ${direction.paletteDirection}.`,
    `Visual hook: ${direction.visualHook}`,
    'Preserve character identity and selected style continuity.',
    buildNoTextFrameRule(),
  ].join(' ');
}

function buildVideoFallback(draft: WorkflowDraft, asset: GeneratedAsset) {
  const direction = createCreativeDirection(`${Date.now()}:${draft.topic}:${asset.sceneNumber}:video`, asset.sceneNumber, draft.contentType);
  return [
    `Scene ${asset.sceneNumber}.`,
    normalizeInlineText(asset.videoPrompt || asset.imagePrompt || asset.narration, 260) || 'One decisive motion beat.',
    `Motion direction: ${direction.transitionBeat}`,
    `Camera language: ${direction.cameraLanguage}`,
    `Action focus: ${direction.narrativeAngle}`,
    `Lighting continuity: ${direction.lightingDirection}. Palette: ${direction.paletteDirection}.`,
    'Keep character identity and scene continuity stable, with readable action and no text-led background details.',
    buildNoTextFrameRule(),
  ].join(' ');
}

export async function generateSceneEditorContent(options: GenerateSceneEditorContentOptions): Promise<{ text: string; source: 'ai' | 'sample' }> {
  const model = `${options.model || CONFIG.DEFAULT_SCRIPT_MODEL}`.trim() || CONFIG.DEFAULT_SCRIPT_MODEL;

  if (options.mode === 'narration') {
    return runTextAi({
      system: buildNarrationSystemPrompt(resolveNarrationLanguageLabel(options.draft)),
      user: buildNarrationUserPrompt(options.draft, options.asset, options.previousAsset, options.nextAsset),
      model,
      maxTokens: 380,
      temperature: 0.95,
      fallback: buildNarrationFallback(options.draft, options.asset, options.previousAsset, options.nextAsset),
    });
  }

  if (options.mode === 'image') {
    return runTextAi({
      system: buildImageSystemPrompt(),
      user: buildImageUserPrompt(options.draft, options.asset, options.previousAsset, options.nextAsset),
      model,
      maxTokens: 700,
      temperature: 1,
      fallback: buildImageFallback(options.draft, options.asset),
    });
  }

  return runTextAi({
    system: buildVideoSystemPrompt(),
    user: buildVideoUserPrompt(options.draft, options.asset, options.previousAsset, options.nextAsset),
    model,
    maxTokens: 700,
    temperature: 1,
    fallback: buildVideoFallback(options.draft, options.asset),
  });
}
