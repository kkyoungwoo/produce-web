import { AspectRatio, ContentType } from '../types';

export type CreativeTaskKind = 'script' | 'scene' | 'image' | 'motion' | 'subtitle' | 'style';
export type CreativeVariantMode = 'fresh' | 'similar';

export interface CreativeDirection {
  seed: number;
  shotType: string;
  cameraLanguage: string;
  lightingDirection: string;
  paletteDirection: string;
  visualHook: string;
  transitionBeat: string;
  subtitleTone: string;
  narrativeAngle: string;
}

const SHOT_TYPES = [
  'hero close-up with asymmetric framing',
  'wide establishing shot with a strong foreground layer',
  'mid-shot centered on gesture and prop interaction',
  'over-the-shoulder reveal with depth contrast',
  'low-angle push that makes the subject feel decisive',
  'top-light tableau with a graphic silhouette',
] as const;

const CAMERA_LANGUAGES = [
  'Use a confident camera path with one clear focal subject and one supporting detail.',
  'Let the camera language feel observational rather than posed.',
  'Favor a lived-in lens choice over a generic centered framing.',
  'Introduce a visible camera motive instead of a static catalog shot.',
  'Keep the frame readable, but let one unusual perspective sell the beat.',
  'Use depth and staging so the eye discovers the scene in two steps.',
] as const;

const LIGHTING_DIRECTIONS = [
  'soft neon rim light with a calm shadow falloff',
  'cool window light with a sharp contrast edge',
  'warm practical lights with reflective highlights',
  'misty backlight with gentle glow separation',
  'graphic side light with cinematic shadow carving',
  'clean daylight with selective color accents',
] as const;

const PALETTE_DIRECTIONS = [
  'deep navy, violet, and silver accents',
  'warm amber, rose, and charcoal contrast',
  'emerald, teal, and muted cream balance',
  'indigo, magenta, and soft cyan energy',
  'sepia bronze against faded blue-gray air',
  'clean white, slate, and one vivid accent color',
] as const;

const VISUAL_HOOKS = [
  'Use one memorable prop or environmental detail that instantly separates this attempt from a generic version.',
  'Let one expressive gesture or posture become the image hook.',
  'Anchor the scene with a striking foreground obstruction or frame-within-frame.',
  'Make the environment participate in the emotion instead of sitting still behind the subject.',
  'Prefer a clear before-and-after tension inside the same frame.',
  'Give the viewer one instantly legible visual question they want answered.',
] as const;

const TRANSITION_BEATS = [
  'Enter slightly late, after the action has already started.',
  'Resolve the beat with a visible shift in power or attention.',
  'Use the transition as a reveal instead of a neutral cut.',
  'Let the scene begin from aftermath, not setup.',
  'Make the exit frame feel like a handoff to the next scene.',
  'Allow a tiny contradiction between mood and action for freshness.',
] as const;

const SUBTITLE_TONES = [
  'Short, punchy, visual-first caption fragments.',
  'Conversational subtitle rhythm with natural pauses.',
  'One sharp headline-style caption followed by a softer follow-up.',
  'Compact subtitle pacing with clear emphasis on one key phrase.',
  'Minimal subtitle wording that leaves space for the image to speak.',
  'Readable, energetic caption timing that avoids repeating the same cadence.',
] as const;

const NARRATIVE_ANGLES: Record<ContentType | 'default', readonly string[]> = {
  story: [
    'Lean into emotional cause-and-effect rather than summary.',
    'Show the turning point through a decision, not a recap.',
    'Open with friction already in motion.',
    'Let one human detail reshape the whole beat.',
  ],
  news: [
    'Treat the material like a cinematic reveal, not a neutral explainer.',
    'Focus on visible stakes before explanation.',
    'Build momentum through discovery and consequence.',
    'Let one concrete scene detail carry the tension.',
  ],
  info_delivery: [
    'Teach through a concrete example before abstract explanation.',
    'Use a compare-and-contrast angle instead of repeating the same outline.',
    'Frame the answer around one practical decision point.',
    'Let the explanation move through sequence, proof, and takeaway.',
  ],
  music_video: [
    'Prefer a new emotional metaphor instead of recycling the last chorus image.',
    'Make the hook feel singable and visually magnetic.',
    'Build contrast between verse texture and chorus lift.',
    'Let one symbolic image carry the refrain.',
  ],
  default: [
    'Default to a fresh angle over the safest repetition.',
    'Find a new emotional entry point for the same idea.',
    'Make the scene feel authored, not templated.',
    'Vary the dramatic distance instead of repeating the same framing.',
  ],
};

const SAMPLE_THEMES = [
  { start: '#0f172a', end: '#6d28d9', accent: '#f8fafc', chip: '#38bdf8' },
  { start: '#111827', end: '#be185d', accent: '#fef3c7', chip: '#f59e0b' },
  { start: '#052e16', end: '#0f766e', accent: '#ecfeff', chip: '#22d3ee' },
  { start: '#312e81', end: '#c026d3', accent: '#fdf2f8', chip: '#fb7185' },
  { start: '#1f2937', end: '#0ea5e9', accent: '#eff6ff', chip: '#93c5fd' },
  { start: '#3f3f46', end: '#ea580c', accent: '#fff7ed', chip: '#fdba74' },
] as const;

