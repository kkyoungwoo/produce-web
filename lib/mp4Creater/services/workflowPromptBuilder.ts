import {
  ContentType,
  StorySelectionState,
  WorkflowPromptPack,
  WorkflowPromptTemplate,
} from '../types';
import {
  buildChannelConstitutionPrompt,
  CHANNEL_CONSTITUTION_ENGINE,
  CHANNEL_CONSTITUTION_TEMPLATE_ID,
  supportsChannelConstitutionTemplate,
} from '../prompts/channelConstitutionPrompts';
import { getPromptRegistry } from './promptRegistryService';

function buildBaseSummary(topic: string, selections: StorySelectionState) {
  return [
    `Topic: ${topic || 'Untitled'}`,
    `Genre: ${selections.genre}`,
    `Mood: ${selections.mood}`,
    `Setting: ${selections.setting}`,
    `Lead: ${selections.protagonist}`,
    `Conflict: ${selections.conflict}`,
    `Ending tone: ${selections.endingTone}`,
  ].join('\n');
}

export function buildWorkflowPromptPack(options: {
  contentType: ContentType;
  topic: string;
  selections: StorySelectionState;
  script: string;
}): WorkflowPromptPack {
  const bundle = getPromptRegistry(options.contentType);
  const summary = buildBaseSummary(options.topic, options.selections);
  const currentDraft = options.script?.trim() || 'No draft';

  const storyPrompt = `${bundle.story}\n\n[INPUT]\n${summary}\n\n[CURRENT DRAFT]\n${currentDraft}`;
  const lyricsPrompt = `${bundle.story}\n\n[MUSIC VIDEO FLOW]\n${summary}\n\n[CURRENT DRAFT]\n${currentDraft}`;
  const characterPrompt = `${bundle.story}\n\n[CHARACTERS]\n${summary}\n\n[SCRIPT]\n${currentDraft}`;
  const scenePrompt = `${bundle.story}\n\n[SCENE PROMPTS]\n${summary}\n\n[SCRIPT]\n${currentDraft}`;
  const actionPrompt = `${bundle.story}\n\n[SCENE ACTIONS]\n${summary}`;
  const persuasionStoryPrompt = `${bundle.story}\n\n[RECOMMENDED PHRASES]\n${bundle.recommendations.join('\n')}`;

  return {
    storyPrompt,
    lyricsPrompt,
    characterPrompt,
    scenePrompt,
    actionPrompt,
    persuasionStoryPrompt,
  };
}

export function createBuiltInWorkflowPromptTemplates(
  contentType: ContentType,
  promptPack: WorkflowPromptPack
): WorkflowPromptTemplate[] {
  const isMusic = contentType === 'music_video';
  const templates: WorkflowPromptTemplate[] = [];

  if (supportsChannelConstitutionTemplate(contentType)) {
    const constitutionPrompt = buildChannelConstitutionPrompt({ contentType, promptPack });
    templates.push({
      id: CHANNEL_CONSTITUTION_TEMPLATE_ID,
      name: '채널 헌법 v32 분석형',
      description: '타겟팅, 안전성, 제목 설계까지 함께 정리하는 유튜브 분석형 대본 템플릿',
      prompt: constitutionPrompt,
      mode: 'narration',
      engine: CHANNEL_CONSTITUTION_ENGINE,
      builtIn: true,
      basePrompt: constitutionPrompt,
      isCustomized: false,
      updatedAt: 1,
    });
  }

  templates.push(
    {
      id: 'builtin-core-script',
      name: isMusic ? 'Core music-video draft' : 'Core script draft',
      description: isMusic ? 'Default structure for a music-video flow' : 'Default structure for story/news flow',
      prompt: isMusic ? promptPack.lyricsPrompt : promptPack.storyPrompt,
      mode: 'narration',
      engine: 'default',
      builtIn: true,
      basePrompt: isMusic ? promptPack.lyricsPrompt : promptPack.storyPrompt,
      isCustomized: false,
      updatedAt: 2,
    },
    {
      id: 'builtin-dialogue-script',
      name: 'Dialogue draft',
      description: 'A more conversational variation',
      prompt: `${promptPack.storyPrompt}\n\nExtra rules:\n- Blend dialogue and narration naturally.\n- Prefer visual and concrete sentences.`,
      mode: 'dialogue',
      engine: 'default',
      builtIn: true,
      basePrompt: `${promptPack.storyPrompt}\n\nExtra rules:\n- Blend dialogue and narration naturally.\n- Prefer visual and concrete sentences.`,
      isCustomized: false,
      updatedAt: 3,
    },
    {
      id: 'builtin-scene-heavy',
      name: 'Scene-heavy draft',
      description: 'Stronger scene transitions and visual detail',
      prompt: `${promptPack.scenePrompt}\n\nExtra rules:\n- Start each paragraph with a visible scene shift.\n- Add concrete visual anchors.`,
      mode: 'narration',
      engine: 'default',
      builtIn: true,
      basePrompt: `${promptPack.scenePrompt}\n\nExtra rules:\n- Start each paragraph with a visible scene shift.\n- Add concrete visual anchors.`,
      isCustomized: false,
      updatedAt: 4,
    }
  );

  return templates;
}

export function resolveWorkflowPromptTemplates(
  contentType: ContentType,
  promptPack: WorkflowPromptPack,
  existingTemplates?: WorkflowPromptTemplate[]
): WorkflowPromptTemplate[] {
  const builtIns = createBuiltInWorkflowPromptTemplates(contentType, promptPack);
  const existing = existingTemplates || [];

  const mergedBuiltIns = builtIns.map((builtIn) => {
    const saved = existing.find((item) => item.id === builtIn.id);
    if (!saved) return builtIn;
    if (saved.isCustomized) {
      return {
        ...builtIn,
        name: saved.name,
        description: saved.description,
        prompt: saved.prompt,
        engine: saved.engine || builtIn.engine || 'default',
        updatedAt: saved.updatedAt || builtIn.updatedAt,
        isCustomized: true,
      };
    }
    return {
      ...builtIn,
      name: saved.name || builtIn.name,
      description: saved.description || builtIn.description,
      engine: saved.engine || builtIn.engine || 'default',
      updatedAt: saved.updatedAt || builtIn.updatedAt,
    };
  });

  const customTemplates = existing.filter((item) => !item.builtIn);
  return [...mergedBuiltIns, ...customTemplates];
}

export function getSelectedWorkflowPromptTemplate(
  templates: WorkflowPromptTemplate[],
  selectedPromptTemplateId?: string | null
): WorkflowPromptTemplate {
  return templates.find((item) => item.id === selectedPromptTemplateId) || templates[0];
}
