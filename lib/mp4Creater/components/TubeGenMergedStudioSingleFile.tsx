"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type VideoMode = "music_video" | "animation" | "story" | "film";
type AspectRatio = "16:9" | "1:1" | "9:16";
type FlowStageKey = "script" | "image" | "audio" | "video" | "final";
type FlowStatus = "todo" | "done" | "skipped";
type AsyncStatus = "idle" | "running" | "done" | "error" | "cancelled";
type WorkKey = "topic" | "script" | "image" | "audio" | "video" | "final";
type AssetKind = "image" | "video" | "audio" | "thumbnail" | "render" | "subtitle" | "json" | "prompt";
type EditorPhase = "write" | "compose";
type BlogMediaType = "image" | "video";
type BlogMediaStatus = "idle" | "loading" | "ready";
type BlogQuickAction = "짧게" | "자세히" | "문장 정리" | "후킹 추가" | "이미지 힌트";
type StudioTab = "setup" | "script" | "compose" | "audio" | "video" | "final";
type DrawerKey = "none" | "settings" | "logs" | "assets" | "projects";
type ContentConcept = "music_video" | "info_share" | "story" | "cinematic";

type PromptBundle = {
  topic: string;
  outline: string;
  script: string;
  audio: string;
  scenes: string;
  motions: string;
  thumbnail: string;
};

type LocalAsset = {
  id: string;
  name: string;
  kind: AssetKind;
  src: string;
  mimeType?: string;
  tags: string[];
  createdAt: string;
  note?: string;
  storagePath?: string;
};

type ScriptParagraph = {
  id: string;
  index: number;
  text: string;
  estimatedSeconds: number;
};

type SubtitleItem = {
  id: string;
  paragraphId?: string;
  start: number;
  end: number;
  text: string;
};

type AudioClip = {
  id: string;
  kind: "voice" | "music";
  paragraphId?: string;
  title: string;
  src: string;
  duration: number;
  startTrim: number;
  endTrim: number;
  voiceId?: string;
};

type SceneItem = {
  id: string;
  paragraphId?: string;
  title: string;
  imagePromptEn: string;
  imagePromptKo: string;
  motionPromptKo: string;
  estimatedSeconds: number;
  imageAssetId?: string;
  videoAssetId?: string;
  aspectRatio: AspectRatio;
  styleLocked: boolean;
};

type BlogBlock = {
  id: string;
  order: number;
  paragraphId?: string;
  sceneId?: string;
  kind: "hook" | "body" | "ending";
  title: string;
  body: string;
  sideNote: string;
  mediaType: BlogMediaType;
  mediaStatus: BlogMediaStatus;
  mediaAssetId?: string;
  skeleton: boolean;
  quickActions: BlogQuickAction[];
};

type StageStatusMap = Record<FlowStageKey, FlowStatus>;

type ProjectRecord = {
  id: string;
  title: string;
  topic: string;
  concept: ContentConcept;
  mode: VideoMode;
  aspectRatio: AspectRatio;
  minutes: number;
  includeSubtitles: boolean;
  voiceId: string;
  selectedLanguage: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  outline: string;
  scriptDraft: string;
  script: string;
  paragraphs: ScriptParagraph[];
  subtitles: SubtitleItem[];
  audioClips: AudioClip[];
  scenes: SceneItem[];
  blogBlocks: BlogBlock[];
  editorPhase: EditorPhase;
  thumbnailAssetIds: string[];
  renderWithSubId?: string;
  renderCleanId?: string;
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
  prompts: PromptBundle;
  stageStatus: StageStatusMap;
  logs: string[];
};

type AppSettings = {
  selectedFolderName: string;
  language: string;
  easyMode: boolean;
  preferredMinutes: number;
};

type ProjectFormState = {
  title: string;
  topic: string;
  concept: ContentConcept;
  videoMode: VideoMode;
  ratio: AspectRatio;
  minutes: number;
  voiceId: string;
  includeSubtitles: boolean;
  language: string;
};

const STORAGE_KEYS = {
  projects: "tubegen.merged.projects.v1",
  assets: "tubegen.merged.assets.v1",
  settings: "tubegen.merged.settings.v1",
};

const MODE_LABELS: Record<VideoMode, string> = {
  music_video: "뮤직비디오",
  animation: "애니메이션",
  story: "이야기",
  film: "영화 스타일",
};

const CONCEPT_LABELS: Record<ContentConcept, string> = {
  music_video: "뮤직비디오",
  info_share: "정보 공유",
  story: "이야기",
  cinematic: "시네마틱",
};

const CONCEPT_DESCRIPTIONS: Record<ContentConcept, string> = {
  music_video: "후렴, 리듬, 반복 장면, 감정 훅 중심으로 프롬프트를 강화합니다.",
  info_share: "정보 전달형 구조로 핵심 요점, 순서, 이해하기 쉬운 문장을 먼저 만듭니다.",
  story: "도입, 전개, 반전, 여운 흐름으로 내레이션과 장면을 설계합니다.",
  cinematic: "느린 템포, 구도, 몰입감, 감정선 중심으로 컷을 설계합니다.",
};

const FLOW_STAGES: { id: FlowStageKey; label: string; caption: string }[] = [
  { id: "script", label: "1. 대본", caption: "주제와 초안" },
  { id: "image", label: "2. 구성", caption: "블록과 씬" },
  { id: "audio", label: "3. 오디오", caption: "나레이션과 BGM" },
  { id: "video", label: "4. 영상", caption: "행동 프롬프트" },
  { id: "final", label: "5. 결과", caption: "썸네일과 내보내기" },
];

const STUDIO_TABS: { id: StudioTab; label: string }[] = [
  { id: "setup", label: "시작 설정" },
  { id: "script", label: "대본" },
  { id: "compose", label: "구성" },
  { id: "audio", label: "오디오" },
  { id: "video", label: "영상" },
  { id: "final", label: "결과" },
];

const SAMPLE_TOPICS_BY_CONCEPT: Record<ContentConcept, string[]> = {
  music_video: [
    "새벽 도시에 남겨진 미련을 노래하는 감성 뮤직비디오",
    "퇴근길 지하철에서 다시 시작되는 마음의 후렴",
    "서울 야경과 함께 흘러가는 재회 직전의 감정",
  ],
  info_share: [
    "처음 유튜브 쇼츠를 만드는 사람이 꼭 알아야 할 5단계",
    "AI로 짧은 영상을 만들 때 실패를 줄이는 실전 팁",
    "초보자가 대본부터 썸네일까지 만드는 가장 쉬운 순서",
  ],
  story: [
    "야간 편의점에서 시작되는 작은 반전",
    "지하철 막차에서 만난 이상한 동료",
    "서울 골목에서 다시 시작하는 꿈",
  ],
  cinematic: [
    "비 오는 새벽, 텅 빈 주차장에서 시작되는 추적",
    "네온사인 아래에서 다시 만난 두 사람의 침묵",
    "도시 외곽 공장지대에서 벌어지는 조용한 결심",
  ],
};

const LANGUAGE_OPTIONS = [
  { code: "ko-KR", label: "한국어" },
  { code: "en-US", label: "English" },
  { code: "ja-JP", label: "日本語" },
  { code: "zh-CN", label: "中文" },
  { code: "es-ES", label: "Español" },
];

const VOICES = ["voice-default-01", "voice-soft-02", "voice-bright-03", "voice-calm-04"];
const BLOG_QUICK_ACTIONS: BlogQuickAction[] = ["짧게", "자세히", "문장 정리", "후킹 추가", "이미지 힌트"];

const defaultSettings: AppSettings = {
  selectedFolderName: "",
  language: "ko-KR",
  easyMode: true,
  preferredMinutes: 3,
};

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";
const panelClass =
  "rounded-[28px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_12px_40px_rgba(2,6,23,0.45)] backdrop-blur-xl";
const primaryButton =
  "rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50";
const secondaryButton =
  "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-50";
const warningButton =
  "rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-50";

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

