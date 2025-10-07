import xrpl from 'xrpl';
import { loadState } from '../common/utils';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
    await client.connect();

    const state = await loadState();
    if (!state) return NextResponse.json({ error: 'state_not_found' }, { status: 404 });

    const url = new URL(req.url);
    const address = url.searchParams.get('address');
    if (!address) return NextResponse.json({ error: 'address parameter required' }, { status: 400 });

    const currency = url.searchParams.get('currency');
    if (!currency) return NextResponse.json({ error: 'currency parameter required' }, { status: 400 });
    
    const acct = await client.request({ command: "account_info", account: address })
    const xrp = Number(acct.result.account_data.Balance) / 1_000_000

    // IOU via trust lines
    const lines = await client.request({ command: "account_lines", account: address })
    const line = lines.result.lines.find(l => l.currency === currency && l.account === state.admin.address)

    await client.disconnect()

    return NextResponse.json({ xrp, iou: line?.balance ?? "0" });
}