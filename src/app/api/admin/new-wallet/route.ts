import { NextResponse } from 'next/server';
import xrpl from 'xrpl';
import fs from 'fs';
import path from 'path';
import { createFundedWallet, waitForAccountActivated, submitTx, sleep, setTrustLine } from '../../common/utils';

const STATE_PATH = path.join(process.cwd(), 'data', 'xrpl-poc.json');

export async function POST(req: Request) {
  try {
    const { name, trustlines } = await req.json();
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 });
    }

    // Load current state
    let state;
    try {
      const raw = fs.readFileSync(STATE_PATH, 'utf-8');
      state = JSON.parse(raw);
    } catch (e) {
      return NextResponse.json({ error: 'state_not_found' }, { status: 404 });
    }

    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
    await client.connect();

    try {
      // Create new wallet
      const newWallet = await createFundedWallet(client);
      await waitForAccountActivated(client, newWallet.address);

      // Create admin wallet for trustlines
      const adminWallet = xrpl.Wallet.fromSeed(state.admin.secret);

      // Create trustlines if specified
      if (trustlines && trustlines.length > 0) {
        for (const currency of trustlines) {
          await setTrustLine(client, newWallet, adminWallet, currency, '1000000');
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Add new investor to state
      const newInvestor = {
        name: name.trim(),
        address: newWallet.address,
        secret: newWallet.seed || ''
      };

      state.investors.push(newInvestor);

      // Save updated state
      fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');

      return NextResponse.json({ 
        success: true, 
        investor: newInvestor 
      }, { status: 201 });

    } finally {
      client.disconnect();
    }

  } catch (e: any) {
    return NextResponse.json({ 
      error: 'failed_to_create_wallet', 
      details: e?.message ?? String(e) 
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
