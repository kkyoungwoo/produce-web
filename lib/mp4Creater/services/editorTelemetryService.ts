export interface EditorTelemetryRecord {
  id: string;
  projectId: string;
  type: string;
  detail?: Record<string, unknown> | null;
  createdAt: number;
}

const STORAGE_KEY = 'mp4creater:editor-telemetry';
const MAX_RECORDS = 300;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readEditorTelemetry(projectId?: string | null): EditorTelemetryRecord[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const records = Array.isArray(parsed) ? parsed : [];
    return projectId ? records.filter((record) => record?.projectId === projectId) : records;
  } catch {
    return [];
  }
}

export function appendEditorTelemetry(projectId: string | null | undefined, type: string, detail?: Record<string, unknown> | null) {
  if (!projectId || !canUseStorage()) return;
  const next: EditorTelemetryRecord = {
    id: `${projectId}:${type}:${Date.now()}`,
    projectId,
    type,
    detail: detail || null,
    createdAt: Date.now(),
  };

  const current = readEditorTelemetry();
  const records = [next, ...current].slice(0, MAX_RECORDS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
