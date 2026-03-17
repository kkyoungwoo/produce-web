import { NextRequest, NextResponse } from 'next/server';
import { createDefaultState, ensureState, writeState } from '../_shared';

export async function GET(request: NextRequest) {
  const storageDir = request.nextUrl.searchParams.get('storageDir') || undefined;
  const state = await ensureState(storageDir);
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const current = await ensureState(body?.storageDir);
  const next = {
    ...createDefaultState(current.storageDir),
    ...current,
    ...body,
  };
  const saved = await writeState(next);
  return NextResponse.json(saved);
}
