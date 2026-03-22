import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_STORAGE_DIR, createDefaultState, deleteProjectDetails, normalizeProjectSummary, readProjectDetail, readStoredState, writeProjectDetail, writeState } from '../_shared';

function resolveProjectStorageDir(currentStorageDir?: string, requestedStorageDir?: string) {
  const current = currentStorageDir?.trim();
  if (current) return current;
  const requested = requestedStorageDir?.trim();
  if (requested) return requested;
  return DEFAULT_STORAGE_DIR;
}

export async function GET(request: NextRequest) {
  const storageDir = request.nextUrl.searchParams.get('storageDir') || undefined;
  const projectId = request.nextUrl.searchParams.get('projectId') || '';

  if (!projectId.trim()) {
    return NextResponse.json({ message: 'projectId is required.' }, { status: 400 });
  }

  try {
    const state = await readStoredState(storageDir);
    const resolvedStorageDir = resolveProjectStorageDir(state.storageDir, storageDir);
    const project = await readProjectDetail(resolvedStorageDir, projectId);
    if (project) {
      return NextResponse.json(project);
    }

    const fallbackProject = (Array.isArray(state.projectIndex) ? state.projectIndex : []).find((item) => item?.id === projectId);
    if (fallbackProject) {
      return NextResponse.json(fallbackProject);
    }

    return NextResponse.json({ message: 'Project not found.' }, { status: 404 });
  } catch (error) {
    console.warn('[local-storage/project] GET failed', error);
    return NextResponse.json({ message: 'Failed to load project.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const project = body?.project;

  if (!project?.id) {
    return NextResponse.json({ message: 'project.id is required.' }, { status: 400 });
  }

  let current = createDefaultState(body?.storageDir || '', { configured: Boolean(body?.storageDir) });
  try {
    current = await readStoredState(body?.storageDir);
  } catch (error) {
    console.warn('[local-storage/project] readStoredState failed in POST, using fallback current state', error);
  }

  try {
    const resolvedStorageDir = resolveProjectStorageDir(current.storageDir, body?.storageDir);
    await writeProjectDetail(resolvedStorageDir, project);
    const nextIndex = [
      normalizeProjectSummary(project),
      ...(Array.isArray(current.projectIndex) ? current.projectIndex : []).filter((item) => item?.id !== project.id),
    ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const savedState = await writeState({
      ...current,
      storageDir: resolvedStorageDir,
      isStorageConfigured: true,
      projects: nextIndex,
      projectIndex: nextIndex,
      updatedAt: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      project,
      projectIndex: savedState.projectIndex || [],
    });
  } catch (error) {
    console.warn('[local-storage/project] POST failed', error);
    return NextResponse.json({ message: 'Failed to save project.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const projectIds = Array.isArray(body?.projectIds) ? body.projectIds.filter((item: unknown) => typeof item === 'string' && item.trim()) : [];

  if (!projectIds.length) {
    return NextResponse.json({ message: 'projectIds is required.' }, { status: 400 });
  }

  let current = createDefaultState(body?.storageDir || '', { configured: Boolean(body?.storageDir) });
  try {
    current = await readStoredState(body?.storageDir);
  } catch (error) {
    console.warn('[local-storage/project] readStoredState failed in DELETE, using fallback current state', error);
  }

  try {
    const resolvedStorageDir = resolveProjectStorageDir(current.storageDir, body?.storageDir);
    const deletedCount = await deleteProjectDetails(resolvedStorageDir, projectIds);
    const nextProjectIndex = (current.projectIndex || []).filter((item) => !projectIds.includes(item.id));
    const savedState = await writeState({
      ...current,
      storageDir: resolvedStorageDir,
      isStorageConfigured: true,
      projects: nextProjectIndex,
      projectIndex: nextProjectIndex,
      updatedAt: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      deletedCount,
      projectIndex: savedState.projectIndex || [],
    });
  } catch (error) {
    console.warn('[local-storage/project] DELETE failed', error);
    return NextResponse.json({ message: 'Failed to delete projects.' }, { status: 500 });
  }
}
