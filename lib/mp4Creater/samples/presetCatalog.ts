
import {
  CHARACTER_SAMPLE_PRESETS,
  STYLE_SAMPLE_PRESETS,
  WORKFLOW_CHARACTER_STYLE_OPTIONS,
  type CharacterSamplePreset,
  type StyleSamplePreset,
  type WorkflowCharacterStyleOption,
} from '../prompt-center';

export type { WorkflowCharacterStyleOption, CharacterSamplePreset, StyleSamplePreset };
export { WORKFLOW_CHARACTER_STYLE_OPTIONS, CHARACTER_SAMPLE_PRESETS, STYLE_SAMPLE_PRESETS };

export function getCharacterSamplePreset(id: string) {
  return CHARACTER_SAMPLE_PRESETS.find((item) => item.id === id) || null;
}

export function getStyleSamplePreset(id: string) {
  return STYLE_SAMPLE_PRESETS.find((item) => item.id === id) || null;
}