export function hashCreativeSeed(value: string): number {
  return Array.from(value || '').reduce((acc, char, index) => ((acc * 33) + char.charCodeAt(0) + index) % 1_000_003, 5381);
}

function pick<T>(list: readonly T[], seed: number, offset = 0): T {
  return list[Math.abs(seed + offset * 17) % list.length];
}

export function createCreativeDirection(seedText: string, index = 0, contentType?: ContentType): CreativeDirection {
  const seed = hashCreativeSeed(`${seedText || 'creative'}::${index}::${contentType || 'default'}`);
  const anglePool = NARRATIVE_ANGLES[contentType || 'default'] || NARRATIVE_ANGLES.default;
  return {
    seed,
    shotType: pick(SHOT_TYPES, seed, 1),
    cameraLanguage: pick(CAMERA_LANGUAGES, seed, 2),
    lightingDirection: pick(LIGHTING_DIRECTIONS, seed, 3),
    paletteDirection: pick(PALETTE_DIRECTIONS, seed, 4),
    visualHook: pick(VISUAL_HOOKS, seed, 5),
    transitionBeat: pick(TRANSITION_BEATS, seed, 6),
    subtitleTone: pick(SUBTITLE_TONES, seed, 7),
    narrativeAngle: pick(anglePool, seed, 8),
  };
}

export function buildFreshIdeaRule(task: CreativeTaskKind, mode: CreativeVariantMode = 'fresh') {
  if (mode === 'similar') {
    return `[${task.toUpperCase()} SIMILARITY RULE]\nUser explicitly requested a similar feel. Keep the core identity and selection constraints, but still avoid an exact duplicate.`;
  }
  return `[${task.toUpperCase()} FRESHNESS RULE]\nDefault to a fresh result. Do not imitate the most recent attempt, cached wording, previous composition, or earlier caption rhythm unless the user explicitly asks for something similar.`;
}

export function buildGenerationSignature(task: CreativeTaskKind, seedText: string, index = 0) {
  const seed = hashCreativeSeed(`${task}::${seedText}::${index}::${Date.now()}`);
  return `${task.toUpperCase()}-FRESH-${Date.now().toString(36)}-${seed.toString(36)}`;
}

export function buildCreativeDirectionBlock(options: {
  task: CreativeTaskKind;
  seedText: string;
  index?: number;
  contentType?: ContentType;
  mode?: CreativeVariantMode;
}) {
  const direction = createCreativeDirection(options.seedText, options.index || 0, options.contentType);
  return [
    buildFreshIdeaRule(options.task, options.mode || 'fresh'),
    `[CREATIVE SIGNATURE] ${buildGenerationSignature(options.task, options.seedText, options.index || 0)}`,
    `[NARRATIVE ANGLE] ${direction.narrativeAngle}`,
    `[SHOT DIRECTION] ${direction.shotType}`,
    `[CAMERA LANGUAGE] ${direction.cameraLanguage}`,
    `[LIGHTING] ${direction.lightingDirection}`,
    `[PALETTE] ${direction.paletteDirection}`,
    `[VISUAL HOOK] ${direction.visualHook}`,
    `[TRANSITION BEAT] ${direction.transitionBeat}`,
    `[SUBTITLE RHYTHM] ${direction.subtitleTone}`,
  ].join('\n');
}

export function buildVariantSuffix(kind: 'character' | 'style', seedText: string, index: number, mode: CreativeVariantMode = 'fresh') {
  const direction = createCreativeDirection(seedText, index);
  if (mode === 'similar') {
    return kind === 'character'
      ? `similar variant ${index + 1}, keep the same character identity, face mood, hairstyle direction, outfit family, and silhouette. Only make a near-match alternative pose or detail update. ${direction.cameraLanguage}`
      : `similar variant ${index + 1}, keep the same art direction, color palette family, lighting rhythm, texture density, mood, and composition language. Only make a near-match alternative. ${direction.cameraLanguage}`;
  }

  return kind === 'character'
    ? `fresh variant ${index + 1}, keep the selected character identity but create a noticeably new outfit detail, pose energy, framing choice, or prop interaction. ${direction.shotType}. ${direction.lightingDirection}. ${direction.visualHook}`
    : `fresh variant ${index + 1}, keep project continuity but generate a newly authored art direction candidate with different staging flavor, palette emphasis, texture rhythm, or lighting focus. ${direction.shotType}. ${direction.paletteDirection}. ${direction.visualHook}`;
}

export function buildSampleTheme(seedText: string, index = 0, _aspectRatio?: AspectRatio) {
  const seed = hashCreativeSeed(`${seedText}::${index}`);
  return pick(SAMPLE_THEMES, seed, 0);
}
