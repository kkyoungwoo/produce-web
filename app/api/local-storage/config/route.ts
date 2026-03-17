import { NextRequest, NextResponse } from 'next/server';
import { createDefaultState, writeState } from '../_shared';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const state = createDefaultState(body?.storageDir);
  const saved = await writeState(state);
  return NextResponse.json(saved);
}
