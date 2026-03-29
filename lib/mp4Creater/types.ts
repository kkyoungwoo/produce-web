// mp4Creater 전용 타입 모음
// 다른 기능은 건드리지 않고 이 화면에서만 쓰기 쉽게 조금 넓게 정의합니다.

export type ContentType = 'music_video' | 'story' | 'cinematic' | 'info_delivery';
export function normalizeContentType(value?: string | null): ContentType {
  if (value === 'music_video' || value === 'story' || value === 'cinematic' || value === 'info_delivery') return value;
  if (value === 'news') return 'cinematic';
  return 'story';
}


export function getContentTypeLabel(value?: string | null): string {
  const normalized = normalizeContentType(value);
  if (normalized === 'music_video') return '뮤직비디오';
  if (normalized === 'cinematic') return '영화';
  if (normalized === 'info_delivery') return '정보 전달';
  return '이야기';
}
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
  imagePrompt?: string;
  videoPrompt?: string;
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
  selectedVisualType?: 'image' | 'video';
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

export interface BackgroundMusicPromptSections {
  identity: string;
  mood: string;
  instruments: string;
  performance: string;
  production: string;
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
  provider?: 'elevenLabs' | 'qwen3Tts' | 'chatterbox' | 'heygen' | 'sample' | 'google';
  mode?: 'preview' | 'final';
  stylePreset?: string;
  requestedDuration?: number | null;
  promptSections?: BackgroundMusicPromptSections | null;
  parentTrackId?: string | null;
  timelineStartSeconds?: number | null;
  timelineEndSeconds?: number | null;
}

export interface BackgroundMusicSceneConfig {
  enabled: boolean;
  prompt: string;
  provider: 'sample' | 'google';
  modelId: string;
  title?: string;
  durationSeconds?: number;
  promptSections?: BackgroundMusicPromptSections;
  selectedTrackId?: string | null;
}

