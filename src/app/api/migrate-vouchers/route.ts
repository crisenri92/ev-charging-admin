import { NextResponse } from 'next/server'

async function runSQL(query: string) {
  const pat = process.env.SUPABASE_MANAGEMENT_PAT
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL!.match(/https:\/\/([^.]+)\./)?.[1]
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pat}` },
    body: JSON.stringify({ query })
  })
  return { ok: r.ok, status: r.status, body: await r.text() }
}

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('s') !== 'mig2026')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const results = []
  results.push({ q: 'vouchers table', ...(await runSQL(`CREATE TABLE IF NOT EXISTS vouchers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text NOT NULL UNIQUE, description text,
    amount decimal(10,2) NOT NULL, max_uses int NOT NULL DEFAULT 1,
    uses_count int NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
    expires_at timestamptz, created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id))`)) })
  results.push({ q: 'redemptions table', ...(await runSQL(`CREATE TABLE IF NOT EXISTS voucher_redemptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    redeemed_at timestamptz DEFAULT now(), amount decimal(10,2) NOT NULL,
    UNIQUE(voucher_id, user_id))`)) })
  results.push({ q: 'rls vouchers', ...(await runSQL('ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY')) })
  results.push({ q: 'rls redemptions', ...(await runSQL('ALTER TABLE voucher_redemptions ENABLE ROW LEVEL SECURITY')) })
  results.push({ q: 'policy vouchers', ...(await runSQL(`DO $b$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vouchers' AND policyname='service_role_vouchers') THEN
      CREATE POLICY service_role_vouchers ON vouchers FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $b$`)) })
  results.push({ q: 'policy redemptions', ...(await runSQL(`DO $b$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='voucher_redemptions' AND policyname='service_role_redemptions') THEN
      CREATE POLICY service_role_redemptions ON voucher_redemptions FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $b$`)) })
  results.push({ q: 'seed voucher', ...(await runSQL(`INSERT INTO vouchers (code, description, amount, max_uses, active)
    VALUES ('BIENVENIDA', 'Credito de bienvenida', 5.00, 0, true) ON CONFLICT (code) DO NOTHING`)) })

  return NextResponse.json({ allOk: results.every(r => r.ok), results })
}
