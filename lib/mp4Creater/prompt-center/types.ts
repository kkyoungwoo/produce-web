
import { ContentType } from '../types';

export type PromptStudioStepKey = 'script' | 'character' | 'style' | 'scene' | 'action';

export interface PromptStudioBundle {
  system: string;
  story: string;
  recommendations: string[];
  translateRule: string;
  conceptGuide: string;
  stepLayers: Record<PromptStudioStepKey, string[]>;
}

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

export type PromptStudioBundleMap = Record<ContentType, PromptStudioBundle>;
