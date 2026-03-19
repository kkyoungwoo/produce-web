import {
  ContentType,
  StorySelectionState,
  WorkflowPromptTemplate,
} from '../types';
import { translatePromptToEnglish } from './promptTranslationService';
import { buildSelectableStoryDraft, normalizeStoryText } from '../utils/storyHelpers';
import { runTextAi } from './textAiService';
import { getPromptRegistry } from './promptRegistryService';

interface ScriptComposerOptions {
  contentType: ContentType;
  topic: string;
  selections: StorySelectionState;
  template: WorkflowPromptTemplate;
  currentScript?: string;
  promptAdditions?: string[];
  model?: string;
  conversationMode?: boolean;
}

export interface ScriptComposerResult {
  text: string;
  source: 'ai' | 'sample';
}

function createDialogueFallback(topic: string, selections: StorySelectionState) {
  return normalizeStoryText(`Scene 1
${selections.protagonist}: ${topic || 'This story'} starts tonight.
Partner: Why now?
${selections.protagonist}: Because ${selections.conflict} cannot wait anymore.

Scene 2
Partner: Then what kind of mood are we chasing?
${selections.protagonist}: ${selections.mood}. The setting is ${selections.setting}.
Partner: And the ending?
${selections.protagonist}: ${selections.endingTone}.`);
}

function createFallback(options: ScriptComposerOptions) {
  if (options.conversationMode || options.template.mode === 'dialogue') {
    return createDialogueFallback(options.topic, options.selections);
  }

  return normalizeStoryText(
    options.currentScript?.trim() ||
      buildSelectableStoryDraft({
        contentType: options.contentType,
        topic: options.topic,
        ...options.selections,
      })
  );
}

export async function composeScriptDraft(options: ScriptComposerOptions): Promise<ScriptComposerResult> {
  const fallback = createFallback(options);
  const bundle = getPromptRegistry(options.contentType);
  const requestPayload = await translatePromptToEnglish(
    `Content type: ${options.contentType}
Topic: ${options.topic || 'Auto-generated'}
Genre: ${options.selections.genre}
Mood: ${options.selections.mood}
Setting: ${options.selections.setting}
Lead: ${options.selections.protagonist}
Conflict: ${options.selections.conflict}
Ending tone: ${options.selections.endingTone}

Prompt template: ${options.template.name}
Prompt description: ${options.template.description}

[SELECTED PROMPT]
${options.template.prompt}

[CURRENT DRAFT]
${options.currentScript || 'None'}

[TRANSLATION RULE]
${bundle.translateRule}`,
    { label: 'script composer request', preserveLineBreaks: true, maxChars: 12000 }
  );

  const additionBlock = (options.promptAdditions || []).filter((item) => item.trim()).slice(0, 8);
  const mergedPayload = additionBlock.length
    ? `${requestPayload}

[ADDITIONAL GUIDANCE PHRASES]
${additionBlock.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
    : requestPayload;

  const result = await runTextAi({
    system: bundle.system,
    user: mergedPayload,
    model: options.model || 'openrouter/auto',
    temperature: options.conversationMode || options.template.mode === 'dialogue' ? 0.85 : 0.7,
    fallback,
  });

  return {
    text: normalizeStoryText(result.text || fallback),
    source: result.source,
  };
}
