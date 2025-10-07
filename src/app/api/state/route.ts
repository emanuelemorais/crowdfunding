import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';


export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL as string);
    const adminRows = await sql`select address, secret from participants where role = 'admin' order by created_at asc limit 1` as any;
    const admin = adminRows?.[0];
    if (!admin) return NextResponse.json({ error: 'admin_not_found' }, { status: 404 });

    const investors = await sql`select name, address, secret from participants where role = 'investor' order by created_at asc` as any;
    const currencies = await sql`select code, link from currencies order by code asc` as any;

    return NextResponse.json({
      network: 'testnet',
      admin: { address: admin.address, secret: admin.secret },
      investors,
      currencies,
      distributed: true
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'failed_to_read_state', details: e?.message ?? String(e) }, { status: 500 });
  }
}

export const runtime = 'nodejs';


