import { NextResponse } from 'next/server';
import xrpl from 'xrpl';
import { neon } from '@neondatabase/serverless';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { walletAddress, walletSecret, currency, issuer, limit = '1000000' } = body as {
      walletAddress: string;
      walletSecret: string;
      currency: string;
      issuer: string;
      limit?: string;
    };

    if (!walletAddress || !currency || !issuer) {
      return NextResponse.json({ error: 'missing_parameters' }, { status: 400 });
    }

    // Look up wallet secret from DB if not provided
    if (!walletSecret) {
      const sql = neon(process.env.DATABASE_URL as string);
      const adminRows = await sql`select address, secret from participants where role = 'admin' order by created_at asc limit 1` as any;
      const admin = adminRows?.[0];
      if (admin && admin.address === walletAddress) {
        walletSecret = admin.secret as string;
      } else {
        const investorRows = await sql`select secret from participants where role = 'investor' and address = ${walletAddress} limit 1` as any;
        const investor = investorRows?.[0];
        if (investor) {
          walletSecret = investor.secret as string;
        }
      }
    }
    if (!walletSecret) {
      return NextResponse.json({ error: 'wallet_secret_not_found' }, { status: 400 });
    }

    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
    await client.connect();
    try {
      const wallet = xrpl.Wallet.fromSeed(walletSecret);

      // Ensure walletAddress matches
      if (wallet.address !== walletAddress) {
        return NextResponse.json({ error: 'wallet_mismatch' }, { status: 400 });
      }

      // Check if trustline already exists
      const existing = await client.request({
        command: 'account_lines',
        account: wallet.address,
        ledger_index: 'validated',
        peer: issuer
      });
      const has = (existing.result.lines ?? []).some((l: any) => l.currency === currency && (l.account === issuer));
      if (has) {
        return NextResponse.json({ status: 'exists' }, { status: 200 });
      }

      const tx: xrpl.TrustSet = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: { currency, issuer, value: limit }
      };
      const prepared = await client.autofill(tx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      return NextResponse.json({ result: result.result }, { status: 201 });
    } finally {
      client.disconnect();
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'failed_to_create_trustline', details: e?.message ?? String(e) }, { status: 500 });
  }
}

export const runtime = 'nodejs';
