import { NextResponse } from 'next/server';
import xrpl from 'xrpl';
import fs from 'fs';
import path from 'path';

const STATE_PATH = path.join(process.cwd(), 'data', 'xrpl-poc.json');

function loadState() {
  const raw = fs.readFileSync(STATE_PATH, 'utf-8');
  return JSON.parse(raw) as {
    admin: { address: string };
    currencies: Array<string | { code: string; link: string }>;
  };
}

export async function POST(req: Request) {
  try {
    const { sell, buy, limit = 20 } = await req.json();
    const state = loadState();
    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
    await client.connect();
    try {
      const book = await client.request({
        command: 'book_offers',
        limit,
        taker_gets: sell === 'XRP' ? { currency: 'XRP' } : { currency: sell, issuer: state.admin.address },
        taker_pays: buy === 'XRP' ? { currency: 'XRP' } : { currency: buy, issuer: state.admin.address }
      } as any);
      return NextResponse.json(book.result);
    } finally {
      client.disconnect();
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'failed_to_fetch_offers', details: e?.message ?? String(e) }, { status: 500 });
  }
}

export const runtime = 'nodejs';


