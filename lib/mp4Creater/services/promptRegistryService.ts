import { ContentType } from '../types';
import { getPromptBundle } from '../prompts';

export function getPromptRegistry(contentType: ContentType) {
  return getPromptBundle(contentType);
}
