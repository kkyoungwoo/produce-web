
import { ContentType } from '../types';
import { getPromptStudioBundle } from '../prompt-center';

export type PromptBundle = ReturnType<typeof getPromptStudioBundle>;

export function getPromptBundle(contentType: ContentType): PromptBundle {
  return getPromptStudioBundle(contentType);
}
