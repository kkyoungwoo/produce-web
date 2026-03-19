import { NextRequest, NextResponse } from 'next/server';
import { createDefaultState, ensureState, readStoredState, serializeStateForClient, writeState } from '../_shared';

export async function GET(request: NextRequest) {
  const storageDir = request.nextUrl.searchParams.get('storageDir') || undefined;
  const includeProjects = request.nextUrl.searchParams.get('includeProjects') === '1';
  try {
    const state = includeProjects
      ? await ensureState(storageDir)
      : await readStoredState(storageDir);
    return NextResponse.json(serializeStateForClient(state, { includeProjects }));
  } catch (error) {
    console.warn('[local-storage/state] GET failed, returning fallback state', error);
    const fallback = createDefaultState(storageDir || '', { configured: Boolean(storageDir) });
    return NextResponse.json(serializeStateForClient(fallback, { includeProjects: false }));
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  let current = createDefaultState(body?.storageDir || '', { configured: Boolean(body?.storageDir) });
  try {
    current = await readStoredState(body?.storageDir);
  } catch (error) {
    console.warn('[local-storage/state] readStoredState failed in POST, using fallback current state', error);
  }
  const next = {
    ...createDefaultState(current.storageDir, { configured: current.isStorageConfigured ?? Boolean(current.storageDir) }),
    ...current,
    ...body,
  };
  try {
    const saved = await writeState(next, {
      previousState: current,
      persistProjects: Object.prototype.hasOwnProperty.call(body || {}, 'projects'),
    });
    return NextResponse.json(serializeStateForClient(saved));
  } catch (error) {
    console.warn('[local-storage/state] writeState failed, returning in-memory fallback response', error);
    return NextResponse.json(serializeStateForClient(next));
  }
}
