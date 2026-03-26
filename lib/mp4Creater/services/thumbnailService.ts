import { CharacterProfile, PromptedImageAsset, SavedProject, ScriptScene } from '../types';
import { buildCreativeDirectionBlock, buildGenerationSignature } from '../config/creativeVariance';

export interface ThumbnailComposerOptions {
  titleText?: string;
  subtitleText?: string;
  backgroundText?: string;
  leadCharacterId?: string | null;
  leadDirectionText?: string;
  extraDirectionText?: string;
  customPrompt?: string;
  similarPrompt?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function encodeBase64(value: string) {
  if (typeof window !== 'undefined') {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return (globalThis as any).Buffer.from(value, 'utf-8').toString('base64');
}

function resolveImageSrc(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http')) return value;
  return `data:image/png;base64,${value}`;
}

function pickLeadCharacter(project: SavedProject, options?: ThumbnailComposerOptions): CharacterProfile | null {
  const draft = project.workflowDraft;
  if (!draft?.extractedCharacters?.length) return null;
  const selected = draft.extractedCharacters.filter((item) => draft.selectedCharacterIds.includes(item.id));
  if (options?.leadCharacterId) {
    return selected.find((item) => item.id === options.leadCharacterId)
      || draft.extractedCharacters.find((item) => item.id === options.leadCharacterId)
      || selected.find((item) => item.role === 'lead')
      || selected[0]
      || draft.extractedCharacters[0]
      || null;
  }
  return selected.find((item) => item.role === 'lead') || selected[0] || draft.extractedCharacters[0] || null;
}

function pickSelectedStyle(project: SavedProject): PromptedImageAsset | null {
  const draft = project.workflowDraft;
  if (!draft?.styleImages?.length) return null;
  return draft.styleImages.find((item) => item.id === draft.selectedStyleImageId) || draft.styleImages[0] || null;
}

function buildTitleFromTopic(topic: string, override?: string) {
  const safe = (override || topic || '지금 꼭 봐야 할 장면').trim() || '지금 꼭 봐야 할 장면';
  const trimmed = safe.length > 22 ? `${safe.slice(0, 22)}…` : safe;
  return trimmed;
}

function buildSceneSnippet(project: SavedProject, override?: string) {
  const narration = override || project.assets?.[0]?.narration || project.workflowDraft?.script || project.topic || '장면을 요약하는 문장';
  return narration.replace(/\s+/g, ' ').trim().slice(0, 78);
}

export function buildThumbnailLabel(project: SavedProject, customPrompt?: string) {
  const promptLabel = (customPrompt || '').replace(/\s+/g, ' ').trim();
  if (promptLabel) {
    return promptLabel.length > 28 ? `${promptLabel.slice(0, 28)}…` : promptLabel;
  }
  const fallback = (project.thumbnailTitle || project.topic || project.name || '프로젝트 썸네일').trim() || '프로젝트 썸네일';
  return fallback.length > 28 ? `${fallback.slice(0, 28)}…` : fallback;
}

function getCharacterSelectedImage(character?: CharacterProfile | null) {
  if (!character) return '';
  const selected = character.generatedImages?.find((item) => item.id === character.selectedImageId);
  if (selected?.imageData) return selected.imageData;
  if (character.imageData) return character.imageData;
  return character.generatedImages?.find((item) => item.imageData)?.imageData || '';
}

function buildThumbnailStoryBeat(project: SavedProject) {
  const candidates = [
    ...(project.assets || []).map((item) => item.narration || ''),
    project.workflowDraft?.script || '',
    project.topic || '',
  ]
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const joined = candidates.slice(0, 3).join(' / ');
  return joined.slice(0, 320);
}

export function buildThumbnailPrompt(project: SavedProject, variantSeed = 0, options: ThumbnailComposerOptions = {}) {
  const lead = pickLeadCharacter(project, options);
  const style = pickSelectedStyle(project);
  const draft = project.workflowDraft;
  const customPrompt = options.customPrompt?.trim();
  const title = buildTitleFromTopic(project.topic || project.name || '프로젝트 썸네일', options.titleText || undefined);
  const subtitle = buildSceneSnippet(project, options.subtitleText);
  const storyBeat = buildThumbnailStoryBeat(project);
  const backgroundHint = options.backgroundText?.trim() || draft?.selections?.setting || '핵심 사건이 벌어지는 공간';
  const mood = draft?.selections?.mood || '선명하고 강한 감정';
  const leadPrompt = options.leadDirectionText?.trim() || lead?.prompt || lead?.description || '핵심 감정을 보여주는 주인공 상반신 클로즈업';
  const stylePrompt = style?.prompt || '깔끔하고 클릭을 부르는 유튜브 썸네일 아트 디렉션';
  const extraDirection = options.extraDirectionText?.trim();
  const similarDirection = options.similarPrompt?.trim();
  const selectedTemplate = draft?.promptTemplates?.find((item) => item.id === draft?.selectedPromptTemplateId) || draft?.promptTemplates?.[0] || null;
  const selectionSummary = [
    `콘텐츠 타입 ${draft?.contentType || 'story'}`,
    `비율 ${draft?.aspectRatio || '16:9'}`,
    draft?.selections?.genre ? `장르 ${draft.selections.genre}` : '',
    draft?.selections?.mood ? `분위기 ${draft.selections.mood}` : '',
    draft?.selections?.setting ? `배경 ${draft.selections.setting}` : '',
    draft?.selections?.protagonist || lead?.name ? `주인공 ${draft?.selections?.protagonist || lead?.name}` : '',
    draft?.selections?.conflict ? `갈등 ${draft.selections.conflict}` : '',
    draft?.selections?.endingTone ? `엔딩 톤 ${draft.selections.endingTone}` : '',
  ].filter(Boolean).join(' · ');
  const packSummary = [
    draft?.promptPack?.storyPrompt ? `스토리 프롬프트 ${draft.promptPack.storyPrompt}` : '',
    draft?.promptPack?.scenePrompt ? `씬 프롬프트 ${draft.promptPack.scenePrompt}` : '',
    draft?.promptPack?.actionPrompt ? `액션 프롬프트 ${draft.promptPack.actionPrompt}` : '',
    selectedTemplate?.prompt ? `선택 템플릿 ${selectedTemplate.prompt}` : '',
  ].filter(Boolean).join(' · ');
  const sceneReferenceSummary = (project.assets || [])
    .slice(0, 4)
    .map((item) => [item.narration, item.imagePrompt || item.visualPrompt].filter(Boolean).join(' / '))
    .filter(Boolean)
    .join(' · ');
  const freshnessMode = similarDirection ? 'similar' : 'fresh';
  const creativeBlock = buildCreativeDirectionBlock({
    task: 'image',
    seedText: `${project.id || project.name || project.topic}:${title}:${subtitle}:${similarDirection || customPrompt || ''}`,
    index: variantSeed,
    mode: freshnessMode,
    contentType: draft?.contentType,
  });

  return [
    '한국어 유튜브 썸네일 생성용 아트 디렉션.',
    `[GENERATION SIGNATURE] ${buildGenerationSignature('image', `${project.id || project.name || project.topic}:${variantSeed}`, variantSeed)}`,
    creativeBlock,
    similarDirection
      ? '비슷하게 재생성 모드다. 선택 썸네일의 핵심 인물, 구도 계열, 색감 결, 텍스트 무게중심은 유지하되 복제본이 아니라 새 근접 변형을 만든다.'
      : '새롭게 생성 모드다. 같은 프로젝트 안에서 일관성은 유지하되 직전 썸네일 후보와 다른 훅, 다른 배치 포인트, 다른 시선 유도를 우선한다.',
    '개발단 기본 규칙: 대본과 같은 맥락, 같은 감정선, 같은 인물 관계가 한눈에 보여야 한다.',
    `프로젝트 제목: ${project.topic || project.name || '프로젝트'}.`,
    `메인 문구: ${title}. 너무 길게 넣지 말고 크게, 즉시 읽히게 배치한다.`,
    `보조 문구 힌트: ${subtitle}.`,
    `스토리 핵심: ${storyBeat || '첫 장면과 핵심 대사 기준'}.`,
    `선택값 요약: ${selectionSummary || '기본 스토리 구성'}.`,
    `주인공/표정/포즈: ${lead?.name || '주인공'} / ${leadPrompt}.`,
    `배경/공간 힌트: ${backgroundHint}.`,
    `분위기: ${mood}.`,
    `스타일 힌트: ${stylePrompt}.`,
    packSummary ? `워크플로우 프롬프트 팩: ${packSummary}.` : '',
    sceneReferenceSummary ? `실제 씬 참조: ${sceneReferenceSummary}.` : '',
    customPrompt ? `사용자 추가 요청: ${customPrompt}. 이 요청은 기본 연출 위에 자연스럽게 덧입힌다.` : '사용자 추가 요청이 없으면 기본 연출만으로 완성도 높게 구성한다.',
    extraDirection ? `추가 연출: ${extraDirection}.` : '',
    similarDirection ? `직전 후보의 결 유지: ${similarDirection.slice(0, 220)}.` : '',
    '16:9 비율, 고대비, 클릭을 부르는 집중 구도, 인물과 사건이 즉시 이해되는 썸네일, 워터마크와 과한 군더더기 금지.',
    `썸네일 변형 ${variantSeed + 1}.`,
  ].filter(Boolean).join(' ');
}

export function createSampleThumbnail(project: SavedProject, variantSeed = 0, options: ThumbnailComposerOptions = {}): { dataUrl: string; title: string; prompt: string } {
  const lead = pickLeadCharacter(project, options);
  const style = pickSelectedStyle(project);
  const customPrompt = options.customPrompt?.trim();
  const title = buildThumbnailLabel(project, customPrompt || options.titleText);
  const subtitle = buildSceneSnippet(project, options.subtitleText || customPrompt);
  const backgroundHint = options.backgroundText?.trim() || project.workflowDraft?.selections?.setting || 'cinematic city background';
  const leadDirection = options.leadDirectionText?.trim() || lead?.roleLabel || lead?.description || '클릭을 부르는 중심 인물';
  const extraDirection = customPrompt || options.extraDirectionText?.trim() || '큰 타이포, 강한 대비, 깔끔한 시선 유도';
  const styleName = style?.groupLabel || style?.label || '기본 화풍';
  const leadImage = resolveImageSrc(getCharacterSelectedImage(lead));
  const styleImage = resolveImageSrc(style?.imageData || '');
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const safeLead = escapeHtml(lead?.name || '주인공');
  const safeLeadDirection = escapeHtml(leadDirection);
  const safeStyle = escapeHtml(styleName);
  const safeBackground = escapeHtml(backgroundHint);
  const safeExtra = escapeHtml(extraDirection);
  const safeLeadImage = escapeHtml(leadImage);
  const safeStyleImage = escapeHtml(styleImage);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="50%" stop-color="#312e81"/>
        <stop offset="100%" stop-color="#c026d3"/>
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05"/>
      </linearGradient>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#020617" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#020617" stop-opacity="0.75"/>
      </linearGradient>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="18" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    ${safeStyleImage ? `<image href="${safeStyleImage}" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" opacity="0.16"/>` : ''}
    <rect width="1280" height="720" fill="url(#shade)"/>
    <circle cx="1020" cy="128" r="132" fill="#f8fafc" fill-opacity="0.12" filter="url(#softGlow)"/>
    <circle cx="210" cy="600" r="180" fill="#38bdf8" fill-opacity="0.15" filter="url(#softGlow)"/>
    <rect x="46" y="42" width="1188" height="636" rx="34" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.18"/>
    <rect x="76" y="74" width="420" height="572" rx="32" fill="#0f172a" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.16"/>
    ${safeLeadImage ? `<image href="${safeLeadImage}" x="94" y="92" width="384" height="536" preserveAspectRatio="xMidYMid slice" opacity="0.98"/>` : '<circle cx="286" cy="228" r="86" fill="#ffffff" fill-opacity="0.16"/><path d="M190 418c28-82 164-82 192 0" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="22" stroke-linecap="round"/><path d="M286 314v186" stroke="#ffffff" stroke-opacity="0.9" stroke-width="22" stroke-linecap="round"/><path d="M198 402h176" stroke="#ffffff" stroke-opacity="0.9" stroke-width="22" stroke-linecap="round"/>'}
    <rect x="540" y="92" width="644" height="78" rx="24" fill="#ffffff" fill-opacity="0.12"/>
    <text x="576" y="142" fill="#f8fafc" font-size="28" font-family="Arial, sans-serif" font-weight="800">${safeLead} · ${safeStyle}</text>
    <foreignObject x="540" y="204" width="620" height="214">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 78px; line-height: 1.04; font-weight: 900; color: #ffffff; letter-spacing: -0.04em; word-break: keep-all; text-shadow: 0 10px 28px rgba(15,23,42,0.35);">${safeTitle}</div>
    </foreignObject>
    <foreignObject x="544" y="420" width="590" height="116">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 28px; line-height: 1.42; color: #e2e8f0; word-break: keep-all;">${safeSubtitle}</div>
    </foreignObject>
    <rect x="540" y="566" width="292" height="56" rx="18" fill="#0f172a" fill-opacity="0.46" stroke="#ffffff" stroke-opacity="0.16"/>
    <text x="570" y="602" fill="#f8fafc" font-size="24" font-family="Arial, sans-serif" font-weight="700">${safeBackground}</text>
    <rect x="852" y="566" width="306" height="56" rx="18" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.16"/>
    <text x="882" y="602" fill="#ffffff" font-size="24" font-family="Arial, sans-serif" font-weight="700">${safeLeadDirection}</text>
    <foreignObject x="540" y="634" width="618" height="48">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 18px; line-height: 1.25; color: rgba(255,255,255,0.74);">${safeExtra} · variation ${variantSeed + 1}</div>
    </foreignObject>
  </svg>`;
  return {
    dataUrl: `data:image/svg+xml;base64,${encodeBase64(svg)}`,
    title,
    prompt: buildThumbnailPrompt(project, variantSeed, options),
  };
}

export function buildThumbnailScene(project: SavedProject, variantSeed = 0, options: ThumbnailComposerOptions = {}): ScriptScene {
  return {
    sceneNumber: 1,
    narration: buildSceneSnippet(project, options.subtitleText),
    visualPrompt: buildThumbnailPrompt(project, variantSeed, options),
    targetDuration: 5,
    aspectRatio: '16:9',
  };
}
