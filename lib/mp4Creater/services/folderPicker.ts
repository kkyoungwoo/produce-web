import { DEFAULT_STORAGE_DIR } from './localFileApi';

function applyFolderNameToPath(currentPath: string, folderName: string) {
  const value = currentPath.trim();
  if (!value || value === DEFAULT_STORAGE_DIR) {
    return `./local-data/${folderName}`;
  }
  return value;
}

export async function pickFolderPath(currentPath: string): Promise<{ nextPath: string; selectedLabel: string } | null> {
  if (typeof window === 'undefined') return null;

  try {
    const picker = (window as any).showDirectoryPicker;
    if (typeof picker === 'function') {
      const handle = await picker.call(window);
      const selectedLabel = handle?.name || 'selected-folder';
      return {
        nextPath: applyFolderNameToPath(currentPath, selectedLabel),
        selectedLabel,
      };
    }
  } catch {
    return null;
  }

  return null;
}
