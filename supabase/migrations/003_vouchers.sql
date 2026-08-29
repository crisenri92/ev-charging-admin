CREATE TABLE IF NOT EXISTS vouchers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text,
  amount decimal(10,2) NOT NULL,          -- crédito en USD a agregar al wallet
  max_uses int NOT NULL DEFAULT 1,        -- 0 = ilimitado
  uses_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,                  -- NULL = no expira
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  amount decimal(10,2) NOT NULL,
  UNIQUE(voucher_id, user_id)             -- un usuario solo puede canjear un voucher una vez
);

ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_redemptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='voucher_redemptions' AND policyname='Users see own redemptions') THEN
    CREATE POLICY "Users see own redemptions" ON voucher_redemptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Welcome voucher for new users (to be applied on registration)
INSERT INTO vouchers (code, description, amount, max_uses, active)
VALUES ('BIENVENIDA', 'Crédito de bienvenida para nuevos usuarios', 5.00, 0, true)
ON CONFLICT (code) DO NOTHING;
