// mp4Creater 전용 타입 모음
// 다른 기능은 건드리지 않고 이 화면에서만 쓰기 쉽게 조금 넓게 정의합니다.

export type ContentType = 'music_video' | 'story' | 'news' | 'info_delivery';
export type AspectRatio = '16:9' | '1:1' | '9:16';
export type ProjectOutputMode = 'video' | 'image';

export const DEFAULT_ASPECT_RATIO: AspectRatio = '16:9';

export interface StorySelectionState {
  genre: string;
  mood: string;
  endingTone: string;
  setting: string;
  protagonist: string;
  conflict: string;
}

// 참조 이미지 타입 (캐릭터/스타일 분리 + 강도 조절)
export interface ReferenceImages {
  character: string[];
  style: string[];
  characterStrength: number;
  styleStrength: number;
}

export const DEFAULT_REFERENCE_IMAGES: ReferenceImages = {
  character: [],
  style: [],
  characterStrength: 70,
  styleStrength: 70,
};

export interface SceneAnalysis {
  composition_type: 'MICRO' | 'STANDARD' | 'MACRO' | 'NO_CHAR';
  composition_explanation?: string;
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  camera?: {
    view?: string;
    distance?: string;
    angle?: string;
  };
  composition_setup?: {
    main_element?: string;
    sub_element?: string;
    character_positioning?: string;
  };
  visual_metaphor?: {
    concept?: string;
    object?: string;
    interaction?: string;
  };
  metaphor_category?: string;
  color_plan?: {
    anchor_colors?: Record<string, string>;
    background_colors?: {
      primary?: string;
      sub?: string;
      accent?: string;
      metaphor?: string;
      bg?: string;
    };
    emotion_match?: string;
  };
  detail_level?: 'Minimal(1)' | 'Enhanced(2)' | 'Detailed(3)';
  emotional_amplification_technique?: string;
  differentiation_point?: string;
  motion_type?: '정적' | '동적';
  motion_detail?: string;
}

export interface ScriptScene {
  sceneNumber: number;
  narration: string;
  visualPrompt: string;
  analysis?: SceneAnalysis;
  targetDuration?: number | null;
  aspectRatio?: AspectRatio;
}

export interface SubtitleWord {
  word: string;
  start: number;
  end: number;
}

export interface MeaningChunk {
  text: string;
  startTime: number;
  endTime: number;
}

export interface SubtitleData {
  words: SubtitleWord[];
  fullText: string;
  meaningChunks?: MeaningChunk[];
}

export interface SubtitleConfig {
  wordsPerLine: number;
  maxLines: number;
  fontSize: number;
  fontFamily: string;
  bottomMargin: number;
  backgroundColor: string;
  textColor: string;
}

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  wordsPerLine: 5,
  maxLines: 1,
  fontSize: 40,
  fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif',
  bottomMargin: 80,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  textColor: '#FFFFFF',
};

export interface AssetHistoryItem {
  id: string;
  kind: 'image' | 'video';
  data: string;
  sourceMode: 'ai' | 'sample';
  createdAt: number;
  label?: string;
}

export interface GeneratedAsset extends ScriptScene {
  imageData: string | null;
  audioData: string | null;
  audioDuration: number | null;
  subtitleData: SubtitleData | null;
  videoData: string | null;
  videoDuration: number | null;
  // 사용자가 컷 길이를 직접 조절할 수 있는 필드
  targetDuration: number | null;
  sourceMode?: 'ai' | 'sample';
  imageHistory?: AssetHistoryItem[];
  videoHistory?: AssetHistoryItem[];
  status: 'pending' | 'generating' | 'completed' | 'error';
}

