import { neon } from '@neondatabase/serverless';
import xrpl from 'xrpl';

export type Investor = {
    name: string;
    address: string;
    secret: string;
  };
  
export type CurrencyInfo = string | { code: string; link: string };

export type PocState = {
    network: 'testnet';
    admin: { address: string; secret: string };
    investors: Investor[];
    currencies: CurrencyInfo[]; 
    distributed: boolean;
};

export async function loadState(): Promise<PocState | null> {
  const sql = neon(process.env.DATABASE_URL as string);
  const adminRows = await sql`select address, secret from participants where role = 'admin' order by created_at asc limit 1` as any;
  const admin = adminRows?.[0];
  if (!admin) return null;

  const investors = await sql`select name, address, secret from participants where role = 'investor' order by created_at asc` as any;
  const currencies = await sql`select code, link from currencies order by code asc` as any;

  const state: PocState = {
    network: 'testnet',
    admin: { address: admin.address, secret: admin.secret },
    investors,
    currencies,
    distributed: true
  };
  return state;
}

export async function createFundedWallet(client: xrpl.Client) {
  const funded = await client.fundWallet();
  return funded.wallet as xrpl.Wallet;
}

export async function waitForAccountActivated(client: xrpl.Client, address: string, retries = 15, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const info = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });
      if (info.result?.account_data?.Balance) return;
    } catch (_e) {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error(`Timeout waiting account activation: ${address}`);
}

export async function submitTx(client: xrpl.Client, wallet: xrpl.Wallet, tx: xrpl.SubmittableTransaction) {
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const res = await client.submitAndWait(signed.tx_blob);
  const engine = (res.result as any)?.engine_result as string | undefined;
  const meta = res.result?.meta as unknown;
  const code = typeof meta === 'string' ? engine : (meta as { TransactionResult?: string })?.TransactionResult ?? engine;
  if (code !== "tesSUCCESS") {
    throw new Error(`Transaction failed: ${code ?? "unknown"} for ${tx.TransactionType}`);
  }
  return res;
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function setTrustLine(
  client: xrpl.Client,
  holder: xrpl.Wallet,
  admin: xrpl.Wallet,
  currency: string,
  limit: string
) {

  await submitTx(client, holder, {
    TransactionType: "TrustSet",
    Account: holder.address,
    LimitAmount: { currency, issuer: admin.address, value: limit }
  });

  await sleep(200);

  await submitTx(client, holder, {
    TransactionType: "TrustSet",
    Account: holder.address,
    LimitAmount: { currency, issuer: admin.address, value: limit },
    Flags: xrpl.TrustSetFlags.tfClearNoRipple
  });

  await sleep(200);


  await submitTx(client, admin, {
    TransactionType: "TrustSet",
    Account: admin.address,
    LimitAmount: { currency, issuer: holder.address, value: "0" },
    Flags: xrpl.TrustSetFlags.tfSetfAuth
  });
}
