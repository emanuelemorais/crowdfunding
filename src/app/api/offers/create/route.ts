import { NextResponse } from 'next/server';
import xrpl from 'xrpl';
import { neon } from '@neondatabase/serverless';

// Uses Postgres to fetch investors; no local state file

function toXRPLAmount(obj: { currency: string; value: string; issuer?: string }): string | { currency: string; value: string; issuer: string } {
  if (obj.currency === 'XRP') {
    // Convert value to drops (1 XRP = 1,000,000 drops)
    return xrpl.xrpToDrops(obj.value);
  }
  // issuer is required for issued currencies
  return { currency: obj.currency, value: obj.value, issuer: obj.issuer! };
}

async function ensureTrustline(client: xrpl.Client, wallet: xrpl.Wallet, currency: string, issuer: string) {
  try {
    const trustlines = await client.request({
      command: 'account_lines',
      account: wallet.address,
      ledger_index: 'validated'
    });
    
    const trustline = trustlines.result.lines.find((line: any) => 
      line.currency === currency && line.account === issuer
    );
    
    if (!trustline) {
      // Create trustline
      const trustSetTx: xrpl.TrustSet = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency,
          issuer,
          value: '1000000'
        }
      };
      
      const prepared = await client.autofill(trustSetTx);
      const signed = wallet.sign(prepared);
      await client.submitAndWait(signed.tx_blob);
    }
  } catch (e: any) {
    throw new Error(`Trustline creation failed: ${e.message}`);
  }
}

async function checkCanFundOffer(
  client: xrpl.Client,
  account: string,
  takerGets: xrpl.Amount
) {
  if (typeof takerGets === 'string') {
    // XRP em drops: checar AccountRoot.Balance
    const info = await client.request({ command: 'account_info', account, ledger_index: 'validated' })
    const xrpDrops = BigInt(info.result.account_data.Balance)
    const needDrops = BigInt(takerGets) // já em drops
    console.log("xrpDrops", xrpDrops);
    console.log("needDrops", needDrops);
    if (xrpDrops < needDrops) throw new Error('insufficient_xrp_for_TakerGets')
  } else {
    // IOU: checar trustline balance do issuer/currency
    const lines = await client.request({
      command: 'account_lines',
      account,
      ledger_index: 'validated',
      peer: takerGets.issuer
    })
    console.log("lines", lines);
    const line = lines.result.lines.find(l => l.currency === takerGets.currency && (l.account === takerGets.issuer || l.account === takerGets.issuer))
    const balance = line ? Number(line.balance) : 0
    const need = Number(takerGets.value)
    if (balance < need) throw new Error('insufficient_iou_for_TakerGets')
  }
}

export async function POST(req: Request) {
  try {
    const { investorAddress, takerGets, takerPays } = await req.json();
    const sql = neon(process.env.DATABASE_URL as string);
    const rows = await sql`select name, address, secret from participants where role = 'investor' and address = ${investorAddress} limit 1` as any;
    const investor = rows?.[0];
    if (!investor) return NextResponse.json({ error: 'investor_not_found' }, { status: 404 });

    const wallet = xrpl.Wallet.fromSeed(investor.secret);
    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
    await client.connect();

    try {
      // Ensure trustlines exist for both tokens (if not XRP)
      if (typeof takerPays === 'object' && takerPays.currency !== 'XRP') {
        await ensureTrustline(client, wallet, takerPays.currency, takerPays.issuer);
      }
      if (typeof takerGets === 'object' && takerGets.currency !== 'XRP') {
        await ensureTrustline(client, wallet, takerGets.currency, takerGets.issuer);
      }
      
      // Check balance before creating offer: ability to pay TakerPays
      try {
        await checkCanFundOffer(client, wallet.address, toXRPLAmount(takerGets))
      } catch (balanceError: any) {
        return NextResponse.json({ 
          error: 'insufficient_balance', 
          message: balanceError.message || 'Saldo insuficiente para criar a oferta',
          details: balanceError.message 
        }, { status: 400 });
      }
      
      const offerCreateTx: xrpl.SubmittableTransaction = {
        TransactionType: 'OfferCreate',
        Account: wallet.address,
        TakerPays: toXRPLAmount(takerPays),
        TakerGets: toXRPLAmount(takerGets),
      };
      
      const prepared = await client.autofill(offerCreateTx);
      const signed = wallet.sign(prepared);
      const res = await client.submitAndWait(signed.tx_blob);
      console.log("offer created", res.result);
      return NextResponse.json({ result: res.result } , { status: 201 });
    } finally {
      client.disconnect();
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'failed_to_create_offer', details: e?.message ?? String(e) }, { status: 500 });
  }
}

export const runtime = 'nodejs';