export enum GenerationStep {
  IDLE = 'IDLE',
  SCRIPTING = 'SCRIPTING',
  ASSETS = 'ASSETS',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface CostBreakdown {
  images: number;
  tts: number;
  videos: number;
  total: number;
  imageCount: number;
  ttsCharacters: number;
  videoCount: number;
}

export interface PromptedImageAsset {
  id: string;
  label: string;
  prompt: string;
  imageData: string;
  createdAt: number;
  kind: 'character' | 'style' | 'thumbnail';
  sourceMode: 'ai' | 'sample' | 'upload';
  selected?: boolean;
  note?: string;
  groupId?: string;
  groupLabel?: string;
}

export interface BackgroundMusicTrack {
  id: string;
  title: string;
  prompt: string;
  audioData: string | null;
  duration: number | null;
  volume: number;
  sourceMode: 'ai' | 'sample';
  createdAt: number;
  provider?: 'elevenLabs' | 'qwen3Tts' | 'sample';
  mode?: 'preview' | 'final';
  stylePreset?: string;
}

export interface AudioPreviewAsset {
  id: string;
  title: string;
  text: string;
  audioData: string | null;
  duration?: number | null;
  provider: 'elevenLabs' | 'qwen3Tts' | 'sample';
  mode: 'voice-preview' | 'script-preview' | 'final-output';
  sourceMode: 'ai' | 'sample';
  voiceId?: string | null;
  modelId?: string | null;
  createdAt: number;
}

export interface VideoPreviewAsset {
  id: string;
  title: string;
  prompt: string;
  videoData: string | null;
  provider: 'elevenLabs' | 'sample';
  mode: 'preview' | 'final';
  sourceMode: 'ai' | 'sample';
  createdAt: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
  description: string;
  visualStyle: string;
  voiceHint?: string;
  createdAt: number;
  role?: 'lead' | 'support' | 'narrator';
  roleLabel?: string;
  rolePrompt?: string;
  castOrder?: number;
  prompt?: string;
  imageData?: string | null;
  generatedImages?: PromptedImageAsset[];
  selectedImageId?: string | null;
}

export interface WorkflowPromptPack {
  storyPrompt: string;
  lyricsPrompt: string;
  characterPrompt: string;
  scenePrompt: string;
  actionPrompt: string;
  persuasionStoryPrompt: string;
}

export type WorkflowPromptTemplateMode = 'narration' | 'dialogue';
export type WorkflowPromptTemplateEngine = 'default' | 'channel_constitution_v32';

export interface ConstitutionTargetProfile {
  name: string;
  identity: string;
  interests: string[];
  tone: string;
}

export interface ConstitutionSafetyReview {
  grade: 'safe' | 'danger';
  details: string;
  decision: string;
}

export interface ConstitutionMonetizationReview {
  grade: 'green' | 'yellow' | 'red';
  details: string;
  solution: string;
}

export interface ConstitutionStructureSelection {
  id: string;
  reason: string;
}

export interface ConstitutionKeywordPair {
  ko: string;
  en: string;
}

export interface ConstitutionAnalysisSummary {
  targetProfile: ConstitutionTargetProfile;
  safetyReview: ConstitutionSafetyReview;
  monetizationReview: ConstitutionMonetizationReview;
  selectedStructure: ConstitutionStructureSelection;
  titles: string[];
  keywords: ConstitutionKeywordPair[];
  source: 'ai' | 'sample';
  updatedAt: number;
}

export type ScriptSpeechStyle = 'yo' | 'da' | 'random';
export type ScriptLanguageOption = 'ko' | 'en' | 'ja' | 'zh' | 'vi' | 'mn' | 'th' | 'uz';
export type ReferenceLinkKind = 'youtube' | 'web';

export interface ReferenceLinkDraft {
  id: string;
  url: string;
  kind: ReferenceLinkKind;
  title?: string;
  sourceText?: string;
  summary?: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string | null;
  addedAt: number;
}

export interface CustomScriptSettings {
  expectedDurationMinutes: number;
  speechStyle: ScriptSpeechStyle;
  language: ScriptLanguageOption;
  referenceText: string;
  referenceLinks: ReferenceLinkDraft[];
  scriptModel?: string;
}


export interface WorkflowPromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  mode: WorkflowPromptTemplateMode;
  engine?: WorkflowPromptTemplateEngine;
  builtIn?: boolean;
  basePrompt?: string;
  isCustomized?: boolean;
  updatedAt: number;
}

export interface WorkflowDraft {
  id: string;
  contentType: ContentType;
  aspectRatio: AspectRatio;
  topic: string;
  outputMode: ProjectOutputMode;
  selections: StorySelectionState;
  script: string;
  activeStage: number;
  extractedCharacters: CharacterProfile[];
  styleImages: PromptedImageAsset[];
  characterImages: PromptedImageAsset[];
  selectedCharacterIds: string[];
  selectedCharacterStyleId?: string | null;
  selectedCharacterStyleLabel?: string;
  selectedCharacterStylePrompt?: string;
  selectedStyleImageId: string | null;
  referenceImages: ReferenceImages;
  promptPack: WorkflowPromptPack;
  promptTemplates: WorkflowPromptTemplate[];
  selectedPromptTemplateId: string | null;
  promptAdditions: string[];
  customScriptSettings?: CustomScriptSettings;
  constitutionAnalysis?: ConstitutionAnalysisSummary | null;
  openRouterModel?: string;
  ttsProvider?: 'qwen3Tts' | 'elevenLabs';
  elevenLabsVoiceId?: string | null;
  elevenLabsModelId?: string | null;
  qwenVoicePreset?: string | null;
  qwenStylePreset?: string | null;
  voicePreviewAsset?: AudioPreviewAsset | null;
  scriptPreviewAsset?: AudioPreviewAsset | null;
  finalVoiceAsset?: AudioPreviewAsset | null;
  backgroundMusicPreview?: BackgroundMusicTrack | null;
  finalBackgroundMusic?: BackgroundMusicTrack | null;
  musicVideoPreview?: VideoPreviewAsset | null;
  finalMusicVideo?: VideoPreviewAsset | null;
  sampleMode?: {
    text: boolean;
    tts: boolean;
    backgroundMusic: boolean;
    musicVideo: boolean;
  };
  completedSteps: {
    step1: boolean;
    step2: boolean;
    step3: boolean;
    step4: boolean;
    step5: boolean;
  };
  updatedAt: number;
}

