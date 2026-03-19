import { ContentType } from '../types';
import { infoDeliveryPrompts } from './infoDeliveryPrompts';
import { musicVideoPrompts } from './musicVideoPrompts';
import { newsPrompts } from './newsPrompts';
import { storyPrompts } from './storyPrompts';

export type PromptBundle = {
  system: string;
  story: string;
  recommendations: string[];
  translateRule: string;
};

export function getPromptBundle(contentType: ContentType): PromptBundle {
  if (contentType === 'music_video') return musicVideoPrompts;
  if (contentType === 'news') return newsPrompts;
  if (contentType === 'info_delivery') return infoDeliveryPrompts;
  return storyPrompts;
}
