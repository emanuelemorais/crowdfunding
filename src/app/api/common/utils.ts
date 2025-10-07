import fs from 'fs';
import path from 'path';
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

export const DATA_DIR = path.join(process.cwd(), 'data');
export const STATE_PATH = path.join(DATA_DIR, 'xrpl-poc.json');

export function loadState(): PocState | null {
    try {
      if (fs.existsSync(STATE_PATH)) {
        const raw = fs.readFileSync(STATE_PATH, 'utf-8');
        return JSON.parse(raw) as PocState;
      }
    } catch (_e) {}
    return null;
}

async function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
  
  
export function saveState(state: PocState) {
    ensureDir(DATA_DIR);
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
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
