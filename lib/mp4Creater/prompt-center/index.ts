
import { ContentType } from '../types';
import { PROMPT_STUDIO_BUNDLES } from './bundles';

export type { PromptStudioBundle, WorkflowCharacterStyleOption, CharacterSamplePreset, StyleSamplePreset } from './types';
export { WORKFLOW_CHARACTER_STYLE_OPTIONS, CHARACTER_SAMPLE_PRESETS, STYLE_SAMPLE_PRESETS } from './sampleLibrary';

export function getPromptStudioBundle(contentType: ContentType) {
  return PROMPT_STUDIO_BUNDLES[contentType] || PROMPT_STUDIO_BUNDLES.story;
}

export function buildPromptStudioStepBlock(contentType: ContentType, step: 'script' | 'character' | 'style' | 'scene' | 'action') {
  const bundle = getPromptStudioBundle(contentType);
  const lines = bundle.stepLayers[step] || [];
  if (!lines.length) return '';
  return `[PROMPT FOLDER / ${step.toUpperCase()}]
${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}`;
}
