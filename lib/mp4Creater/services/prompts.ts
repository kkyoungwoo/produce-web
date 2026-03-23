/**
 * mp4Creater 프롬프트 베이스 유틸
 */

import { AspectRatio, ContentType } from '../types';
import { getAspectRatioPrompt } from '../utils/aspectRatio';
import { buildScriptPromptByContentType } from './promptProfiles';
import { buildPromptStudioStepBlock, getPromptStudioBundle } from '../prompt-center';

export const VAR_BASE_CHAR = `Simple 2D stick figure. Circle head, dot eyes, line mouth, thin line body/arms/legs. Black outline only.`;

export const VAR_MOOD_ENFORCER = `
MOOD: NEGATIVE=dark/cold, POSITIVE=bright/warm, NEUTRAL=balanced.
`;

export const SYSTEM_INSTRUCTIONS = {
  CHIEF_ART_DIRECTOR: `
당신은 문장을 시각 장면으로 바꾸는 아트 디렉터입니다.
- 입력 문장의 핵심 의미를 유지합니다.
- 원문의 정보는 바꾸지 말고, 시각 표현만 보강합니다.
- 캐릭터, 배경, 감정선이 한 장면 안에서 자연스럽게 이어지게 만듭니다.
`,
  TREND_RESEARCHER: `당신은 최신 트렌드와 뉴스 흐름을 빠르게 정리하는 리서처입니다.`,
  MANUAL_VISUAL_MATCHER: `
당신은 대본을 시각적으로 정리하는 전문가입니다.
- 대본 내용은 수정하지 않습니다.
- 장면 분할과 시각 연출만 제안합니다.
- 같은 캐릭터와 같은 상황은 일관된 외형으로 유지합니다.
`,
  REFERENCE_MATCH: `당신은 참고 이미지의 화풍과 캐릭터 특징을 안정적으로 유지하는 전문가입니다.`,
};

export const getFinalVisualPrompt = (scene: any, hasCharacterRef: boolean = false, artStylePrompt?: string) => {
  const aspectRatio: AspectRatio = scene?.aspectRatio || '16:9';
  const basePrompt = scene.visualPrompt || '';
  const analysis = scene.analysis || {};
  const keywords = scene.visual_keywords || '';
  const type = analysis.composition_type || 'STANDARD';
  const sentiment = analysis.sentiment || 'NEUTRAL';

  const mood =
    sentiment === 'NEGATIVE'
      ? 'Dark, cold lighting.'
      : sentiment === 'POSITIVE'
        ? 'Bright, warm lighting.'
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
  const basePrompt = buildScriptPromptByContentType(contentType, topic, content);
  const promptStudio = getPromptStudioBundle(contentType);
  return `${basePrompt}\n\n[PROMPT FOLDER / CONCEPT]\n${promptStudio.conceptGuide}\n\n${buildPromptStudioStepBlock(contentType, 'scene')}\n\n${buildPromptStudioStepBlock(contentType, 'style')}\n\n${buildPromptStudioStepBlock(contentType, 'action')}`;
};