function normalizeEditorText(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function estimateSeconds(text: string) {
  const chars = text.replace(/\s+/g, "").length;
  return Math.max(3, Math.round(chars / 5));
}

function splitIntoParagraphs(script: string): ScriptParagraph[] {
  const chunks = script
    .replace(/\r/g, "")
    .split(/\n{2,}|(?<=[.!?。]|다\.|요\.|니다\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return chunks.map((text, index) => ({
    id: uid("para"),
    index,
    text,
    estimatedSeconds: estimateSeconds(text),
  }));
}

function makeSubtitles(paragraphs: ScriptParagraph[]): SubtitleItem[] {
  let cursor = 0;
  return paragraphs.map((paragraph) => {
    const start = cursor;
    const end = cursor + paragraph.estimatedSeconds;
    cursor = end;
    return {
      id: uid("sub"),
      paragraphId: paragraph.id,
      start,
      end,
      text: paragraph.text,
    };
  });
}

function makeVoiceClips(paragraphs: ScriptParagraph[], voiceId: string): AudioClip[] {
  return paragraphs.map((paragraph) => ({
    id: uid("voice"),
    kind: "voice",
    paragraphId: paragraph.id,
    title: `문단 ${paragraph.index + 1} 나레이션`,
    src: "",
    duration: paragraph.estimatedSeconds,
    startTrim: 0,
    endTrim: paragraph.estimatedSeconds,
    voiceId,
  }));
}

function getConceptPreset(concept: ContentConcept) {
  if (concept === "music_video") {
    return {
      mode: "music_video" as VideoMode,
      ratio: "9:16" as AspectRatio,
      title: "감성 뮤직비디오 프로젝트",
      topic: SAMPLE_TOPICS_BY_CONCEPT[concept][0],
      promptIntro: "후렴이 떠오르는 문장, 반복 장면, 리듬감 있는 흐름을 우선한다.",
    };
  }
  if (concept === "info_share") {
    return {
      mode: "story" as VideoMode,
      ratio: "9:16" as AspectRatio,
      title: "정보 공유 쇼츠 프로젝트",
      topic: SAMPLE_TOPICS_BY_CONCEPT[concept][0],
      promptIntro: "처음 보는 사람도 이해하기 쉬운 구조, 핵심 포인트, 요약형 문장을 우선한다.",
    };
  }
  if (concept === "cinematic") {
    return {
      mode: "film" as VideoMode,
      ratio: "16:9" as AspectRatio,
      title: "시네마틱 영상 프로젝트",
      topic: SAMPLE_TOPICS_BY_CONCEPT[concept][0],
      promptIntro: "장면 구도, 침묵, 시선 이동, 분위기 중심의 묘사를 우선한다.",
    };
  }
  return {
    mode: "story" as VideoMode,
    ratio: "16:9" as AspectRatio,
    title: "이야기형 프로젝트",
    topic: SAMPLE_TOPICS_BY_CONCEPT[concept][0],
    promptIntro: "도입, 전개, 위기, 결말이 살아있는 내레이션 중심 구성을 우선한다.",
  };
}

function buildPrompts(concept: ContentConcept, topic: string, language: string, minutes: number): PromptBundle {
  const conceptLead = getConceptPreset(concept).promptIntro;
  return {
    topic: `컨셉: ${CONCEPT_LABELS[concept]}\n언어: ${language}\n길이: ${minutes}분\n주제: ${topic}\n지침: ${conceptLead}`,
    outline: `${conceptLead} 초보자도 이해 가능한 순서형 개요를 만든다.`,
    script: `${conceptLead} 결과는 문단 단위로 잘 끊기고 바로 장면화할 수 있어야 한다.`,
    audio: `${conceptLead} 나레이션 호흡과 배경음 분위기를 함께 잡는다.`,
    scenes: `${conceptLead} 문단별로 이미지 프롬프트와 씬 제목을 정리한다.`,
    motions: `${conceptLead} 장면마다 하나의 핵심 행동만 짧고 분명하게 적는다.`,
    thumbnail: `${conceptLead} 텍스트 없이도 클릭을 유도하는 썸네일 장면을 만든다.`,
  };
}

function createProjectForm(settings: AppSettings): ProjectFormState {
  const preset = getConceptPreset("story");
  return {
    title: preset.title,
    topic: preset.topic,
    concept: "story",
    videoMode: preset.mode,
    ratio: preset.ratio,
    minutes: settings.preferredMinutes,
    voiceId: VOICES[0],
    includeSubtitles: true,
    language: settings.language,
  };
}

function createSampleScript(topic: string, concept: ContentConcept, mode: VideoMode) {
  if (concept === "info_share") {
    return {
      summary: "1. 문제를 짚고 2. 해결 순서를 제시하고 3. 바로 실천할 수 있게 마무리합니다.",
      outline: "도입: 왜 이 주제가 중요한가\n핵심1: 가장 많이 막히는 지점\n핵심2: 초보자가 바로 따라할 수 있는 방법\n마무리: 지금 시작해야 하는 이유",
      script:
        `처음 AI 영상 만들기를 시작하면 대부분은 도구보다 순서에서 막힙니다.\n\n먼저 해야 할 일은 멋진 효과를 찾는 게 아니라, 한 문장으로 주제를 고정하는 것입니다. 주제가 흔들리면 장면도 흔들리고 편집도 길을 잃습니다.\n\n그다음은 대본을 완벽하게 쓰는 대신 문단으로 나누는 일입니다. 문단은 곧 장면이 되고, 장면은 그대로 이미지와 영상 프롬프트의 재료가 됩니다.\n\n세 번째는 처음부터 모든 기능을 다 쓰지 않는 것입니다. 샘플 값으로 시작해서 제목, 주제, 한두 문장만 바꿔도 훨씬 빨리 결과를 볼 수 있습니다.\n\n결국 초보자에게 가장 중요한 것은 복잡한 기술이 아니라, 시작하기 쉬운 구조입니다. 오늘은 딱 한 개 프로젝트만 만들어도 충분합니다.`,
    };
  }

  if (mode === "music_video") {
    return {
      summary: "1. 밤의 리듬이 시작되고 2. 감정이 흔들리며 3. 후렴처럼 다시 앞으로 나아갑니다.",
      outline: "도입: 밤과 이상 신호\n전개: 멈춘 마음의 흔들림\n절정: 리듬의 폭발\n결말: 조용하지만 오래 남는 선택",
      script:
        `막차가 지나간 플랫폼 위에서, 그는 오늘도 아무 일 없다는 얼굴을 연습했다.\n\n도시의 불빛은 늘 같은 자리에서 반짝였지만, 오늘의 공기는 유난히 다른 박자로 흔들렸다.\n\n주머니 속 차가운 손끝으로 마음을 눌러보아도, 오래 접어둔 꿈은 종이처럼 다시 펴졌다.\n\n그때 멀리서 들려온 웃음 하나가 모든 장면의 온도를 바꾸었다. 무너지던 표정은 다시 살아났고, 멈춰 있던 발걸음은 조금씩 앞으로 옮겨졌다.\n\n밤은 끝나지 않았지만, 끝나지 않아서 오히려 좋았다. 그는 완벽한 답 대신 계속 움직이는 마음을 선택했다.`,
    };
  }

  if (concept === "cinematic") {
    return {
      summary: "1. 고요한 공간에 균열이 생기고 2. 침묵 속 선택이 커지며 3. 조용한 결심으로 마무리됩니다.",
      outline: "발단: 텅 빈 공간과 징후\n전개: 시선과 침묵의 압박\n절정: 피할 수 없는 결단\n결말: 조용한 여운",
      script:
        `비가 막 그친 주차장은 이상할 만큼 조용했다.\n\n그는 멈춘 차들 사이를 천천히 걸었고, 젖은 바닥에 반사된 빛만이 움직임을 대신했다.\n\n누군가는 늦었다고 생각했지만, 그는 오히려 지금이 가장 정확한 시간이라고 믿었다.\n\n멀리 닫히는 문 소리가 한 번 울리자, 오래 미뤄두었던 선택이 더는 미뤄지지 않는다는 것을 알 수 있었다.\n\n그는 고개를 들었고, 그 순간부터 이 밤의 공기는 이전과 같은 공기가 아니었다.`,
    };
  }

  return {
    summary: "1. 평범한 일상에서 시작해 2. 중요한 선택을 지나 3. 작은 변화로 끝납니다.",
    outline: "발단: 낯익은 공간 속 이상한 징후\n전개: 관계와 선택의 압박\n위기: 잃을 것 같은 순간\n결말: 작지만 분명한 변화",
    script:
      `새벽 첫 버스가 지나가기 전, 골목은 늘 가장 솔직했다.\n\n그는 아무 일도 없었던 사람처럼 문을 열고 들어왔지만, 책상 위에 놓인 작은 흔적 하나가 오늘의 방향을 바꿔놓았다.\n\n지워도 남는 얼룩처럼, 오래 외면하던 마음은 자꾸만 시야 끝에 걸렸다.\n\n누군가의 짧은 한마디는 의외로 오래 남았다. 그것은 위로도 명령도 아니었고, 다만 도망칠 수 없게 만드는 거울 같은 것이었다.\n\n결국 그는 아주 큰 선택 대신 아주 분명한 선택 하나를 했다. 어제와 같은 거리였지만, 그날 이후로 같은 사람으로 걷지는 않았다.`,
  };
}

function createSampleScenes(project: ProjectRecord): SceneItem[] {
  const sourceLines = project.paragraphs.length
    ? project.paragraphs.map((paragraph) => paragraph.text)
    : [project.topic, project.summary, project.script].filter(Boolean);

  return sourceLines.slice(0, 6).map((line, index) => ({
    id: uid("scene"),
    paragraphId: project.paragraphs[index]?.id,
    title: `장면 ${index + 1}`,
    imagePromptEn:
      project.concept === "info_share"
        ? `clean educational visual, modern youtube shorts frame, clear hierarchy, simple composition, scene ${index + 1}, ${line.slice(0, 90)}`
        : `cinematic anime frame, clean composition, emotional focus, scene ${index + 1}, ${line.slice(0, 90)}`,
    imagePromptKo: `${line}\n핵심이 바로 보이게 구도와 분위기를 정리합니다.`,
    motionPromptKo: `${index + 1}번 장면의 핵심 요소가 천천히 드러나고 시선이 자연스럽게 이동한다.`,
    estimatedSeconds: project.paragraphs[index]?.estimatedSeconds || 5,
    aspectRatio: project.aspectRatio,
    styleLocked: index > 0,
  }));
}

function createPlaceholderAsset(name: string, kind: AssetKind, note: string) {
  return {
    id: uid("asset"),
    name,
    kind,
    src: "",
    tags: [kind],
    createdAt: new Date().toISOString(),
    note,
  } satisfies LocalAsset;
}

function getBlogBlockKind(index: number, total: number): BlogBlock["kind"] {
  if (index === 0) return "hook";
  if (index === total - 1) return "ending";
  return "body";
}

function getBlogBlockTitle(index: number, total: number) {
  const kind = getBlogBlockKind(index, total);
  if (kind === "hook") return "도입";
  if (kind === "ending") return "마무리";
  return `본문 ${index}`;
}

function shortenBlockText(text: string) {
  const sentences = text
    .split(/(?<=[.!?。]|다\.|요\.|니다\.)\s+/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return text.slice(0, 80).trim();
  return sentences.slice(0, 1).join(" ").trim();
}

function expandBlockText(text: string) {
  const base = normalizeEditorText(text);
  if (!base) return "장면의 감정과 분위기를 한 줄 더 풀어 설명합니다.";
  return `${base}\n이 장면에서 인물의 감정과 주변 분위기를 한 줄 더 보여준다.`;
}

function addHookToText(text: string) {
  const base = normalizeEditorText(text);
  if (!base) return "그런데, 평범해 보이던 장면이 갑자기 다른 의미를 갖기 시작한다.";
  if (/^(그런데|하지만|그 순간)/.test(base)) return base;
  return `그런데, ${base}`;
}

function makeImageHint(text: string) {
  const base = normalizeEditorText(text);
  return `인물은 화면 한쪽, 배경은 넓게, 핵심 문장은 또렷하게. 핵심: ${base.slice(0, 70)}`;
}

function composeScriptFromBlocks(blocks: BlogBlock[]) {
  return normalizeEditorText(blocks.map((block) => block.body.trim()).filter(Boolean).join("\n\n"));
}

function buildProjectPatchFromBlocks(project: ProjectRecord, blocks: BlogBlock[]) {
  const script = composeScriptFromBlocks(blocks);
  const paragraphs = splitIntoParagraphs(script);
  return {
    scriptDraft: script,
    script,
    paragraphs,
    subtitles: makeSubtitles(paragraphs),
    audioClips: makeVoiceClips(paragraphs, project.voiceId),
  };
}

function createSkeletonBlogBlocks(seedText: string, count = 4): BlogBlock[] {
  return Array.from({ length: count }, (_, index) => ({
    id: uid("blog"),
    order: index,
    kind: getBlogBlockKind(index, count),
    title: getBlogBlockTitle(index, count),
    body: index === 0 ? `${seedText || "새 이야기"}의 시작 장면을 준비하는 중입니다.` : `${index + 1}번째 블록 내용을 준비하는 중입니다.`,
    sideNote: "이미지와 흐름 샘플을 준비하는 중입니다.",
    mediaType: "image",
    mediaStatus: "loading",
    skeleton: true,
    quickActions: BLOG_QUICK_ACTIONS,
  }));
}

function createBlogBlocksFromProject(project: ProjectRecord, previousBlocks: BlogBlock[] = []): BlogBlock[] {
  const sourceParagraphs = project.paragraphs.length > 0 ? project.paragraphs : splitIntoParagraphs(project.script || project.scriptDraft || "");
  if (!sourceParagraphs.length) return [];

  const previousByKey = new Map<string, BlogBlock>();
  previousBlocks.forEach((block, index) => {
    const key = block.paragraphId || block.sceneId || `index-${index}`;
    previousByKey.set(key, block);
  });

  return sourceParagraphs.map((paragraph, index) => {
    const scene = project.scenes.find((item) => item.paragraphId === paragraph.id) || project.scenes[index];
    const prev = previousByKey.get(paragraph.id) || (scene ? previousByKey.get(scene.id) : undefined) || previousBlocks[index];
    const mediaAssetId = scene?.videoAssetId || scene?.imageAssetId || prev?.mediaAssetId;
    const mediaType: BlogMediaType = scene?.videoAssetId ? "video" : prev?.mediaType || "image";
    const mediaStatus: BlogMediaStatus = mediaAssetId ? "ready" : scene ? "loading" : prev?.mediaStatus || "idle";

    return {
      id: prev?.id || uid("blog"),
      order: index,
      paragraphId: paragraph.id,
      sceneId: scene?.id,
      kind: getBlogBlockKind(index, sourceParagraphs.length),
      title: prev?.title || getBlogBlockTitle(index, sourceParagraphs.length),
      body: prev?.body || paragraph.text,
      sideNote: prev?.sideNote || scene?.imagePromptKo || scene?.motionPromptKo || makeImageHint(paragraph.text),
      mediaType,
      mediaStatus,
      mediaAssetId,
      skeleton: false,
      quickActions: prev?.quickActions || BLOG_QUICK_ACTIONS,
    };
  });
}

function emptyStageStatus(): StageStatusMap {
  return { script: "todo", image: "todo", audio: "todo", video: "todo", final: "todo" };
}

function makeDefaultProject(form: ProjectFormState): ProjectRecord {
  return {
    id: uid("project"),
    title: form.title.trim() || "새 프로젝트",
    topic: form.topic.trim() || SAMPLE_TOPICS_BY_CONCEPT[form.concept][0],
    concept: form.concept,
    mode: form.videoMode,
    aspectRatio: form.ratio,
    minutes: clamp(form.minutes, 1, 15),
    includeSubtitles: form.includeSubtitles,
    voiceId: form.voiceId,
    selectedLanguage: form.language,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    summary: "",
    outline: "",
    scriptDraft: "",
    script: "",
    paragraphs: [],
    subtitles: [],
    audioClips: [],
    scenes: [],
    blogBlocks: [],
    editorPhase: "write",
    thumbnailAssetIds: [],
    youtubeTitle: "",
    youtubeDescription: "",
    youtubeTags: [],
    prompts: buildPrompts(form.concept, form.topic, form.language, form.minutes),
    stageStatus: emptyStageStatus(),
    logs: [],
  };
}

function toSrtTimestamp(totalSeconds: number) {
  const ms = Math.round((totalSeconds % 1) * 1000);
  const whole = Math.floor(totalSeconds);
  const s = whole % 60;
  const m = Math.floor(whole / 60) % 60;
  const h = Math.floor(whole / 3600);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function buildSrt(subtitles: SubtitleItem[]) {
  return subtitles
    .map((item, index) => `${index + 1}\n${toSrtTimestamp(item.start)} --> ${toSrtTimestamp(item.end)}\n${item.text}\n`)
    .join("\n");
}

export default function TubeGenMergedStudioSingleFile() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [assets, setAssets] = useState<LocalAsset[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>("setup");
  const [drawer, setDrawer] = useState<DrawerKey>("none");
  const [projectForm, setProjectForm] = useState<ProjectFormState>(createProjectForm(defaultSettings));
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [generation, setGeneration] = useState<Record<WorkKey, AsyncStatus>>({ topic: "idle", script: "idle", image: "idle", audio: "idle", video: "idle", final: "idle" });
  const [loadingMessage, setLoadingMessage] = useState("");
  const [estimatedTimeText, setEstimatedTimeText] = useState("");
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [manualAssetName, setManualAssetName] = useState("");
  const [manualAssetKind, setManualAssetKind] = useState<AssetKind>("image");
  const [manualAssetUrl, setManualAssetUrl] = useState("");
  const [globalLogs, setGlobalLogs] = useState<{ id: string; type: "info" | "success" | "warning" | "error"; text: string }[]>([]);
  const [finalPreviewMode, setFinalPreviewMode] = useState<"subtitle" | "clean">("subtitle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadedSettings = readStorage(STORAGE_KEYS.settings, defaultSettings);
    setSettings(loadedSettings);
    setProjectForm(createProjectForm(loadedSettings));
    const loadedProjects = readStorage<ProjectRecord[]>(STORAGE_KEYS.projects, []);
    const loadedAssets = readStorage<LocalAsset[]>(STORAGE_KEYS.assets, []);
    setProjects(loadedProjects);
    setAssets(loadedAssets);
    if (loadedProjects[0]?.id) setActiveProjectId(loadedProjects[0].id);
  }, []);

  useEffect(() => writeStorage(STORAGE_KEYS.settings, settings), [settings]);
  useEffect(() => writeStorage(STORAGE_KEYS.projects, projects), [projects]);
  useEffect(() => writeStorage(STORAGE_KEYS.assets, assets), [assets]);

  const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId) || null, [projects, activeProjectId]);
  const activeBlocks = useMemo(() => activeProject?.blogBlocks || [], [activeProject]);
  const selectedScene = useMemo(() => {
    if (!activeProject) return null;
    return activeProject.scenes.find((scene) => scene.id === selectedSceneId) || activeProject.scenes[0] || null;
  }, [activeProject, selectedSceneId]);
  const finalPreviewAsset = useMemo(() => {
    if (!activeProject) return undefined;
    const targetId = finalPreviewMode === "subtitle" ? activeProject.renderWithSubId : activeProject.renderCleanId;
    return assets.find((a) => a.id === targetId);
  }, [activeProject, finalPreviewMode, assets]);
  const thumbnailAsset = useMemo(() => {
    if (!activeProject?.thumbnailAssetIds?.length) return undefined;
    return assets.find((a) => a.id === activeProject.thumbnailAssetIds[0]);
  }, [activeProject, assets]);

  useEffect(() => {
    if (activeProject?.scenes.length && !selectedSceneId) setSelectedSceneId(activeProject.scenes[0].id);
    if (!activeProject?.scenes.length) setSelectedSceneId(null);
  }, [activeProject, selectedSceneId]);

  function pushLog(message: string, type: "info" | "success" | "warning" | "error" = "info") {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    setGlobalLogs((current) => [{ id: uid("log"), type, text: line }, ...current].slice(0, 200));
    if (!activeProjectId) return;
    setProjects((current) => current.map((project) => project.id === activeProjectId ? { ...project, updatedAt: new Date().toISOString(), logs: [line, ...project.logs].slice(0, 100) } : project));
  }

  function updateProjectById(projectId: string, patch: Partial<ProjectRecord>) {
    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project));
  }

  function updateActiveProject(patch: Partial<ProjectRecord>) {
    if (!activeProject) return;
    updateProjectById(activeProject.id, patch);
  }

  function rebuildProjectForBlogFlow(projectId: string, patch: Partial<ProjectRecord>, options?: { forceCompose?: boolean }) {
    setProjects((current) => current.map((project) => {
      if (project.id !== projectId) return project;
      const merged = { ...project, ...patch, updatedAt: new Date().toISOString() } as ProjectRecord;
      if (options?.forceCompose) merged.editorPhase = "compose";
      const incomingBlocks = patch.blogBlocks;
      if (incomingBlocks?.some((block) => block.skeleton)) {
        merged.blogBlocks = incomingBlocks;
        return merged;
      }
      if (incomingBlocks) {
        merged.blogBlocks = createBlogBlocksFromProject(merged, incomingBlocks);
      } else if (merged.editorPhase === "compose" || merged.script.trim() || merged.scriptDraft.trim() || merged.scenes.length) {
        merged.blogBlocks = createBlogBlocksFromProject(merged, project.blogBlocks);
      }
      return merged;
    }));
  }

  function switchConcept(nextConcept: ContentConcept) {
    const preset = getConceptPreset(nextConcept);
    setProjectForm((current) => ({
      ...current,
      concept: nextConcept,
      title: current.title.trim() ? current.title : preset.title,
      topic: current.topic.trim() ? current.topic : preset.topic,
      videoMode: preset.mode,
      ratio: preset.ratio,
    }));
  }

  function fillConceptSample(nextConcept: ContentConcept) {
    const sampleTopic = SAMPLE_TOPICS_BY_CONCEPT[nextConcept][Math.floor(Math.random() * SAMPLE_TOPICS_BY_CONCEPT[nextConcept].length)];
    const preset = getConceptPreset(nextConcept);
    setProjectForm((current) => ({
      ...current,
      concept: nextConcept,
      title: preset.title,
      topic: sampleTopic,
      videoMode: preset.mode,
      ratio: preset.ratio,
    }));
  }

  function createProject() {
    const project = makeDefaultProject(projectForm);
    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.id);
    setActiveStudioTab("setup");
    setShowProjectModal(false);
    pushLog(`프로젝트 "${project.title}" 생성 완료`, "success");
  }

  function startWithSample() {
    fillConceptSample(projectForm.concept);
    setShowProjectModal(true);
  }

  function applySampleScript(project: ProjectRecord) {
    const sample = createSampleScript(project.topic, project.concept, project.mode);
    const paragraphs = splitIntoParagraphs(sample.script);
    rebuildProjectForBlogFlow(project.id, {
      summary: sample.summary,
      outline: sample.outline,
      scriptDraft: sample.script,
      script: sample.script,
      paragraphs,
      subtitles: makeSubtitles(paragraphs),
      audioClips: makeVoiceClips(paragraphs, project.voiceId),
      youtubeTitle: `${project.topic} · ${CONCEPT_LABELS[project.concept]}`,
      youtubeDescription: `${project.topic}\n${sample.summary}`,
      youtubeTags: [project.concept, project.mode, "ai-video"],
      stageStatus: { ...project.stageStatus, script: "done" },
    }, { forceCompose: true });
    setActiveStudioTab("compose");
    pushLog("샘플 대본을 적용했습니다.", "success");
  }

  function startComposeFromDraft(project: ProjectRecord, rawDraft?: string) {
    const draft = normalizeEditorText(rawDraft || project.scriptDraft || project.script || project.topic);
    const paragraphs = splitIntoParagraphs(draft);
    const blockCount = Math.max(3, Math.min(6, paragraphs.length || project.minutes || 4));
    rebuildProjectForBlogFlow(project.id, {
      scriptDraft: draft,
      script: draft,
      paragraphs,
      subtitles: makeSubtitles(paragraphs),
      audioClips: makeVoiceClips(paragraphs, project.voiceId),
      blogBlocks: createSkeletonBlogBlocks(draft || project.topic, blockCount),
      stageStatus: { ...project.stageStatus, script: "done" },
    }, { forceCompose: true });

    setTimeout(() => {
      setProjects((current) => current.map((item) => {
        if (item.id !== project.id) return item;
        const merged: ProjectRecord = {
          ...item,
          scriptDraft: draft,
          script: draft,
          paragraphs,
          subtitles: makeSubtitles(paragraphs),
          audioClips: makeVoiceClips(paragraphs, project.voiceId),
          stageStatus: { ...item.stageStatus, script: "done" },
          editorPhase: "compose",
          updatedAt: new Date().toISOString(),
        };
        return { ...merged, blogBlocks: createBlogBlocksFromProject(merged, item.blogBlocks) };
      }));
    }, 300);

    setActiveStudioTab("compose");
    pushLog("대본을 구성 블록으로 전개했습니다.", "success");
  }

  function applySampleImageStage(project: ProjectRecord) {
    const scenes = createSampleScenes(project);
    rebuildProjectForBlogFlow(project.id, { scenes, stageStatus: { ...project.stageStatus, image: "done" } });
    if (scenes[0]?.id) setSelectedSceneId(scenes[0].id);
    pushLog("샘플 장면을 생성했습니다.", "success");
  }

  function applySampleAudioStage(project: ProjectRecord) {
    const paragraphs = project.paragraphs.length ? project.paragraphs : splitIntoParagraphs(project.script || project.scriptDraft);
    const voiceClips = makeVoiceClips(paragraphs, project.voiceId);
    const totalDuration = Math.max(20, paragraphs.reduce((sum, item) => sum + item.estimatedSeconds, 0));
    const music: AudioClip = { id: uid("bgm"), kind: "music", title: project.concept === "music_video" ? "샘플 후렴 배경음" : "샘플 배경 음악", src: "", duration: totalDuration, startTrim: 0, endTrim: totalDuration };
    updateProjectById(project.id, { paragraphs, audioClips: [...voiceClips, music], stageStatus: { ...project.stageStatus, audio: "done" } });
    pushLog("샘플 오디오 구성을 적용했습니다.", "success");
  }

  function applySampleVideoStage(project: ProjectRecord) {
    const scenes = (project.scenes.length ? project.scenes : createSampleScenes(project)).map((scene, index) => ({
      ...scene,
      motionPromptKo: scene.motionPromptKo || `${index + 1}번 장면의 중심 요소가 천천히 드러나며 감정의 방향이 선명해진다.`,
    }));
    rebuildProjectForBlogFlow(project.id, { scenes, stageStatus: { ...project.stageStatus, video: "done" } });
    pushLog("샘플 영상 프롬프트를 적용했습니다.", "success");
  }

  function applySampleFinalStage(project: ProjectRecord) {
    const thumb = createPlaceholderAsset(`${project.title} 썸네일`, "thumbnail", "텍스트 없는 썸네일 샘플");
    const clean = createPlaceholderAsset(`${project.title} clean mp4`, "render", "깨끗한 버전 샘플 결과물");
    const sub = createPlaceholderAsset(`${project.title} subtitle mp4`, "render", "자막 포함 샘플 결과물");
    setAssets((current) => [thumb, clean, sub, ...current]);
    updateProjectById(project.id, {
      thumbnailAssetIds: [thumb.id],
      renderCleanId: clean.id,
      renderWithSubId: sub.id,
      stageStatus: { ...project.stageStatus, final: "done" },
    });
    pushLog("최종 샘플 결과물을 추가했습니다.", "success");
  }

  function updateBlogBlock(blockId: string, patch: Partial<BlogBlock>) {
    if (!activeProject) return;
    const nextBlocks = activeProject.blogBlocks.map((block) => block.id === blockId ? { ...block, ...patch, skeleton: false } : block);
    const nextScriptPatch = buildProjectPatchFromBlocks(activeProject, nextBlocks);
    rebuildProjectForBlogFlow(activeProject.id, { ...nextScriptPatch, blogBlocks: nextBlocks, stageStatus: { ...activeProject.stageStatus, script: "done" } }, { forceCompose: true });
  }

  function applyBlogQuickAction(blockId: string, action: BlogQuickAction) {
    if (!activeProject) return;
    const block = activeProject.blogBlocks.find((item) => item.id === blockId);
    if (!block) return;
    if (action === "짧게") return updateBlogBlock(blockId, { body: shortenBlockText(block.body) });
    if (action === "자세히") return updateBlogBlock(blockId, { body: expandBlockText(block.body) });
    if (action === "문장 정리") return updateBlogBlock(blockId, { body: normalizeEditorText(block.body) });
    if (action === "후킹 추가") return updateBlogBlock(blockId, { body: addHookToText(block.body) });
    if (action === "이미지 힌트") return updateBlogBlock(blockId, { sideNote: makeImageHint(block.body) });
  }

  function addBlogBlockAfter(blockId: string) {
    if (!activeProject) return;
    const index = activeProject.blogBlocks.findIndex((item) => item.id === blockId);
    if (index < 0) return;
    const next = [...activeProject.blogBlocks];
    next.splice(index + 1, 0, {
      id: uid("blog"),
      order: index + 1,
      kind: "body",
      title: "새 블록",
      body: "새 블록 내용을 입력하세요.",
      sideNote: "오른쪽 미디어 설명을 적어두세요.",
      mediaType: "image",
      mediaStatus: "idle",
      skeleton: false,
      quickActions: BLOG_QUICK_ACTIONS,
    });
    const reOrdered = next.map((block, i) => ({ ...block, order: i }));
    const nextPatch = buildProjectPatchFromBlocks(activeProject, reOrdered);
    rebuildProjectForBlogFlow(activeProject.id, { ...nextPatch, blogBlocks: reOrdered }, { forceCompose: true });
  }

  function removeBlogBlock(blockId: string) {
    if (!activeProject || activeProject.blogBlocks.length <= 1) return;
    const next = activeProject.blogBlocks.filter((item) => item.id !== blockId).map((block, i) => ({ ...block, order: i }));
    const nextPatch = buildProjectPatchFromBlocks(activeProject, next);
    rebuildProjectForBlogFlow(activeProject.id, { ...nextPatch, blogBlocks: next }, { forceCompose: true });
  }

  function moveBlogBlock(blockId: string, direction: "up" | "down") {
    if (!activeProject) return;
    const next = [...activeProject.blogBlocks];
    const index = next.findIndex((item) => item.id === blockId);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const reOrdered = next.map((block, i) => ({ ...block, order: i }));
    const nextPatch = buildProjectPatchFromBlocks(activeProject, reOrdered);
    rebuildProjectForBlogFlow(activeProject.id, { ...nextPatch, blogBlocks: reOrdered }, { forceCompose: true });
  }

  function generateImageForScene(sceneId: string) {
    if (!activeProject) return;
    const scene = activeProject.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    const asset = createPlaceholderAsset(`${scene.title} 이미지`, "image", scene.imagePromptKo || scene.imagePromptEn);
    setAssets((current) => [asset, ...current]);
    rebuildProjectForBlogFlow(activeProject.id, { scenes: activeProject.scenes.map((item) => item.id === sceneId ? { ...item, imageAssetId: asset.id } : item), stageStatus: { ...activeProject.stageStatus, image: "done" } });
    pushLog(`${scene.title}용 이미지 자산을 추가했습니다.`, "success");
  }

  function generateVideoForScene(sceneId: string) {
    if (!activeProject) return;
    const scene = activeProject.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    const asset = createPlaceholderAsset(`${scene.title} 영상`, "video", scene.motionPromptKo);
    setAssets((current) => [asset, ...current]);
    rebuildProjectForBlogFlow(activeProject.id, { scenes: activeProject.scenes.map((item) => item.id === sceneId ? { ...item, videoAssetId: asset.id } : item), stageStatus: { ...activeProject.stageStatus, video: "done" } });
    pushLog(`${scene.title}용 영상 자산을 추가했습니다.`, "success");
  }

  function addManualCutToProject() {
    if (!activeProject) return;
    const scene: SceneItem = {
      id: uid("scene"),
      title: `수동 컷 ${activeProject.scenes.length + 1}`,
      imagePromptEn: "",
      imagePromptKo: "",
      motionPromptKo: "",
      estimatedSeconds: 5,
      aspectRatio: activeProject.aspectRatio,
      styleLocked: false,
    };
    const scenes = [...activeProject.scenes, scene];
    rebuildProjectForBlogFlow(activeProject.id, { scenes });
    setSelectedSceneId(scene.id);
  }

  function exportProjectJson() {
    if (!activeProject) return;
    const blob = new Blob([JSON.stringify(activeProject, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeProject.title || "project"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    pushLog("프로젝트 JSON 다운로드 완료", "success");
  }

  function exportSrtForProject() {
    if (!activeProject) return;
    const srt = buildSrt(activeProject.subtitles);
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeProject.title || "subtitles"}.srt`;
    anchor.click();
    URL.revokeObjectURL(url);
    pushLog("SRT 다운로드 완료", "success");
  }

  function exportCurrentComponentFile() {
    const source = `이 버튼은 앱 내부 기능용 자리입니다. 실제 컴포넌트 파일은 ChatGPT가 생성한 다운로드 파일을 사용하세요.`;
    const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `component-export-note.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addAssetManually() {
    if (!manualAssetName.trim() || !manualAssetUrl.trim()) return;
    const asset: LocalAsset = {
      id: uid("asset"),
      name: manualAssetName,
      kind: manualAssetKind,
      src: manualAssetUrl,
      tags: ["manual"],
      createdAt: new Date().toISOString(),
    };
    setAssets((current) => [asset, ...current]);
    setManualAssetName("");
    setManualAssetUrl("");
    pushLog(`${asset.name} 자산 저장 완료`, "success");
  }

  function uploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const asset: LocalAsset = {
          id: uid("asset"),
          name: file.name,
          kind: file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "json",
          src: String(reader.result || ""),
          mimeType: file.type,
          tags: ["upload"],
          createdAt: new Date().toISOString(),
        };
        setAssets((current) => [asset, ...current]);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
    pushLog(`${files.length}개 파일 업로드 완료`, "success");
  }

  function removeAsset(assetId: string) {
    setAssets((current) => current.filter((asset) => asset.id !== assetId));
    setProjects((current) => current.map((project) => ({
      ...project,
      scenes: project.scenes.map((scene) => ({ ...scene, imageAssetId: scene.imageAssetId === assetId ? undefined : scene.imageAssetId, videoAssetId: scene.videoAssetId === assetId ? undefined : scene.videoAssetId })),
      blogBlocks: project.blogBlocks.map((block) => ({ ...block, mediaAssetId: block.mediaAssetId === assetId ? undefined : block.mediaAssetId })),
      thumbnailAssetIds: project.thumbnailAssetIds.filter((id) => id !== assetId),
      renderCleanId: project.renderCleanId === assetId ? undefined : project.renderCleanId,
      renderWithSubId: project.renderWithSubId === assetId ? undefined : project.renderWithSubId,
    })));
  }

  function duplicateProject(project: ProjectRecord) {
    const copy = { ...project, id: uid("project"), title: `${project.title} 복사본`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), logs: [] };
    setProjects((current) => [copy, ...current]);
    setActiveProjectId(copy.id);
  }

  function deleteProject(projectId: string) {
    const remaining = projects.filter((p) => p.id !== projectId);
    setProjects(remaining);
    if (activeProjectId === projectId) setActiveProjectId(remaining[0]?.id || null);
  }

  function completeByData(project: ProjectRecord, stage: FlowStageKey) {
    if (stage === "script") return Boolean(project.script.trim() && project.paragraphs.length);
    if (stage === "image") return Boolean(project.blogBlocks.length || project.scenes.length);
    if (stage === "audio") return Boolean(project.audioClips.length);
    if (stage === "video") return Boolean(project.scenes.some((scene) => scene.motionPromptKo.trim()));
    return Boolean(project.renderWithSubId || project.renderCleanId || project.thumbnailAssetIds.length);
  }

  function statusText(status: FlowStatus, completeByDataValue: boolean) {
    if (status === "skipped") return "없이 진행";
    if (status === "done" || completeByDataValue) return "완료";
    return "대기";
  }

  return (
    <section className="min-h-screen w-full bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)] text-white">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1700px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 font-black text-slate-950">▶</div>
            <div>
              <div className="text-lg font-bold tracking-tight">TubeGen AI Studio</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">Single File Builder</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowProjectModal(true)} className={primaryButton}>새 프로젝트</button>
            <button onClick={startWithSample} className={secondaryButton}>샘플 시작</button>
            <button onClick={() => setDrawer("settings")} className={secondaryButton}>설정</button>
            <button onClick={() => setDrawer("assets")} className={secondaryButton}>자산</button>
            <button onClick={() => setDrawer("logs")} className={secondaryButton}>로그</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6 lg:px-8">
        {loadingMessage && (
          <div className="mb-4 rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 p-4 text-cyan-100">
            <div className="text-sm font-semibold">{loadingMessage}</div>
            <div className="mt-1 text-xs text-cyan-200/80">{estimatedTimeText}</div>
          </div>
        )}

        <div className={`${panelClass} mb-4`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">기준 디자인 유지 + 초보자 친화 흐름 업그레이드</div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">첫 화면에서 컨셉을 고르고, 샘플로 시작하고, 한 파일에서 끝내는 AI 영상 스튜디오</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">기존 Next.js 앱의 다크 톤과 제작 흐름을 유지하면서, 초보자용 시작 설정, 컨셉 선택, 샘플 자동 입력, 블로그형 구성 편집, JSON/SRT 내보내기까지 한 컴포넌트에 합쳤습니다.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <TopStatCard title="프로젝트" value={String(projects.length)} caption="로컬 저장" />
              <TopStatCard title="현재 언어" value={settings.language} caption={LANGUAGE_OPTIONS.find((x) => x.code === settings.language)?.label || ""} />
              <TopStatCard title="쉬운 모드" value={settings.easyMode ? "ON" : "OFF"} caption="샘플 기본 제공" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className="space-y-4">
            <div className={panelClass}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">프로젝트 목록</h2>
                  <p className="mt-1 text-xs text-slate-400">왼쪽에서 선택, 가운데서 바로 편집</p>
                </div>
                <button onClick={() => setShowProjectModal(true)} className={secondaryButton}>추가</button>
              </div>
              <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                {projects.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">프로젝트가 없습니다. 샘플 시작 버튼으로 바로 테스트할 수 있습니다.</div>
                )}
                {projects.map((project) => (
                  <button key={project.id} onClick={() => { setActiveProjectId(project.id); setActiveStudioTab(project.editorPhase === "compose" ? "compose" : "setup"); }} className={`w-full rounded-2xl border p-4 text-left transition ${activeProjectId === project.id ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{project.title}</div>
                        <div className="mt-1 text-xs text-slate-400">{CONCEPT_LABELS[project.concept]} · {MODE_LABELS[project.mode]} · {project.aspectRatio}</div>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300">{FLOW_STAGES.filter((stage) => completeByData(project, stage.id)).length}/{FLOW_STAGES.length}</span>
                    </div>
                    <div className="line-clamp-2 text-sm text-slate-300">{project.topic}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className={panelClass}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">구성 블록 / 씬</h2>
                <button onClick={addManualCutToProject} disabled={!activeProject} className={secondaryButton}>컷 추가</button>
              </div>
              {!activeProject ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">프로젝트를 선택해주세요.</div>
              ) : activeBlocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">대본을 구성으로 넘기면 블록이 생성됩니다.</div>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                  {activeBlocks.map((block, index) => {
                    const linkedScene = activeProject.scenes.find((scene) => scene.id === block.sceneId) || activeProject.scenes[index];
                    const img = assets.find((a) => a.id === (block.mediaAssetId || linkedScene?.imageAssetId || linkedScene?.videoAssetId));
                    return (
                      <button key={block.id} onClick={() => { setActiveStudioTab("compose"); if (linkedScene?.id) setSelectedSceneId(linkedScene.id); }} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-800 text-[11px] text-slate-400">
                          {img?.src ? (img.kind === "video" || img.kind === "render" ? <video src={img.src} className="h-full w-full object-cover" /> : <img src={img.src} alt={block.title} className="h-full w-full object-cover" />) : `블록 ${index + 1}`}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{block.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-slate-400">{block.body}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <main className="space-y-4">
            {!activeProject ? (
              <div className={`${panelClass} flex min-h-[720px] items-center justify-center`}>
                <div className="max-w-xl text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-3xl">🎬</div>
                  <h2 className="text-2xl font-semibold">컨셉부터 고르고 바로 시작하세요</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">뮤직비디오, 정보 공유, 이야기, 시네마틱 중 하나를 고르면 주제, 비율, 대본 방향, 샘플 값이 자동으로 채워집니다.</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button onClick={() => setShowProjectModal(true)} className={primaryButton}>새 프로젝트</button>
                    <button onClick={startWithSample} className={secondaryButton}>샘플 시작</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={panelClass}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{CONCEPT_LABELS[activeProject.concept]}</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{MODE_LABELS[activeProject.mode]}</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{activeProject.aspectRatio}</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">최대 {activeProject.minutes}분</span>
                      </div>
                      <h2 className="truncate text-2xl font-semibold tracking-tight">{activeProject.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{activeProject.topic}</p>
                      <p className="mt-2 text-xs text-slate-500">{CONCEPT_DESCRIPTIONS[activeProject.concept]}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setShowProjectModal(true)} className={secondaryButton}>새 프로젝트</button>
                      <button onClick={() => duplicateProject(activeProject)} className={secondaryButton}>복제</button>
                      <button onClick={() => deleteProject(activeProject.id)} className={warningButton}>삭제</button>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {STUDIO_TABS.map((tab) => (
                      <button key={tab.id} onClick={() => setActiveStudioTab(tab.id)} className={`rounded-full px-4 py-2 text-sm transition ${activeStudioTab === tab.id ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"}`}>{tab.label}</button>
                    ))}
                  </div>
                </div>

                {activeStudioTab === "setup" && (
                  <StageSurface title="시작 설정" status={statusText(activeProject.stageStatus.script, completeByData(activeProject, "script"))}>
                    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                      <div className="space-y-4">
                        <Field label="컨셉별 자동 프롬프트">
                          <textarea value={activeProject.prompts.topic} onChange={(e) => updateActiveProject({ prompts: { ...activeProject.prompts, topic: e.target.value } })} className={`${inputClass} min-h-[180px]`} />
                        </Field>
                        <Field label="샘플 주제 추천">
                          <div className="grid gap-2">
                            {SAMPLE_TOPICS_BY_CONCEPT[activeProject.concept].map((sample) => (
                              <button key={sample} onClick={() => updateActiveProject({ topic: sample, prompts: buildPrompts(activeProject.concept, sample, activeProject.selectedLanguage, activeProject.minutes) })} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm hover:bg-white/10">{sample}</button>
                            ))}
                          </div>
                        </Field>
                      </div>
                      <div className="space-y-4">
                        <MiniGuideCard title="1. 컨셉 선택" desc="첫 화면에서 제작 방향을 먼저 고르게 해서 프롬프트를 자동 강화합니다." />
                        <MiniGuideCard title="2. 샘플 기본값" desc="주제와 대본 샘플을 바로 넣어서 초보자도 빈 화면 없이 시작할 수 있습니다." />
                        <MiniGuideCard title="3. 한 컴포넌트" desc="프로젝트 관리, 구성 편집, 결과 내보내기까지 한 파일 안에서 동작합니다." />
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                          지금 프로젝트는 <strong>{CONCEPT_LABELS[activeProject.concept]}</strong> 컨셉에 맞춰 기본 모드가 <strong>{MODE_LABELS[activeProject.mode]}</strong> 로 맞춰져 있습니다.
                        </div>
                      </div>
                    </div>
                  </StageSurface>
                )}

                {activeStudioTab === "script" && (
                  <StageSurface title="대본 쓰기" status={statusText(activeProject.stageStatus.script, completeByData(activeProject, "script"))}>
                    <div className="mb-4 flex flex-wrap gap-3">
                      <button onClick={() => applySampleScript(activeProject)} className={primaryButton}>샘플 대본 넣기</button>
                      <button onClick={() => startComposeFromDraft(activeProject)} className={secondaryButton}>구성으로 넘기기</button>
                      <button onClick={() => updateActiveProject({ scriptDraft: addHookToText(activeProject.scriptDraft || activeProject.topic) })} className={secondaryButton}>도입 강하게</button>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">메인 에디터</h3><button onClick={() => startComposeFromDraft(activeProject)} className={secondaryButton}>바로 구성하기</button></div>
                        <textarea value={activeProject.scriptDraft} onChange={(e) => updateActiveProject({ scriptDraft: e.target.value })} className={`${inputClass} min-h-[420px]`} placeholder="주제만 짧게 적어도 됩니다. 샘플 대본 넣기로 먼저 시작해도 좋습니다." />
                      </div>
                      <div className="space-y-4">
                        <Field label="3줄 요약"><textarea value={activeProject.summary} onChange={(e) => updateActiveProject({ summary: e.target.value })} className={`${inputClass} min-h-[120px]`} /></Field>
                        <Field label="아웃라인"><textarea value={activeProject.outline} onChange={(e) => updateActiveProject({ outline: e.target.value })} className={`${inputClass} min-h-[160px]`} /></Field>
                        <Field label="대본 프롬프트"><textarea value={activeProject.prompts.script} onChange={(e) => updateActiveProject({ prompts: { ...activeProject.prompts, script: e.target.value } })} className={`${inputClass} min-h-[140px]`} /></Field>
                      </div>
                    </div>
                  </StageSurface>
                )}

                {activeStudioTab === "compose" && (
                  <StageSurface title="구성 보기" status={statusText(activeProject.stageStatus.image, completeByData(activeProject, "image"))}>
                    <div className="mb-4 flex flex-wrap gap-3">
                      <button onClick={() => startComposeFromDraft(activeProject)} className={secondaryButton}>블록 다시 나누기</button>
                      <button onClick={() => applySampleImageStage(activeProject)} className={primaryButton}>샘플 장면 만들기</button>
                    </div>
                    {activeBlocks.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">아직 구성 블록이 없습니다. 대본을 먼저 블록으로 전개해주세요.</div>
                    ) : (
                      <div className="space-y-4">
                        {activeBlocks.map((block, index) => {
                          const linkedScene = activeProject.scenes.find((scene) => scene.id === block.sceneId) || activeProject.scenes[index];
                          const mediaAsset = assets.find((asset) => asset.id === (block.mediaAssetId || linkedScene?.videoAssetId || linkedScene?.imageAssetId));
                          return (
                            <div key={block.id} className="rounded-[28px] border border-white/10 bg-white/5 p-4 sm:p-5">
                              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{block.kind === "hook" ? "도입" : block.kind === "ending" ? "마무리" : "본문"}</span>
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">블록 {index + 1}</span>
                                  </div>
                                  <input value={block.title} onChange={(e) => updateBlogBlock(block.id, { title: e.target.value })} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-semibold text-white outline-none focus:border-cyan-400" />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button onClick={() => moveBlogBlock(block.id, "up")} className={secondaryButton}>위로</button>
                                  <button onClick={() => moveBlogBlock(block.id, "down")} className={secondaryButton}>아래로</button>
                                  <button onClick={() => addBlogBlockAfter(block.id)} className={secondaryButton}>아래 추가</button>
                                  <button onClick={() => removeBlogBlock(block.id)} className={warningButton}>삭제</button>
                                </div>
                              </div>
                              <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                                <div className="space-y-3">
                                  <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                                    <div className="mb-2 text-sm font-medium text-slate-200">왼쪽 글</div>
                                    <textarea value={block.body} onChange={(e) => updateBlogBlock(block.id, { body: e.target.value })} className={`${inputClass} min-h-[220px]`} />
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {block.quickActions.map((action) => <button key={action} onClick={() => applyBlogQuickAction(block.id, action)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">{action}</button>)}
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <div className="text-sm font-medium text-slate-200">오른쪽 이미지 / 영상</div>
                                      <div className="flex flex-wrap gap-2">
                                        <button onClick={() => linkedScene?.id && generateImageForScene(linkedScene.id)} disabled={!linkedScene?.id} className={secondaryButton}>이미지 생성</button>
                                        <button onClick={() => linkedScene?.id && generateVideoForScene(linkedScene.id)} disabled={!linkedScene?.id} className={secondaryButton}>영상 생성</button>
                                      </div>
                                    </div>
                                    {mediaAsset?.src ? (mediaAsset.kind === "video" || mediaAsset.kind === "render" ? <video controls className="h-[240px] w-full rounded-2xl object-cover" src={mediaAsset.src} /> : <img src={mediaAsset.src} alt={mediaAsset.name} className="h-[240px] w-full rounded-2xl object-cover" />) : <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">아직 연결된 미디어가 없습니다.</div>}
                                    <div className="mt-3 space-y-3">
                                      <textarea value={block.sideNote} onChange={(e) => updateBlogBlock(block.id, { sideNote: e.target.value })} className={`${inputClass} min-h-[100px]`} placeholder="이미지나 영상 힌트를 적어두세요" />
                                      {linkedScene ? (
                                        <div className="grid gap-3 md:grid-cols-2">
                                          <textarea value={linkedScene.imagePromptKo} onChange={(e) => rebuildProjectForBlogFlow(activeProject.id, { scenes: activeProject.scenes.map((scene) => scene.id === linkedScene.id ? { ...scene, imagePromptKo: e.target.value } : scene) })} className={`${inputClass} min-h-[110px]`} placeholder="한국어 이미지 프롬프트" />
                                          <textarea value={linkedScene.motionPromptKo} onChange={(e) => rebuildProjectForBlogFlow(activeProject.id, { scenes: activeProject.scenes.map((scene) => scene.id === linkedScene.id ? { ...scene, motionPromptKo: e.target.value } : scene) })} className={`${inputClass} min-h-[110px]`} placeholder="행동 프롬프트" />
                                        </div>
                                      ) : (
                                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">이 블록과 연결된 씬이 아직 없습니다.</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </StageSurface>
                )}

                {activeStudioTab === "audio" && (
                  <StageSurface title="오디오" status={statusText(activeProject.stageStatus.audio, completeByData(activeProject, "audio"))}>
                    <div className="mb-4 flex flex-wrap gap-3">
                      <button onClick={() => applySampleAudioStage(activeProject)} className={primaryButton}>샘플 오디오 넣기</button>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
                      <Field label="오디오 프롬프트"><textarea value={activeProject.prompts.audio} onChange={(e) => updateActiveProject({ prompts: { ...activeProject.prompts, audio: e.target.value } })} className={`${inputClass} min-h-[240px]`} /></Field>
                      <Block title="오디오 클립 편집">
                        <div className="max-h-[430px] space-y-3 overflow-auto pr-1">
                          {activeProject.audioClips.length === 0 && <div className="text-sm text-slate-400">아직 오디오 클립이 없습니다.</div>}
                          {activeProject.audioClips.map((clip) => (
                            <div key={clip.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="mb-2 flex items-center justify-between gap-3"><div className="text-sm font-medium">{clip.title}</div><div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300">{clip.kind}</div></div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="space-y-1"><span className="text-xs text-slate-400">시작 트림</span><input type="number" value={clip.startTrim} onChange={(e) => updateActiveProject({ audioClips: activeProject.audioClips.map((item) => item.id === clip.id ? { ...item, startTrim: clamp(Number(e.target.value || 0), 0, item.endTrim) } : item) })} className={inputClass} /></label>
                                <label className="space-y-1"><span className="text-xs text-slate-400">끝 트림</span><input type="number" value={clip.endTrim} onChange={(e) => updateActiveProject({ audioClips: activeProject.audioClips.map((item) => item.id === clip.id ? { ...item, endTrim: clamp(Number(e.target.value || item.duration), item.startTrim, item.duration) } : item) })} className={inputClass} /></label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Block>
                    </div>
                  </StageSurface>
                )}

                {activeStudioTab === "video" && (
                  <StageSurface title="영상" status={statusText(activeProject.stageStatus.video, completeByData(activeProject, "video"))}>
                    <div className="mb-4 flex flex-wrap gap-3"><button onClick={() => applySampleVideoStage(activeProject)} className={primaryButton}>샘플 영상 프롬프트 넣기</button><button onClick={addManualCutToProject} className={secondaryButton}>컷 추가</button></div>
                    <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
                      <Field label="영상 프롬프트"><textarea value={activeProject.prompts.motions} onChange={(e) => updateActiveProject({ prompts: { ...activeProject.prompts, motions: e.target.value } })} className={`${inputClass} min-h-[240px]`} /></Field>
                      <Block title="컷별 움직임 편집">
                        <div className="max-h-[430px] space-y-3 overflow-auto pr-1">
                          {activeProject.scenes.length === 0 && <div className="text-sm text-slate-400">아직 컷이 없습니다.</div>}
                          {activeProject.scenes.map((scene) => {
                            const video = assets.find((a) => a.id === scene.videoAssetId);
                            return (
                              <div key={scene.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <div className="mb-2 flex items-center justify-between gap-3"><div className="font-medium">{scene.title}</div><button onClick={() => generateVideoForScene(scene.id)} className={secondaryButton}>영상 생성</button></div>
                                <textarea value={scene.motionPromptKo} onChange={(e) => rebuildProjectForBlogFlow(activeProject.id, { scenes: activeProject.scenes.map((item) => item.id === scene.id ? { ...item, motionPromptKo: e.target.value } : item) })} className={`${inputClass} min-h-[100px]`} />
                                {video?.src ? <video controls className="mt-3 h-40 w-full rounded-xl object-cover" src={video.src} /> : null}
                              </div>
                            );
                          })}
                        </div>
                      </Block>
                    </div>
                  </StageSurface>
                )}

                {activeStudioTab === "final" && (
                  <StageSurface title="결과" status={statusText(activeProject.stageStatus.final, completeByData(activeProject, "final"))}>
                    <div className="mb-4 flex flex-wrap gap-3">
                      <button onClick={() => applySampleFinalStage(activeProject)} className={primaryButton}>샘플 결과물 만들기</button>
                      <button onClick={exportSrtForProject} className={secondaryButton}>SRT 다운로드</button>
                      <button onClick={exportProjectJson} className={secondaryButton}>JSON 다운로드</button>
                      <button onClick={exportCurrentComponentFile} className={secondaryButton}>컴포넌트 안내 파일</button>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
                      <div className="space-y-4">
                        <Field label="썸네일 프롬프트"><textarea value={activeProject.prompts.thumbnail} onChange={(e) => updateActiveProject({ prompts: { ...activeProject.prompts, thumbnail: e.target.value } })} className={`${inputClass} min-h-[140px]`} /></Field>
                        <Field label="유튜브 제목"><input value={activeProject.youtubeTitle} onChange={(e) => updateActiveProject({ youtubeTitle: e.target.value })} className={inputClass} /></Field>
                        <Field label="유튜브 설명"><textarea value={activeProject.youtubeDescription} onChange={(e) => updateActiveProject({ youtubeDescription: e.target.value })} className={`${inputClass} min-h-[150px]`} /></Field>
                        <Field label="유튜브 태그"><input value={activeProject.youtubeTags.join(", ")} onChange={(e) => updateActiveProject({ youtubeTags: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} className={inputClass} /></Field>
                      </div>
                      <div className="space-y-4">
                        <Block title="최종 미리보기">
                          <div className="mb-3 flex flex-wrap gap-2">
                            <button onClick={() => setFinalPreviewMode("subtitle")} className={`rounded-full px-3 py-2 text-sm ${finalPreviewMode === "subtitle" ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/5 text-slate-200"}`}>자막 포함</button>
                            <button onClick={() => setFinalPreviewMode("clean")} className={`rounded-full px-3 py-2 text-sm ${finalPreviewMode === "clean" ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/5 text-slate-200"}`}>깨끗한 버전</button>
                          </div>
                          {finalPreviewAsset?.src ? (finalPreviewAsset.kind === "render" || finalPreviewAsset.kind === "video" ? <video controls className="h-[260px] w-full rounded-2xl object-contain" src={finalPreviewAsset.src} /> : <img src={finalPreviewAsset.src} alt={finalPreviewAsset.name} className="h-[260px] w-full rounded-2xl object-contain" />) : <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">샘플 결과물을 만들면 여기에 보입니다.</div>}
                        </Block>
                        <Block title="썸네일 미리보기">
                          {thumbnailAsset?.src ? <img src={thumbnailAsset.src} alt={thumbnailAsset.name} className="h-[220px] w-full rounded-2xl object-cover" /> : <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">썸네일 자산이 없습니다.</div>}
                          {thumbnailAsset?.note ? <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">{thumbnailAsset.note}</div> : null}
                        </Block>
                      </div>
                    </div>
                  </StageSurface>
                )}
              </>
            )}
          </main>

          <aside className="space-y-4">
            <div className={panelClass}>
              <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">한눈에 보기</h2><button onClick={() => setDrawer("projects")} className={secondaryButton}>프로젝트 관리</button></div>
              {!activeProject ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">프로젝트를 선택하면 상태가 여기에 표시됩니다.</div>
              ) : (
                <div className="space-y-4">
                  <InfoCard title="현재 프로젝트">
                    <InfoRow label="이름" value={activeProject.title} />
                    <InfoRow label="컨셉" value={CONCEPT_LABELS[activeProject.concept]} />
                    <InfoRow label="모드" value={MODE_LABELS[activeProject.mode]} />
                    <InfoRow label="비율" value={activeProject.aspectRatio} />
                    <InfoRow label="길이" value={`${activeProject.minutes}분`} />
                    <InfoRow label="언어" value={activeProject.selectedLanguage} />
                  </InfoCard>
                  <InfoCard title="현재 자원">
                    <InfoRow label="블록 수" value={`${activeProject.blogBlocks.length}개`} />
                    <InfoRow label="씬 수" value={`${activeProject.scenes.length}개`} />
                    <InfoRow label="오디오" value={`${activeProject.audioClips.length}개`} />
                    <InfoRow label="자산" value={`${assets.length}개`} />
                  </InfoCard>
                  <InfoCard title="진행 상태">
                    <div className="space-y-2">
                      {FLOW_STAGES.map((stage) => (
                        <button key={stage.id} onClick={() => setActiveStudioTab(stage.id === "script" ? "script" : stage.id === "image" ? "compose" : stage.id)} className="flex w-full items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left">
                          <span className="text-sm text-slate-300">{stage.label}</span>
                          <span className="text-sm font-medium text-white">{statusText(activeProject.stageStatus[stage.id], completeByData(activeProject, stage.id))}</span>
                        </button>
                      ))}
                    </div>
                  </InfoCard>
                  {selectedScene && (
                    <InfoCard title="선택된 씬">
                      <div className="text-sm font-medium text-white">{selectedScene.title}</div>
                      <div className="mt-2 text-sm text-slate-300">{selectedScene.imagePromptKo || "프롬프트 없음"}</div>
                    </InfoCard>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {drawer !== "none" && (
        <BannerShell title={drawer === "settings" ? "설정" : drawer === "assets" ? "자산" : drawer === "logs" ? "작업 로그" : "프로젝트 관리"} onClose={() => setDrawer("none")}>
          {drawer === "settings" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="기본 언어">
                <select value={settings.language} onChange={(e) => setSettings((current) => ({ ...current, language: e.target.value }))} className={inputClass}>{LANGUAGE_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.label}</option>)}</select>
              </Field>
              <Field label="기본 길이"><select value={String(settings.preferredMinutes)} onChange={(e) => setSettings((current) => ({ ...current, preferredMinutes: clamp(Number(e.target.value || 3), 1, 15) }))} className={inputClass}>{Array.from({ length: 15 }, (_, i) => i + 1).map((minute) => <option key={minute} value={minute}>{minute}분</option>)}</select></Field>
              <div className="md:col-span-2"><Toggle label="쉬운 모드 유지" checked={settings.easyMode} onChange={(checked) => setSettings((current) => ({ ...current, easyMode: checked }))} /></div>
            </div>
          )}

          {drawer === "assets" && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <Field label="직접 자산 추가">
                  <div className="grid gap-3 md:grid-cols-3">
                    <input value={manualAssetName} onChange={(e) => setManualAssetName(e.target.value)} className={inputClass} placeholder="자산 이름" />
                    <select value={manualAssetKind} onChange={(e) => setManualAssetKind(e.target.value as AssetKind)} className={inputClass}><option value="image">image</option><option value="video">video</option><option value="audio">audio</option><option value="thumbnail">thumbnail</option></select>
                    <input value={manualAssetUrl} onChange={(e) => setManualAssetUrl(e.target.value)} className={inputClass} placeholder="URL 또는 data URI" />
                  </div>
                </Field>
                <div className="flex gap-2"><button onClick={addAssetManually} className={primaryButton}>추가</button><button onClick={() => fileInputRef.current?.click()} className={secondaryButton}>파일 업로드</button></div>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={uploadFiles} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {assets.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">저장된 자산이 없습니다.</div>}
                {assets.map((asset) => (
                  <div key={asset.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3"><div><div className="text-xs text-slate-400">{asset.kind}</div><div className="break-all text-sm font-medium">{asset.name}</div></div><button onClick={() => removeAsset(asset.id)} className={warningButton}>삭제</button></div>
                    {(asset.kind === "image" || asset.kind === "thumbnail") && asset.src ? <img src={asset.src} alt={asset.name} className="h-40 w-full rounded-2xl object-cover" /> : asset.kind === "audio" && asset.src ? <audio controls className="w-full" src={asset.src} /> : (asset.kind === "video" || asset.kind === "render") && asset.src ? <video controls className="h-40 w-full rounded-2xl object-cover" src={asset.src} /> : <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-300">{asset.note || asset.src || "미리보기 없음"}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {drawer === "logs" && (
            <div className="space-y-3">{globalLogs.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">아직 로그가 없습니다.</div> : globalLogs.map((log) => <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">{log.text}</div>)}</div>
          )}

          {drawer === "projects" && (
            <div className="space-y-3">{projects.map((project) => <div key={project.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><div><div className="font-medium">{project.title}</div><div className="text-xs text-slate-400">{CONCEPT_LABELS[project.concept]} · {project.topic}</div></div><div className="flex gap-2"><button onClick={() => { setActiveProjectId(project.id); setDrawer("none"); }} className={secondaryButton}>열기</button><button onClick={() => duplicateProject(project)} className={secondaryButton}>복제</button><button onClick={() => deleteProject(project.id)} className={warningButton}>삭제</button></div></div>)}</div>
          )}
        </BannerShell>
      )}

      {showProjectModal && (
        <ModalShell title="프로젝트 만들기" onClose={() => setShowProjectModal(false)}>
          <div className="space-y-5">
            <div>
              <div className="mb-3 text-sm font-medium text-slate-200">1. 어떤 컨셉으로 만들까요?</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(CONCEPT_LABELS) as ContentConcept[]).map((concept) => (
                  <button key={concept} onClick={() => switchConcept(concept)} className={`rounded-3xl border p-4 text-left transition ${projectForm.concept === concept ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                    <div className="text-base font-semibold">{CONCEPT_LABELS[concept]}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">{CONCEPT_DESCRIPTIONS[concept]}</div>
                    <div className="mt-3 text-xs text-cyan-200/80">추천 비율 {getConceptPreset(concept).ratio}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="프로젝트 이름"><input value={projectForm.title} onChange={(e) => setProjectForm((current) => ({ ...current, title: e.target.value }))} className={inputClass} /></Field>
              <Field label="주제"><input value={projectForm.topic} onChange={(e) => setProjectForm((current) => ({ ...current, topic: e.target.value }))} className={inputClass} /></Field>
              <Field label="모드"><select value={projectForm.videoMode} onChange={(e) => setProjectForm((current) => ({ ...current, videoMode: e.target.value as VideoMode }))} className={inputClass}>{Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="비율"><select value={projectForm.ratio} onChange={(e) => setProjectForm((current) => ({ ...current, ratio: e.target.value as AspectRatio }))} className={inputClass}><option value="16:9">16:9</option><option value="1:1">1:1</option><option value="9:16">9:16</option></select></Field>
              <Field label="길이"><select value={String(projectForm.minutes)} onChange={(e) => setProjectForm((current) => ({ ...current, minutes: clamp(Number(e.target.value || 3), 1, 15) }))} className={inputClass}>{Array.from({ length: 15 }, (_, i) => i + 1).map((minute) => <option key={minute} value={minute}>{minute}분</option>)}</select></Field>
              <Field label="목소리"><select value={projectForm.voiceId} onChange={(e) => setProjectForm((current) => ({ ...current, voiceId: e.target.value }))} className={inputClass}>{VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select></Field>
              <Field label="언어"><select value={projectForm.language} onChange={(e) => setProjectForm((current) => ({ ...current, language: e.target.value }))} className={inputClass}>{LANGUAGE_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.label}</option>)}</select></Field>
              <div className="md:pt-8"><Toggle label="자막 기본 포함" checked={projectForm.includeSubtitles} onChange={(checked) => setProjectForm((current) => ({ ...current, includeSubtitles: checked }))} /></div>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">선택한 컨셉에 맞춰 시작 프롬프트가 자동 강화됩니다. 샘플 값으로 시작한 뒤, 제목과 주제만 바꿔도 바로 작업 가능합니다.</div>
            <div className="flex justify-end gap-3"><button onClick={() => setShowProjectModal(false)} className={secondaryButton}>취소</button><button onClick={createProject} className={primaryButton}>프로젝트 생성</button></div>
          </div>
        </ModalShell>
      )}
    </section>
  );
}

function TopStatCard({ title, value, caption }: { title: string; value: string; caption?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="mt-2 truncate text-lg font-semibold text-white">{value}</div>
      {caption ? <div className="mt-1 text-xs text-slate-500">{caption}</div> : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><div className="text-sm text-slate-400">{label}</div><div className="max-w-[70%] break-words text-right text-sm font-medium text-white">{value}</div></div>;
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{label}</span>{children}</label>;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-3xl border border-white/10 bg-white/5 p-4"><div className="mb-3 text-sm font-medium text-slate-200">{title}</div>{children}</div>;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="mb-2 text-sm font-medium text-white">{title}</div><div className="space-y-2 text-sm leading-6 text-slate-300">{children}</div></div>;
}

function StageSurface({ title, status, children }: { title: string; status: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{status}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-white">{title}</h2><button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">닫기</button></div>
        {children}
      </div>
    </div>
  );
}

function BannerShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 p-4 sm:p-6" onClick={onClose}>
      <div className="mx-auto max-w-6xl" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><h2 className="text-lg font-semibold text-white">{title}</h2><button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">닫기</button></div>
          <div className="max-h-[78vh] overflow-auto p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function MiniGuideCard({ title, desc }: { title: string; desc: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-sm font-medium text-white">{title}</div><div className="mt-1 text-sm leading-6 text-slate-300">{desc}</div></div>;
}
