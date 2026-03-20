import { WorkflowPromptTemplate } from '../../types';

export function arePromptTemplatesEqual(a: WorkflowPromptTemplate[], b: WorkflowPromptTemplate[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return Boolean(other)
      && item.id === other.id
      && item.name === other.name
      && item.description === other.description
      && item.prompt === other.prompt
      && item.mode === other.mode
      && item.builtIn === other.builtIn
      && item.basePrompt === other.basePrompt
      && item.engine === other.engine
      && item.isCustomized === other.isCustomized;
  });
}
