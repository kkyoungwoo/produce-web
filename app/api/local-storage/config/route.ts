import { NextRequest, NextResponse } from 'next/server';
import { createDefaultState, serializeStateForClient, writeState } from '../_shared';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const state = createDefaultState(body?.storageDir, { configured: Boolean(body?.storageDir?.trim()) });
  const saved = await writeState(state);
  return NextResponse.json(serializeStateForClient(saved));
}