export interface AudioPreviewAsset {
  id: string;
  title: string;
  text: string;
  audioData: string | null;
  duration?: number | null;
  provider: 'elevenLabs' | 'qwen3Tts' | 'chatterbox' | 'heygen' | 'sample';
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
  duration?: number | null;
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
  voiceProvider?: 'project-default' | 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
  voiceId?: string;
  voiceName?: string;
  voicePreviewUrl?: string | null;
  voiceLocale?: string | null;
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

export type ScriptSpeechStyle = 'default' | 'yo' | 'da' | 'eum';
export type ScriptLanguageOption = 'mute' | 'ko' | 'en' | 'ja' | 'zh' | 'vi' | 'mn' | 'th' | 'uz';
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


export interface WorkflowPromptStore {
  commonPrompts: Record<string, string>;
  stepPrompts: {
    step1: Record<string, string>;
    step2: Record<string, string>;
    step3: Record<string, string>;
    step4: Record<string, string>;
    step5: Record<string, string>;
    step6: Record<string, string>;
  };
  finalPrompts: Record<string, string>;
  rolePrompts?: WorkflowRolePromptStore;
}

export interface WorkflowRolePromptBundle {
  label: string;
  stepSources: string[];
  basePrompt: string;
  finalPrompt: string;
  resultHint?: string | null;
  sections?: Record<string, string> | null;
}

export interface WorkflowRolePromptStore {
  script: WorkflowRolePromptBundle;
  character: WorkflowRolePromptBundle;
  style: WorkflowRolePromptBundle;
  scene: WorkflowRolePromptBundle;
  video: WorkflowRolePromptBundle;
  backgroundMusic: WorkflowRolePromptBundle;
  thumbnail: WorkflowRolePromptBundle;
}

export interface WorkflowScriptGenerationMeta {
  source: 'ai' | 'sample' | 'manual';
  intent: 'draft' | 'expand' | 'manual';
  generatedAt: number;
  templateId: string | null;
  templateName: string | null;
  modelId: string | null;
  conversationMode: boolean;
  language: ScriptLanguageOption;
  speechStyle: ScriptSpeechStyle;
  expectedDurationMinutes: number;
  recommendedCharacterCount: number;
  inputSignature: string;
  usedSampleFallback: boolean;
}

export interface WorkflowStepContract {
  step1: {
    concept: ContentType;
    conceptLabel: string;
    conceptPrompt: string;
    aspectRatio: AspectRatio;
    charsPerMinute: number;
  };
  step2: {
    videoDuration: number;
    isConversational: boolean;
    scriptLanguage: ScriptLanguageOption;
    speechStyle: ScriptSpeechStyle;
    contentTopic: string;
    selections: StorySelectionState;
  };
  step3: {
    recommendedCharacterCount: number;
    recommendedParagraphCount: number;
    script: string;
    sceneCount: number;
    imagePrompt: string;
    videoStoryPrompt: string;
    castType: string;
    cast: Array<{ id: string; name: string; role: string | null }>;
    castAudioMap: Record<string, {
      characterId: string;
      characterName: string;
      provider: string;
      voiceId: string | null;
      voiceName: string | null;
      modelId: string | null;
    }>;
    selectedPromptTemplateId: string | null;
    selectedPromptTemplateName: string | null;
    usedSampleFallback: boolean;
    generationMeta: WorkflowScriptGenerationMeta | null;
    currentInputSignature: string;
    needsRegeneration: boolean;
  };
  step4: {
    characterMood: string;
    characterMoodPrompt: string;
    generatedCharacters: Array<{
      id: string;
      name: string;
      prompt: string;
      selected: boolean;
      generatedImageCount: number;
    }>;
    selectedCharacters: Array<{ id: string; name: string; prompt: string }>;
    selectedCharacterPrompt: string;
    candidateCount: number;
  };
  step5: {
    generatedStyles: Array<{ id: string; label: string; prompt: string; selected: boolean }>;
    selectedStyle: { id: string; label: string } | null;
    selectedStylePrompt: string;
    candidateCount: number;
    hasSelection: boolean;
  };
  step6: {
    finalScript: string;
    finalImagePrompt: string;
    finalVideoPrompt: string;
    summaryData: Record<string, unknown>;
    usedInputs: Record<string, unknown>;
    missingInputs: string[];
    ready: boolean;
  };
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
  hasSelectedContentType?: boolean;
  hasSelectedAspectRatio?: boolean;
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
  promptStore?: WorkflowPromptStore;
  stepContract?: WorkflowStepContract;
  scriptGenerationMeta?: WorkflowScriptGenerationMeta | null;
  constitutionAnalysis?: ConstitutionAnalysisSummary | null;
  openRouterModel?: string;
  ttsProvider?: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
  elevenLabsVoiceId?: string | null;
  elevenLabsModelId?: string | null;
  heygenVoiceId?: string | null;
  qwenVoicePreset?: string | null;
  chatterboxVoicePreset?: string | null;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
  voiceReferenceName?: string | null;
  qwenStylePreset?: string | null;
  voicePreviewAsset?: AudioPreviewAsset | null;
  scriptPreviewAsset?: AudioPreviewAsset | null;
  finalVoiceAsset?: AudioPreviewAsset | null;
  backgroundMusicPreview?: BackgroundMusicTrack | null;
  finalBackgroundMusic?: BackgroundMusicTrack | null;
  musicVideoPreview?: VideoPreviewAsset | null;
  finalMusicVideo?: VideoPreviewAsset | null;
  backgroundMusicScene?: BackgroundMusicSceneConfig;
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


export type GenerationMode = 'free' | 'premium';
export type SceneSourceType = 'ai' | 'free-media' | 'sample' | 'mixed';
export type EncodingMode = 'browser' | 'ffmpeg';
export type SubtitleSizePreset = 'small' | 'medium' | 'large';
export type SubtitlePositionPreset = 'top' | 'middle' | 'bottom';
export type SubtitleSegmentMode = 'paragraph' | 'sentence';
export type YoutubeUploadStatus = 'idle' | 'ready' | 'uploading' | 'uploaded' | 'error';

export interface ScriptParagraphPlan {
  id: string;
  index: number;
  text: string;
  estimatedSeconds: number;
  startAt?: number;
  endAt?: number;
}

export interface ScenePlanItem {
  id: string;
  sceneNumber: number;
  paragraphId?: string | null;
  narration: string;
  imagePrompt?: string;
  videoPrompt?: string;
  motionPrompt?: string;
  estimatedSeconds: number;
  targetDuration: number;
  sceneSourceType?: SceneSourceType;
  sourceAssetUrl?: string | null;
}

export interface TtsFileItem {
  id: string;
  sceneNumber: number;
  paragraphId?: string | null;
  provider: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen' | 'sample';
  voiceId?: string | null;
  modelId?: string | null;
  duration: number;
  audioData?: string | null;
}

export interface SubtitlePresetState {
  size: SubtitleSizePreset;
  position: SubtitlePositionPreset;
  fontFamily: string;
  background: boolean;
  backgroundOpacity: number;
  segmentation: SubtitleSegmentMode;
}

export interface YoutubeConnectedAccountInfo {
  email?: string | null;
  channelId?: string | null;
  channelTitle?: string | null;
}

export interface YoutubeMetaDraft {
  title: string;
  description: string;
  tags: string[];
  privacyStatus: 'private' | 'unlisted' | 'public';
  isShortsEligible: boolean;
}

export interface FreeMediaItem {
  id: string;
  type: 'image' | 'video';
  title: string;
  provider: 'pexels' | 'sample';
  dataUrl?: string | null;
  previewUrl?: string | null;
  videoUrl?: string | null;
  sourceUrl?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
}

export interface ProjectPromptRecord {
  scriptPrompt?: string | null;
  scenePrompt?: string | null;
  characterPrompt?: string | null;
  stylePrompt?: string | null;
  imagePrompt?: string | null;
  videoPrompt?: string | null;
  motionPrompt?: string | null;
  backgroundMusicPrompt?: string | null;
  backgroundMusicPromptSections?: BackgroundMusicPromptSections | null;
  thumbnailPrompt?: string | null;
  rolePrompts?: WorkflowRolePromptStore | null;
  youtubeMetaPrompt?: string | null;
}

export interface PreviewMixSettings {
  narrationVolume: number;
  backgroundMusicVolume: number;
}

export type TimelineSnapMode = 'frame' | 'beat' | 'scene' | 'off';
export type TimelineTrackKind = 'scene' | 'visual' | 'narration' | 'cast' | 'lyric' | 'bgm' | 'subtitle' | 'overlay';

export interface TimelineRangeSelection {
  startMs: number;
  endMs: number;
}

export interface TimelineTrack {
  id: string;
  kind: TimelineTrackKind;
  title: string;
  order: number;
  locked: boolean;
  muted: boolean;
  height: number;
  laneGroup?: string | null;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  sceneId: string | null;
  segmentId: string | null;
  assetId: string | null;
  startMs: number;
  endMs: number;
  trimInMs: number;
  trimOutMs: number;
  draggable: boolean;
  trimmable: boolean;
  splittable: boolean;
  resizable: boolean;
  linkedClipIds: string[];
  locked: boolean;
  role?: 'narrator' | 'dialogue' | 'lyric' | 'caption' | 'bgm' | 'scene';
}

export interface TimelineStateV2 {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  playheadMs: number;
  zoomLevel: number;
  snapMode: TimelineSnapMode;
  rippleMode: boolean;
  selectedClipIds: string[];
  selectedTrackId: string | null;
  rangeSelection: TimelineRangeSelection | null;
  scrollLeftPx: number;
  scrollTopPx: number;
}

export interface ScriptSegmentV1 {
  id: string;
  role: 'narrator' | 'dialogue' | 'lyric' | 'caption' | 'sfx';
  text: string;
  estimatedDurationMs: number;
  beatIndex?: number | null;
  minuteBlockIndex?: number | null;
  sceneHint?: string | null;
  speakerId?: string | null;
}

export interface ScriptDocumentV1 {
  runtimeMode: 'per-second' | 'per-minute';
  targetDurationSeconds: number;
  plannerSummary: Record<string, unknown>;
  segments: ScriptSegmentV1[];
}

export interface MusicStateV2 {
  activeTrackId: string | null;
  trackIds: string[];
  previewMix: PreviewMixSettings | null;
}

export interface SubtitleStateV2 {
  enabled: boolean;
  subtitlePreset: SubtitlePresetState | null;
}

export interface EditorStateV2 {
  selectedClipIds: string[];
  selectedTrackId: string | null;
  playheadMs: number;
  zoomLevel: number;
  rangeSelection: TimelineRangeSelection | null;
  scrollLeftPx: number;
  scrollTopPx: number;
  openedInspectorTab?: 'scene' | 'timeline' | 'subtitle' | 'thumbnail' | 'asset';
}

export interface ContinuityStateV1 {
  sourceProjectId?: string | null;
  continuationMode?: string | null;
  inheritedStylePackIds?: string[];
  inheritedCharacterPackIds?: string[];
}

export interface ProjectMetadataV4 {
  id: string;
  schemaVersion: 4;
  name: string;
  projectNumber: number;
  createdAt: number;
  updatedAt: number;
  activeStep: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
  runtimeMode: 'per-second' | 'per-minute';
  estimatedDurationSeconds: number;
  sceneCount: number;
  status: 'draft' | 'ready' | 'rendering' | 'done' | 'error';
  thumbnailAssetId?: string | null;
}

export interface ProjectWorkfileV4 {
  projectId: string;
  scriptDocument: ScriptDocumentV1;
  sceneDocument: {
    sceneIds: string[];
  };
  timelineState: TimelineStateV2;
  musicState: MusicStateV2;
  subtitleState: SubtitleStateV2;
  editorState: EditorStateV2;
  continuityState: ContinuityStateV1;
  derivationMeta?: Record<string, unknown> | null;
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
  schemaVersion?: number;
  settings: {
    imageModel: string;
    videoModel?: string;
    scriptModel?: string;
    sceneModel?: string;
    outputMode: ProjectOutputMode;
    elevenLabsModel: string;
    fluxStyle?: string;
    imageProvider?: 'sample' | 'openrouter' | 'custom';
    videoProvider?: 'elevenLabs' | 'sample';
    ttsProvider?: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
    audioProvider?: 'elevenLabs' | 'qwen3Tts' | 'chatterbox' | 'heygen' | 'sample';
    qwenVoicePreset?: string | null;
    chatterboxVoicePreset?: string | null;
    elevenLabsVoiceId?: string | null;
    heygenVoiceId?: string | null;
    voiceReferenceAudioData?: string | null;
    voiceReferenceMimeType?: string | null;
    voiceReferenceName?: string | null;
    backgroundMusicProvider?: 'google' | 'sample';
    backgroundMusicModel?: string;
    musicVideoProvider?: 'elevenLabs' | 'sample';
    musicVideoMode?: 'auto' | 'sample';
  };
  assets: GeneratedAsset[];
  thumbnail: string | null;
  thumbnailTitle?: string | null;
  thumbnailPrompt?: string | null;
  thumbnailHistory?: PromptedImageAsset[];
  selectedThumbnailId?: string | null;
  cost?: CostBreakdown;
  backgroundMusicTracks?: BackgroundMusicTrack[];
  activeBackgroundTrackId?: string | null;
  previewMix?: PreviewMixSettings;
  workflowDraft?: WorkflowDraft | null;
  voicePreviewAsset?: AudioPreviewAsset | null;
  scriptPreviewAsset?: AudioPreviewAsset | null;
  finalVoiceAsset?: AudioPreviewAsset | null;
  backgroundMusicPreview?: BackgroundMusicTrack | null;
  finalBackgroundMusic?: BackgroundMusicTrack | null;
  musicVideoPreview?: VideoPreviewAsset | null;
  finalMusicVideo?: VideoPreviewAsset | null;
  sceneStudioPreviewVideo?: VideoPreviewAsset | null;
  sceneStudioPreviewStatus?: 'idle' | 'loading' | 'ready' | 'fallback' | 'error' | null;
  sceneStudioPreviewMessage?: string | null;
  script?: string | null;
  scriptParagraphs?: ScriptParagraphPlan[];
  sceneList?: ScenePlanItem[];
  sceneDuration?: number | null;
  ttsFiles?: TtsFileItem[];
  ttsDuration?: number | null;
  generationMode?: GenerationMode;
  sceneSourceType?: SceneSourceType;
  encodingMode?: EncodingMode;
  subtitlePreset?: SubtitlePresetState | null;
  subtitlePosition?: SubtitlePositionPreset | null;
  subtitleBackgroundOpacity?: number | null;
  prompts?: ProjectPromptRecord | null;
  youtubeConnectedAccount?: YoutubeConnectedAccountInfo | null;
  youtubeChannelTitle?: string | null;
  youtubeUploadStatus?: YoutubeUploadStatus;
  youtubeUploadedAt?: number | null;
  youtubeVideoId?: string | null;
  youtubePrivacyStatus?: 'private' | 'unlisted' | 'public' | null;
  youtubeTitle?: string | null;
  youtubeDescription?: string | null;
  youtubeTags?: string[];
  isShortsEligible?: boolean;
  uploadErrorMessage?: string | null;
  metadataV4?: ProjectMetadataV4 | null;
  workfileV4?: ProjectWorkfileV4 | null;
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
  audioProvider: 'elevenLabs' | 'qwen3Tts' | 'chatterbox' | 'heygen' | 'sample';
  audioModel: string;
  ttsNarratorId: string;
  backgroundMusicModel: string;
  videoProvider: 'elevenLabs' | 'sample';
  videoModel: string;
  textModel?: string;
  ttsProvider?: 'qwen3Tts' | 'chatterbox' | 'elevenLabs' | 'heygen';
  elevenLabsVoiceId?: string | null;
  elevenLabsModelId?: string | null;
  heygenVoiceId?: string | null;
  qwenVoicePreset?: string | null;
  chatterboxVoicePreset?: string | null;
  voiceReferenceAudioData?: string | null;
  voiceReferenceMimeType?: string | null;
  voiceReferenceName?: string | null;
  qwenStylePreset?: string | null;
  backgroundMusicProvider?: 'google' | 'sample';
  backgroundMusicStyle?: string;
  musicVideoProvider?: 'elevenLabs' | 'sample';
  musicVideoMode?: 'auto' | 'sample';
  paidModeEnabled?: boolean;
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
  heygenApiKey?: string;
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
  projectIndex?: SavedProject[];
  workflowDraft?: WorkflowDraft | null;
  agentProfile?: StudioAgentProfile;
  preferredPromptProfile?: PromptProfileId;
  providerRegistry?: ProviderRegistryItem[];
  lastContentType?: ContentType;
}
