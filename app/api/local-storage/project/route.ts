import { NextRequest, NextResponse } from 'next/server';
import { createDefaultState, deleteProjectDetails, normalizeProjectSummary, readProjectDetail, readStoredState, writeProjectDetail, writeState } from '../_shared';

export async function GET(request: NextRequest) {
  const storageDir = request.nextUrl.searchParams.get('storageDir') || undefined;
  const projectId = request.nextUrl.searchParams.get('projectId') || '';

  if (!projectId.trim()) {
    return NextResponse.json({ message: 'projectId is required.' }, { status: 400 });
  }

  try {
    const state = await readStoredState(storageDir);
    const project = await readProjectDetail(state.storageDir, projectId);
    if (!project) {
      return NextResponse.json({ message: 'Project not found.' }, { status: 404 });
    }
    return NextResponse.json(project);
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
    await writeProjectDetail(current.storageDir, project);
    const nextIndex = [
      normalizeProjectSummary(project),
      ...(Array.isArray(current.projectIndex) ? current.projectIndex : []).filter((item) => item?.id !== project.id),
    ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const savedState = await writeState({
      ...current,
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
    const deletedCount = await deleteProjectDetails(current.storageDir, projectIds);
    const nextProjectIndex = (current.projectIndex || []).filter((item) => !projectIds.includes(item.id));
    const savedState = await writeState({
      ...current,
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
