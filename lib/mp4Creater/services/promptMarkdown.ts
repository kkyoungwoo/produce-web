import { ContentType } from '../types';

type PromptValue = string | null | undefined | false;

function normalizePromptLine(value: PromptValue) {
  return `${value || ''}`.trim();
}

export function joinPromptBlocks(blocks: PromptValue[]) {
  return blocks
    .map((block) => normalizePromptLine(block))
    .filter(Boolean)
    .join('\n\n');
}

export function splitGuideLines(text?: string | null) {
  return `${text || ''}`
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !/^\[[^\]]+\]$/.test(line));
}

export function buildMarkdownSection(
  title: string,
  lines: PromptValue[],
  options?: { level?: 1 | 2 | 3; bullet?: boolean }
) {
  const level = options?.level || 2;
  const bullet = options?.bullet !== false;
  const cleaned = lines
    .map((line) => normalizePromptLine(line))
    .filter(Boolean);
  if (!cleaned.length) return '';

  const heading = `${'#'.repeat(level)} ${title}`;
  if (!bullet) {
    return [heading, ...cleaned].join('\n');
  }
  return [heading, ...cleaned.map((line) => line.startsWith('- ') ? line : `- ${line}`)].join('\n');
}

export function buildMarkdownKeyValueSection(
  title: string,
  entries: Array<[string, PromptValue]>,
  level: 1 | 2 | 3 = 2
) {
  const lines = entries
    .map(([label, value]) => {
      const normalized = normalizePromptLine(value);
      return normalized ? `- **${label}**: ${normalized}` : '';
    })
    .filter(Boolean);
  if (!lines.length) return '';
  return [`${'#'.repeat(level)} ${title}`, ...lines].join('\n');
}

export function buildConceptDirectionLines(
  contentType: ContentType,
  stage: 'script' | 'scene' | 'motion' | 'thumbnail' | 'music'
) {
  if (stage === 'script') {
    if (contentType === 'music_video') {
      return [
        'Lean into hook strength, singable phrasing, emotional rhythm, and repeatable lyrical lift.',
        'Let the script feel performable from the first generation instead of reading like explanation or screenplay notes.',
      ];
    }
    if (contentType === 'cinematic') {
      return [
        'Favor visible scene beats, atmosphere, emotional pressure, and cinematic aftertaste.',
        'Let each paragraph sound like a scene that can be filmed, not a summary of events.',
      ];
    }
    if (contentType === 'info_delivery') {
      return [
        'Favor clarity, sequence, understanding, and viewer retention over dramatic flourish.',
        'Move through question, explanation, example, comparison, and takeaway with clean spoken flow.',
      ];
    }
    return [
      'Favor story progression, character reaction, and emotional continuity over abstract explanation.',
      'Each paragraph should advance the event flow while staying easy to voice and easy to visualize.',
    ];
  }

  if (stage === 'scene') {
    if (contentType === 'music_video') {
      return [
        'Show rhythm, performance energy, expressive body language, and instantly readable visual hooks.',
        'Keep visual styling bold, but make the scene feel like part of one continuous music video world.',
      ];
    }
    if (contentType === 'cinematic') {
      return [
        'Favor film-like composition, atmosphere, blocking, and emotional residue.',
        'Let the shot feel intentional and cinematic rather than promotional or text-led.',
      ];
    }
    if (contentType === 'info_delivery') {
      return [
        'Favor readable staging, object interaction, emphasis gestures, and immediately understandable visual points.',
        'Support explanation through action and scene layout instead of text props.',
      ];
    }
    return [
      'Favor story beat clarity, character reaction, and cause-and-effect scene progression.',
      'Let each scene feel distinct while still belonging to the same world and emotional arc.',
    ];
  }

  if (stage === 'motion') {
    if (contentType === 'music_video') {
      return [
        'Motion should feel beat-aware, performance-led, and visually musical without turning into a loop.',
        'Use timing, gaze shifts, body rhythm, and scene energy to sell the chorus lift or emotional momentum.',
      ];
    }
    if (contentType === 'cinematic') {
      return [
        'Motion should feel motivated, composed, and emotionally weighted rather than busy.',
        'Use camera movement and blocking to preserve immersion and scene aftertaste.',
      ];
    }
    if (contentType === 'info_delivery') {
      return [
        'Motion should clarify the idea through emphasis, gesture, transitions, and useful focus changes.',
        'Keep the frame readable and explanation-friendly without depending on onscreen text.',
      ];
    }
    return [
      'Motion should push the story forward through reaction, action, and motivated transition timing.',
      'Use movement to connect scene meaning, not to distract from it.',
    ];
  }

  if (stage === 'thumbnail') {
    if (contentType === 'music_video') {
      return [
        'The thumbnail should feel like the strongest performance or emotional hook from the same music video world.',
      ];
    }
    if (contentType === 'cinematic') {
      return [
        'The thumbnail should feel like a decisive film still with atmosphere, tension, and cinematic composition.',
      ];
    }
    if (contentType === 'info_delivery') {
      return [
        'The thumbnail should make the key idea legible at a glance while still feeling visually strong and not text-dependent.',
      ];
    }
    return [
      'The thumbnail should feel like the representative turning point, emotion, or narrative promise of the story.',
    ];
  }

  if (contentType === 'music_video') {
    return [
      'Background music should reinforce vocal rhythm, emotional build, and performance energy without masking the lead.',
    ];
  }
  if (contentType === 'cinematic') {
    return [
      'Background music should reinforce atmosphere, emotional pressure, and cinematic transitions without overpowering narration.',
    ];
  }
  if (contentType === 'info_delivery') {
    return [
      'Background music should support pacing and clarity while staying unobtrusive behind information delivery.',
    ];
  }
  return [
    'Background music should support story flow, scene emotion, and transitions without stealing focus from the narration.',
  ];
}

export function buildSimilarityControlLines() {
  return [
    'Default to a fresh result with the same project continuity.',
    'Only stay near the previous result when the user explicitly asks for a similar variation.',
    'When similarity is requested, preserve identity and overall vibe without duplicating the last output.',
  ];
}

export function buildTransitionIntentLines(
  contentType: ContentType,
  stage: 'script' | 'scene' | 'motion'
) {
  if (stage === 'script') {
    return [
      'Paragraph endings should leave a natural handoff into the next scene instead of ending like a dead stop.',
      contentType === 'music_video'
        ? 'When one lyrical block lands, leave a rhythm, emotional echo, or performance cue that makes the next block feel like the same song continuing.'
        : 'When one paragraph lands, leave a reaction, image, question, emotional echo, or action impulse that can transition into the next scene.',
    ];
  }

  if (stage === 'scene') {
    return [
      'Show the representative moment of this scene, but leave enough arrival or exit energy for a natural cut.',
      'Avoid freeze-frame logic unless the scene explicitly wants a hard stop.',
    ];
  }

  return [
    'Motion timing should feel motivated by dialogue, performance, action, or emotional landing.',
    'Let the end of the shot either resolve naturally or hand off into the next scene without an abrupt dead stop.',
  ];
}
