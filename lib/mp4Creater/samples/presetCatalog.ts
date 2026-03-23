import presetCatalogJson from './presetCatalog.json';

export interface WorkflowCharacterStyleOption {
  id: string;
  label: string;
  description: string;
  prompt: string;
  accentFrom: string;
  accentTo: string;
  sampleImage?: string;
}

export interface CharacterSamplePreset {
  id: string;
  name: string;
  prompt: string;
  imageData: string;
  role: 'lead' | 'support';
  roleLabel: string;
}

export interface StyleSamplePreset {
  id: string;
  label: string;
  description: string;
  prompt: string;
  imageData: string;
  accent?: string;
}

export interface StyleCharacterPreset {
  id: 'real' | 'stick' | 'webtoon';
  label: string;
  characterId: string;
  styleId: string;
}

type PresetCatalogJson = {
  characterStyles?: Array<WorkflowCharacterStyleOption>;
  characterSamples?: Array<{
    id: string;
    name: string;
    prompt: string;
    sampleImage: string;
    role: 'lead' | 'support';
    roleLabel: string;
  }>;
  styleSamples?: Array<{
    id: string;
    label: string;
    description: string;
    prompt: string;
    sampleImage: string;
    accent?: string;
  }>;
};

const presetCatalog = presetCatalogJson as PresetCatalogJson;

// Step4 캐릭터 느낌 카드와 Step5 화풍 샘플 프롬프트·이미지는 이 JSON 하나에서 관리합니다.
// - 캐릭터 느낌 카드: WORKFLOW_CHARACTER_STYLE_OPTIONS
// - 캐릭터 샘플 프롬프트/이미지: CHARACTER_SAMPLE_PRESETS
// - 화풍 샘플 프롬프트/이미지: STYLE_SAMPLE_PRESETS
export const WORKFLOW_CHARACTER_STYLE_OPTIONS: WorkflowCharacterStyleOption[] = Array.isArray(presetCatalog.characterStyles)
  ? presetCatalog.characterStyles.map((item) => ({ ...item }))
  : [];

export const CHARACTER_SAMPLE_PRESETS: CharacterSamplePreset[] = Array.isArray(presetCatalog.characterSamples)
  ? presetCatalog.characterSamples.map((item) => ({
      id: item.id,
      name: item.name,
      prompt: item.prompt,
      imageData: item.sampleImage,
      role: item.role,
      roleLabel: item.roleLabel,
    }))
  : [];

export const STYLE_SAMPLE_PRESETS: StyleSamplePreset[] = Array.isArray(presetCatalog.styleSamples)
  ? presetCatalog.styleSamples.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      prompt: item.prompt,
      imageData: item.sampleImage,
      accent: item.accent,
    }))
  : [];

export function getCharacterSamplePreset(id: string) {
  return CHARACTER_SAMPLE_PRESETS.find((item) => item.id === id) || null;
}

export function getStyleSamplePreset(id: string) {
  return STYLE_SAMPLE_PRESETS.find((item) => item.id === id) || null;
}