export interface PreviewMixSettings {
  narrationVolume: number;
  backgroundMusicVolume: number;
}

export interface ProjectSettings {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  imageModel: string;
  outputMode: ProjectOutputMode;
  elevenLabsVoiceId: string;
  elevenLabsModel: string;
}

export interface SavedProject {
  id: string;
  name: string;
  createdAt: number;
  topic: string;
  projectNumber?: number;
  folderName?: string;
  folderPath?: string;
  lastSavedAt?: number;
  settings: {
    imageModel: string;
    outputMode: ProjectOutputMode;
    elevenLabsModel: string;
    fluxStyle?: string;
  };
  assets: GeneratedAsset[];
  thumbnail: string | null;
  thumbnailTitle?: string | null;
  thumbnailPrompt?: string | null;
  thumbnailHistory?: PromptedImageAsset[];
  selectedThumbnailId?: string | null;
  cost?: CostBreakdown;
  backgroundMusicTracks?: BackgroundMusicTrack[];
  previewMix?: PreviewMixSettings;
  workflowDraft?: WorkflowDraft | null;
  voicePreviewAsset?: AudioPreviewAsset | null;
  scriptPreviewAsset?: AudioPreviewAsset | null;
  finalVoiceAsset?: AudioPreviewAsset | null;
  backgroundMusicPreview?: BackgroundMusicTrack | null;
  finalBackgroundMusic?: BackgroundMusicTrack | null;
  musicVideoPreview?: VideoPreviewAsset | null;
  finalMusicVideo?: VideoPreviewAsset | null;
}

export type AiTaskKind =
  | 'script'
  | 'scene'
  | 'imagePrompt'
  | 'motionPrompt'
  | 'image'
  | 'audio'
  | 'video';

export interface AiRoutingSettings {
  scriptModel: string;
  sceneModel: string;
  imagePromptModel: string;
  motionPromptModel: string;
  openRouterMaxTokens?: number;
  openRouterInputMaxChars?: number;
  imageProvider: 'sample' | 'openrouter' | 'custom';
  imageModel: string;
  audioProvider: 'elevenLabs' | 'qwen3Tts' | 'sample';
  audioModel: string;
  ttsNarratorId: string;
  backgroundMusicModel: string;
  videoProvider: 'elevenLabs' | 'sample';
  videoModel: string;
  textModel?: string;
  ttsProvider?: 'qwen3Tts' | 'elevenLabs';
  elevenLabsVoiceId?: string | null;
  elevenLabsModelId?: string | null;
  qwenVoicePreset?: string | null;
  qwenStylePreset?: string | null;
  backgroundMusicProvider?: 'elevenLabs' | 'sample';
  backgroundMusicStyle?: string;
  musicVideoProvider?: 'elevenLabs' | 'sample';
  musicVideoMode?: 'auto' | 'sample';
}

export type ProviderKind = 'text' | 'image' | 'audio' | 'video';

export interface ProviderRegistryItem {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  modelHint: string;
  apiKey?: string;
  authScheme?: string;
  notes?: string;
  enabled: boolean;
}

export interface StudioProviderSecrets {
  openRouterApiKey?: string;
  elevenLabsApiKey?: string;
  falApiKey?: string;
}

export type PromptProfileId = 'general_youtube' | 'music_video';

export interface StudioAgentProfile {
  name: string;
  mission: string;
  toneGuide: string;
  defaultWorkflow: PromptProfileId;
}

export interface StudioState {
  version: number;
  storageDir: string;
  isStorageConfigured?: boolean;
  configuredAt: number;
  updatedAt: number;
  selectedCharacterId: string | null;
  characters: CharacterProfile[];
  routing: AiRoutingSettings;
  providers: StudioProviderSecrets;
  projects: SavedProject[];
  workflowDraft?: WorkflowDraft | null;
  agentProfile?: StudioAgentProfile;
  preferredPromptProfile?: PromptProfileId;
  providerRegistry?: ProviderRegistryItem[];
  lastContentType?: ContentType;
}
