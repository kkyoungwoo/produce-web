import { AspectRatio, GeneratedAsset, ScriptScene, WorkflowDraft } from '../types';
import {
  buildLocalVisualPrompt,
  estimateClipDuration,
  makeScenePlaceholderImage,
  splitStoryIntoParagraphScenes,
} from '../utils/storyHelpers';

export function createLocalScenesFromDraft(draft: WorkflowDraft): ScriptScene[] {
  const aspectRatio: AspectRatio = draft.aspectRatio || '16:9';
  const paragraphs = splitStoryIntoParagraphScenes(draft.script || '');
  return paragraphs.map((paragraph, index) => ({
    sceneNumber: index + 1,
    narration: paragraph,
    visualPrompt: buildLocalVisualPrompt(paragraph, index + 1, draft.contentType, aspectRatio),
    analysis: {
      composition_type: paragraph.length > 85 ? 'STANDARD' : 'MICRO',
      sentiment: 'NEUTRAL',
    },
    targetDuration: estimateClipDuration(paragraph),
    aspectRatio,
  }));
}

export function buildSelectedPromptContextFromDraft(draft: WorkflowDraft) {
  const selectedCharacters = (draft.extractedCharacters || []).filter((item) => (draft.selectedCharacterIds || []).includes(item.id));
  const characterPromptBlock = selectedCharacters
    .map((character, index) => {
      const pickedImage = (character.generatedImages || []).find((image) => image.id === character.selectedImageId);
      const appliedPrompt = pickedImage?.prompt || character.prompt || character.description;
      const roleLabel = character.roleLabel || character.rolePrompt || character.description || (character.role === 'lead' ? '주인공' : character.role === 'narrator' ? '내레이션' : `조연 ${index + 1}`);
      return appliedPrompt ? `- ${character.name} (${roleLabel}): ${appliedPrompt}` : '';
    })
    .filter(Boolean)
    .join('\n');
  const selectedStyle = (draft.styleImages || []).find((item) => item.id === draft.selectedStyleImageId);
  const selectedPromptTemplate = (draft.promptTemplates || []).find((item) => item.id === draft.selectedPromptTemplateId);

  return {
    characterPromptBlock,
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
    `[SELECTIONS] 장르=${draft.selections?.genre || ''}, 분위기=${draft.selections?.mood || ''}, 배경=${draft.selections?.setting || ''}, 주인공=${draft.selections?.protagonist || ''}, 갈등=${draft.selections?.conflict || ''}`,
  ].join('\n');

  return scenes.map((scene, index) => ({
    ...scene,
    visualPrompt: [
      scene.visualPrompt,
      selectionSummary,
      promptContext.promptTemplateName ? `[SELECTED SCRIPT TEMPLATE] ${promptContext.promptTemplateName}` : '',
      promptContext.promptTemplatePrompt ? `[SELECTED TEMPLATE PROMPT]\n${promptContext.promptTemplatePrompt}` : '',
      promptContext.storyPrompt ? `[STORY PROMPT]\n${promptContext.storyPrompt}` : '',
      promptContext.scenePrompt ? `[SCENE PROMPT]\n${promptContext.scenePrompt}` : '',
      promptContext.actionPrompt ? `[ACTION PROMPT]\n${promptContext.actionPrompt}` : '',
      promptContext.characterPromptBlock ? `[SELECTED CHARACTER PROMPTS]\n${promptContext.characterPromptBlock}` : '',
      promptContext.stylePrompt ? `[SELECTED STYLE PROMPT]\n${promptContext.stylePrompt}` : '',
      promptContext.styleLabel ? `[STYLE LABEL] ${promptContext.styleLabel}` : '',
      `[SCENE RULE] Scene ${index + 1} must keep the selected character roles, selected prompt template, and selected style prompt consistently.`,
    ].filter(Boolean).join('\n\n'),
  }));
}

export function createInitialSceneAssetsFromDraft(draft: WorkflowDraft): GeneratedAsset[] {
  const aspectRatio: AspectRatio = draft.aspectRatio || '16:9';
  return applySelectionPromptsToScenes(createLocalScenesFromDraft(draft), draft).map((scene) => ({
    ...scene,
    imageData: makeScenePlaceholderImage(scene.sceneNumber, scene.narration, aspectRatio),
    audioData: null,
    audioDuration: null,
    subtitleData: null,
    videoData: null,
    videoDuration: null,
    targetDuration: scene.targetDuration || estimateClipDuration(scene.narration),
    sourceMode: 'sample',
    status: 'pending',
    imageHistory: [],
    videoHistory: [],
  }));
}
