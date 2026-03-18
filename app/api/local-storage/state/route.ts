import { NextRequest, NextResponse } from 'next/server';
import { createDefaultState, ensureState, readStoredState, serializeStateForClient, writeState } from '../_shared';

export async function GET(request: NextRequest) {
  const storageDir = request.nextUrl.searchParams.get('storageDir') || undefined;
  const includeProjects = request.nextUrl.searchParams.get('includeProjects') === '1';
  const state = await ensureState(storageDir);
  return NextResponse.json(serializeStateForClient(state, { includeProjects }));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const current = await readStoredState(body?.storageDir);
  const next = {
    ...createDefaultState(current.storageDir, { configured: current.isStorageConfigured ?? Boolean(current.storageDir) }),
    ...current,
    ...body,
  };
  const saved = await writeState(next, {
    previousState: current,
    persistProjects: Object.prototype.hasOwnProperty.call(body || {}, 'projects'),
  });
  return NextResponse.json(serializeStateForClient(saved));
}
