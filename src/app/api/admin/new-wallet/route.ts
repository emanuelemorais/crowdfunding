import { NextResponse } from 'next/server';
import xrpl from 'xrpl';
import { neon } from '@neondatabase/serverless';
import { createFundedWallet, waitForAccountActivated, submitTx, sleep, setTrustLine } from '../../common/utils';

export async function POST(req: Request) {
  try {
    const { name, trustlines } = await req.json();
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL as string);
    // Fetch admin participant to get issuer address and secret
    const adminRows = await sql`select address, secret from participants where role = 'admin' order by created_at asc limit 1` as any;
    const adminRow = adminRows?.[0];
    if (!adminRow) {
      return NextResponse.json({ error: 'admin_not_found' }, { status: 404 });
    }

    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
    await client.connect();

    try {
      // Create new wallet
      const newWallet = await createFundedWallet(client);
      await waitForAccountActivated(client, newWallet.address);

      // Create admin wallet for trustlines
      const adminWallet = xrpl.Wallet.fromSeed(String(adminRow.secret));

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

      await sql`insert into participants (name, address, secret, role) values (${newInvestor.name}, ${newInvestor.address}, ${newInvestor.secret}, ${'investor'})`;

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
