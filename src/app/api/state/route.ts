import { NextResponse } from 'next/server';
import fs from 'fs';
import { loadState, STATE_PATH } from '../common/utils';


export async function GET() {
  try {
    const state = loadState();
    if (!state) return NextResponse.json({ error: 'state_not_found' }, { status: 404 });
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: 'failed_to_read_state', details: e?.message ?? String(e) }, { status: 500 });
  }
}

export const runtime = 'nodejs';


