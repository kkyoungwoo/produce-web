import { ContentType } from '../../types';
import { buildMusicVideoPrompt } from './musicVideo';
import { buildStoryPrompt } from './story';
import { buildNewsPrompt } from './news';

export function buildScriptPromptByContentType(
  contentType: ContentType,
  topic: string,
  sourceText: string
): string {
  if (contentType === 'music_video') return buildMusicVideoPrompt(topic, sourceText);
  if (contentType === 'news') return buildNewsPrompt(topic, sourceText);
  return buildStoryPrompt(topic, sourceText);
}
