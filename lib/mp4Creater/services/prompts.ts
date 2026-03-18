/**
 * 프롬프트 시스템 (단순화 버전)
 */

import { AspectRatio, ContentType } from '../types';
import { getAspectRatioPrompt } from '../utils/aspectRatio';
import { buildScriptPromptByContentType } from './promptProfiles';

export const VAR_BASE_CHAR = `Simple 2D stick figure. Circle head, dot eyes, line mouth, thin line body/arms/legs. Black outline only.`;

export const VAR_MOOD_ENFORCER = `
MOOD: NEGATIVE=dark/cold, POSITIVE=bright/warm, NEUTRAL=balanced.
`;

export const SYSTEM_INSTRUCTIONS = {
  CHIEF_ART_DIRECTOR: `
당신은 문장을 이미지로 변환하는 아트 디렉터입니다.
- 문장의 의미를 그대로 시각화하라
- 입력 대본은 절대 바꾸지 말고 씬 설계와 시각화만 보강하라
- 브랜드/인물/배경은 일관성을 유지하라
`,
  TREND_RESEARCHER: `최신 경제 뉴스/트렌드를 발굴하는 리서처입니다.`,
  MANUAL_VISUAL_MATCHER: `
대본을 시각화하는 전문가입니다.
- 대본 내용 수정 금지
- 씬 분할과 시각적 연출만 수행
- 같은 개념은 같은 모습으로 그려라
`,
  REFERENCE_MATCH: `참조 이미지의 화풍을 따르되 캐릭터 일관성을 유지하라.`
};

export const getFinalVisualPrompt = (scene: any, hasCharacterRef: boolean = false, artStylePrompt?: string) => {
  const aspectRatio: AspectRatio = scene?.aspectRatio || '16:9';
  const basePrompt = scene.visualPrompt || '';
  const analysis = scene.analysis || {};
  const keywords = scene.visual_keywords || '';
  const type = analysis.composition_type || 'STANDARD';
  const sentiment = analysis.sentiment || 'NEUTRAL';

  const mood = sentiment === 'NEGATIVE' ? 'Dark, cold lighting.'
    : sentiment === 'POSITIVE' ? 'Bright, warm lighting.'
    : 'Balanced lighting.';

  const styleNote = artStylePrompt ? ` Render in ${artStylePrompt} style.` : '';
  const charPrompt = type === 'NO_CHAR'
    ? `NO CHARACTER - objects/text only.${styleNote}`
    : hasCharacterRef
    ? `Use CHARACTER REFERENCE image.${styleNote}`
    : `Stick figure (${type === 'MICRO' ? '5-15%' : type === 'MACRO' ? '60-80%' : '30-40%'}).${styleNote}`;

  const aspectPrompt = getAspectRatioPrompt(aspectRatio);
  const style = artStylePrompt
    ? `STYLE: ${aspectPrompt}, ${artStylePrompt}.`
    : `STYLE: ${aspectPrompt}, clean cinematic illustration.`;

  const char = hasCharacterRef
    ? `CHARACTER: Match reference image.${styleNote}`
    : `CHARACTER: ${VAR_BASE_CHAR}${styleNote}`;

  return `
${basePrompt}

MOOD: ${mood}
${charPrompt}
${keywords ? `TEXT: "${keywords}"` : ''}

${style}
${char}
${VAR_MOOD_ENFORCER}
`.trim();
};

export const getTrendSearchPrompt = (category: string, _usedTopicsString: string) =>
  `Search for 4 trending "${category}" topics. Return JSON: [{rank, topic, reason}]`;

export const getScriptGenerationPrompt = (
  topic: string,
  sourceContext?: string | null,
  contentType: ContentType = 'story'
) => {
  const content = sourceContext || topic;
  return buildScriptPromptByContentType(contentType, topic, content);
};
