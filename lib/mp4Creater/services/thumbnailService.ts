import { CharacterProfile, PromptedImageAsset, SavedProject, ScriptScene } from '../types';

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

function pickLeadCharacter(project: SavedProject): CharacterProfile | null {
  const draft = project.workflowDraft;
  if (!draft?.extractedCharacters?.length) return null;
  const selected = draft.extractedCharacters.filter((item) => draft.selectedCharacterIds.includes(item.id));
  return selected.find((item) => item.role === 'lead') || selected[0] || draft.extractedCharacters[0] || null;
}

function pickSelectedStyle(project: SavedProject): PromptedImageAsset | null {
  const draft = project.workflowDraft;
  if (!draft?.styleImages?.length) return null;
  return draft.styleImages.find((item) => item.id === draft.selectedStyleImageId) || draft.styleImages[0] || null;
}

function buildTitleFromTopic(topic: string) {
  const safe = topic.trim() || '지금 꼭 봐야 할 장면';
  const trimmed = safe.length > 20 ? `${safe.slice(0, 20)}…` : safe;
  return trimmed;
}

function buildSceneSnippet(project: SavedProject) {
  const narration = project.assets?.[0]?.narration || project.workflowDraft?.script || project.topic || '장면을 요약하는 문장';
  return narration.replace(/\s+/g, ' ').trim().slice(0, 58);
}

export function buildThumbnailPrompt(project: SavedProject, variantSeed = 0) {
  const lead = pickLeadCharacter(project);
  const style = pickSelectedStyle(project);
  const title = buildTitleFromTopic(project.topic || project.name || '프로젝트 썸네일');
  const firstScene = project.assets?.[0]?.narration || project.workflowDraft?.script || '';
  const backgroundHint = project.workflowDraft?.selections?.setting || 'cinematic background';
  const mood = project.workflowDraft?.selections?.mood || 'clear dramatic mood';
  const leadPrompt = lead?.prompt || lead?.description || 'human lead character close-up';
  const stylePrompt = style?.prompt || 'clean click-worthy thumbnail art direction';
  return `${title} 한국어 썸네일. 배경은 ${backgroundHint}, 전경은 ${lead?.name || '주인공'} 클로즈업. 표정은 클릭을 부르는 집중감. Korean thumbnail title text included. Main hook: ${title}. Story clue: ${firstScene.slice(0, 140)}. Character prompt: ${leadPrompt}. Style prompt: ${stylePrompt}. Mood: ${mood}. Thumbnail variation ${variantSeed + 1}. Keep the same hook but produce a distinct click-worthy composition from earlier attempts. 16:9 thumbnail composition, strong focal contrast, clean readable layout, no watermark.`;
}

export function createSampleThumbnail(project: SavedProject, variantSeed = 0): { dataUrl: string; title: string; prompt: string } {
  const lead = pickLeadCharacter(project);
  const style = pickSelectedStyle(project);
  const title = buildTitleFromTopic(project.topic || project.name || '프로젝트 썸네일');
  const sceneSnippet = buildSceneSnippet(project);
  const leadName = lead?.name || '주인공';
  const role = lead?.roleLabel || lead?.description || '핵심 인물';
  const styleName = style?.groupLabel || style?.label || '기본 화풍';
  const safeTitle = escapeHtml(title);
  const safeScene = escapeHtml(sceneSnippet);
  const safeLead = escapeHtml(leadName);
  const safeRole = escapeHtml(role);
  const safeStyle = escapeHtml(styleName);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="45%" stop-color="#1d4ed8"/>
        <stop offset="100%" stop-color="#7c3aed"/>
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <circle cx="1000" cy="170" r="150" fill="#fde68a" fill-opacity="0.18"/>
    <circle cx="260" cy="520" r="190" fill="#93c5fd" fill-opacity="0.20"/>
    <rect x="52" y="56" width="1176" height="608" rx="32" fill="url(#card)" stroke="#ffffff" stroke-opacity="0.15"/>
    <rect x="96" y="110" width="420" height="500" rx="28" fill="#0f172a" fill-opacity="0.42" stroke="#ffffff" stroke-opacity="0.18"/>
    <circle cx="306" cy="256" r="92" fill="#ffffff" fill-opacity="0.20"/>
    <path d="M214 420 C246 334 366 334 398 420" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round"/>
    <path d="M306 318 L306 510" stroke="#ffffff" stroke-width="20" stroke-linecap="round"/>
    <path d="M210 402 L402 402" stroke="#ffffff" stroke-width="20" stroke-linecap="round"/>
    <path d="M246 584 L306 510 L366 584" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="570" y="186" fill="#e2e8f0" font-size="32" font-family="Arial, sans-serif" font-weight="700">${safeLead}</text>
    <text x="570" y="228" fill="#cbd5e1" font-size="22" font-family="Arial, sans-serif">${safeRole}</text>
    <text x="570" y="302" fill="#ffffff" font-size="72" font-family="Arial, sans-serif" font-weight="900">${safeTitle}</text>
    <foreignObject x="570" y="346" width="560" height="180">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 28px; line-height: 1.45; color: #e2e8f0; word-break: keep-all;">${safeScene}</div>
    </foreignObject>
    <rect x="570" y="560" width="300" height="56" rx="18" fill="#ffffff" fill-opacity="0.14"/>
    <text x="598" y="597" fill="#f8fafc" font-size="24" font-family="Arial, sans-serif" font-weight="700">${safeStyle}</text>
  </svg>`;
  return {
    dataUrl: `data:image/svg+xml;base64,${encodeBase64(svg)}`,
    title,
    prompt: buildThumbnailPrompt(project, variantSeed),
  };
}

export function buildThumbnailScene(project: SavedProject, variantSeed = 0): ScriptScene {
  return {
    sceneNumber: 1,
    narration: buildSceneSnippet(project),
    visualPrompt: buildThumbnailPrompt(project, variantSeed),
    targetDuration: 5,
    aspectRatio: '16:9',
  };
}
