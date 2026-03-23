import { ContentType } from '../../types';
import { buildMusicVideoPrompt } from './musicVideo';
import { buildStoryPrompt } from './story';
import { buildNewsPrompt } from './news';
import { buildInfoDeliveryPrompt } from './infoDelivery';

export function buildScriptPromptByContentType(
  contentType: ContentType,
  topic: string,
  sourceText: string
): string {
  if (contentType === 'music_video') return buildMusicVideoPrompt(topic, sourceText);
  if (contentType === 'cinematic') return buildNewsPrompt(topic, sourceText);
  if (contentType === 'info_delivery') return buildInfoDeliveryPrompt(topic, sourceText);
  return buildStoryPrompt(topic, sourceText);
}
