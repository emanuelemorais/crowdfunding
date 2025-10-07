import { NextResponse } from 'next/server';
import xrpl from 'xrpl';
import { loadState, saveState, PocState, CurrencyInfo } from '../common/utils';
import { createFundedWallet, waitForAccountActivated, submitTx, sleep, setTrustLine } from '../common/utils';

async function issueTokens(
  client: xrpl.Client,
  issuer: xrpl.Wallet,
  destination: string,
  currency: string,
  value: string
) {
  const tx: xrpl.Payment = {
    TransactionType: 'Payment',
    Account: issuer.address,
    Destination: destination,
    Amount: {
      currency,
      issuer: issuer.address,
      value
    }
  };
  const prepared = await client.autofill(tx);
  const signed = issuer.sign(prepared);
  await client.submitAndWait(signed.tx_blob);
}

export async function GET() {
  const existing = loadState();
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  await client.connect();
  try {
    const admin = await createFundedWallet(client);
    const inv1 = await createFundedWallet(client);
    const inv2 = await createFundedWallet(client);
    const inv3 = await createFundedWallet(client);

    await waitForAccountActivated(client, admin.address);
    await waitForAccountActivated(client, inv1.address);
    await waitForAccountActivated(client, inv2.address);
    await waitForAccountActivated(client, inv3.address);

    await submitTx(client, admin, {
      TransactionType: "AccountSet",
      Account: admin.address,
      SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple 
    });

    await sleep(200);

    await submitTx(client, admin, {
      TransactionType: "AccountSet",
      Account: admin.address,
      SetFlag: xrpl.AccountSetAsfFlags.asfRequireAuth 
    });


    await sleep(300);

    const codes = ['BRL', 'TKA', 'TKB'];

    // Trust lines for first two investors for all codes
    for (const investor of [inv1, inv2]) {
      for (const cur of codes) {
        await setTrustLine(client, investor, admin, cur, '1000000');
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Third investor: trustline only for BRL
    await setTrustLine(client, inv3, admin, 'BRL', '1000000');
    await new Promise(r => setTimeout(r, 500));

    // Distribute tokens from issuer/admin to first two investors only
    for (const [idx, investor] of [inv1, inv2].entries()) {
      const base = (idx + 1) * 1000;
      for (const cur of codes) {
        await issueTokens(client, admin, investor.address, cur, String(base));
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const currencies: CurrencyInfo[] = codes.map(code => ({
      code,
      link: `${code}:${admin.address}`
    }));

    const state: PocState = {
      network: 'testnet',
      admin: { address: admin.address, secret: admin.seed ?? '' },
      investors: [
        { name: 'Investor 1', address: inv1.address, secret: inv1.seed ?? '' },
        { name: 'Investor 2', address: inv2.address, secret: inv2.seed ?? '' },
        { name: 'Investor 3', address: inv3.address, secret: inv3.seed ?? '' }
      ],
      currencies,
      distributed: true
    };

    saveState(state);
    return NextResponse.json(state, { status: 201 });
  } catch (e: any) {
    console.error('XRPL POC setup error:', e);
    return NextResponse.json({ error: 'Failed to setup XRPL POC', details: e?.message ?? String(e) }, { status: 500 });
  } finally {
    client.disconnect();
  }
}

export const runtime = 'nodejs';


