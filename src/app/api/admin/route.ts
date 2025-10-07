import { NextResponse } from 'next/server';
import xrpl from 'xrpl';
import fs from 'fs';
import path from 'path';

async function getTrustLinesForIssuer(
  client: xrpl.Client,
  issuerAddress: string
): Promise<Array<{ account: string; currency: string; balance: string; limit: string }>> {
  const resp = await client.request({
    command: 'account_lines',
    account: issuerAddress,
    ledger_index: 'validated'
  });
  
  const lines = resp.result.lines ?? [];
  return lines.map(line => ({
    account: line.account,
    currency: line.currency,
    balance: line.balance,
    limit: line.limit
  }));
}

export async function GET() {
  const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  await client.connect();

  try {
    const STATE_PATH = path.join(process.cwd(), 'data', 'xrpl-poc.json');
    let issuerAddress = '';
    let stateData = null;
    try {
      const raw = fs.readFileSync(STATE_PATH, 'utf-8');
      const json = JSON.parse(raw);
      issuerAddress = json?.admin?.address ?? '';
      stateData = json;
    } catch (_e) {}
    if (!issuerAddress) {
      return NextResponse.json({ error: 'admin.address not found in xrpl-poc.json' }, { status: 400 });
    }
    
    const trustLines = await getTrustLinesForIssuer(client, issuerAddress);
    
    // Agrupar por moeda
    const byCurrency: Record<string, Array<{ account: string; balance: string; limit: string }>> = {};
    
    for (const line of trustLines) {
      if (!byCurrency[line.currency]) {
        byCurrency[line.currency] = [];
      }
      byCurrency[line.currency].push({
        account: line.account,
        balance: line.balance,
        limit: line.limit
      });
    }

    // Estatísticas
    const uniqueAccounts = Array.from(new Set(trustLines.map(tl => tl.account)));
    const currencies = Object.keys(byCurrency);

    return NextResponse.json({
      issuer: issuerAddress,
      summary: {
        totalTrustLines: trustLines.length,
        uniqueAccounts: uniqueAccounts.length,
        currencies: currencies.length,
        currenciesList: currencies
      },
      byCurrency,
      allTrustLines: trustLines,
      investors: stateData?.investors || []
    }, { status: 200 });

  } catch (e: any) {
    return NextResponse.json(
      { error: 'Failed to query trust lines from blockchain', details: e?.message ?? String(e) },
      { status: 500 }
    );
  } finally {
    client.disconnect();
  }
}

export const runtime = 'nodejs';