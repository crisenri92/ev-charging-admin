-- Run these in Supabase SQL Editor

-- 1. Add missing columns to charging_sessions (if not exists)
ALTER TABLE charging_sessions
ADD COLUMN IF NOT EXISTS energy_kwh NUMERIC,
ADD COLUMN IF NOT EXISTS cost NUMERIC,
ADD COLUMN IF NOT EXISTS stop_reason TEXT,
ADD COLUMN IF NOT EXISTS charger_name TEXT,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- 2. Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
action TEXT NOT NULL,
target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
details JSONB,
performed_by TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);

-- RLS: only service role can read/write
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON audit_logs USING (false);

-- 3. Delete/reset password audit in users API
-- (handled in application code)

COMMENT ON TABLE audit_logs IS 'Admin action audit trail for compliance';

-- =====================================================
-- MIGRATION: Minutes-based wallet (Nov 2026)
-- Run each block in Supabase SQL Editor
-- =====================================================

-- 4. Add minutes_balance column to user_balances
ALTER TABLE user_balances
  ADD COLUMN IF NOT EXISTS minutes_balance INTEGER NOT NULL DEFAULT 0;

-- 5. Create minute_packages table (admin-configurable pricing)
CREATE TABLE IF NOT EXISTS minute_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for minute_packages
ALTER TABLE minute_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read active packages" ON minute_packages;
CREATE POLICY "Public can read active packages" ON minute_packages
  FOR SELECT USING (active = true);

-- Default packages (run only once)
INSERT INTO minute_packages (name, minutes, price_usd, display_order)
SELECT name, minutes, price_usd, display_order FROM (VALUES
  ('Pack 30 min',  30,  3.00::DECIMAL, 1),
  ('Pack 60 min',  60,  5.50::DECIMAL, 2),
  ('Pack 120 min', 120, 10.00::DECIMAL, 3),
  ('Pack 240 min', 240, 18.00::DECIMAL, 4)
) AS t(name, minutes, price_usd, display_order)
WHERE NOT EXISTS (SELECT 1 FROM minute_packages LIMIT 1);

-- 6. Add minutes tracking columns to balance_transactions
ALTER TABLE balance_transactions
  ADD COLUMN IF NOT EXISTS minutes_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutes_before INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutes_after  INTEGER NOT NULL DEFAULT 0;

-- 7. Update close_charging_session RPC to also deduct minutes
CREATE OR REPLACE FUNCTION close_charging_session(
  p_session_id UUID,
  p_user_id    UUID,
  p_energy_kwh NUMERIC,
  p_cost       NUMERIC,
  p_stop_meter NUMERIC,
  p_stop_time  TIMESTAMPTZ,
  p_stop_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before NUMERIC  := 0;
  v_balance_after  NUMERIC  := 0;
  v_minutes_before INTEGER  := 0;
  v_minutes_after  INTEGER  := 0;
  v_session_start  TIMESTAMPTZ;
  v_duration_min   INTEGER  := 0;
BEGIN
  SELECT balance, COALESCE(minutes_balance, 0)
  INTO v_balance_before, v_minutes_before
  FROM user_balances WHERE user_id = p_user_id;

  SELECT started_at INTO v_session_start
  FROM charging_sessions WHERE id = p_session_id;

  IF v_session_start IS NOT NULL THEN
    v_duration_min := GREATEST(1, CEIL(
      EXTRACT(EPOCH FROM (p_stop_time - v_session_start)) / 60.0
    )::INTEGER);
  END IF;

  v_balance_after := GREATEST(0, ROUND((v_balance_before - p_cost)::NUMERIC, 2));
  v_minutes_after := GREATEST(0, v_minutes_before - v_duration_min);

  UPDATE charging_sessions SET
    status      = 'completed',
    energy_kwh  = p_energy_kwh,
    cost        = p_cost,
    meter_stop  = p_stop_meter,
    ended_at    = p_stop_time,
    stop_reason = p_stop_reason
  WHERE id = p_session_id;

  UPDATE user_balances SET
    balance         = v_balance_after,
    minutes_balance = v_minutes_after,
    updated_at      = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO balance_transactions (
    user_id, amount, type, description,
    balance_before, balance_after,
    minutes_amount, minutes_before, minutes_after
  ) VALUES (
    p_user_id, -p_cost, 'charge_deduction',
    ROUND(p_energy_kwh::NUMERIC, 2)::TEXT || ' kWh · ' || v_duration_min || ' min de carga',
    v_balance_before, v_balance_after,
    -v_duration_min, v_minutes_before, v_minutes_after
  );

  RETURN json_build_object(
    'balance_after',    v_balance_after,
    'minutes_after',    v_minutes_after,
    'duration_minutes', v_duration_min
  );
END;
$$;


-- =====================================================
-- MIGRATION: profiles auto-creation trigger (Nov 2026)
-- Ensures every new Supabase Auth user gets a profiles row
-- =====================================================

-- 8. Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 9. Trigger to auto-create profile row on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'user',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 10. Backfill: create profiles for existing users who don't have one
INSERT INTO profiles (id, role, full_name)
SELECT
  u.id,
  'user',
  COALESCE(u.raw_user_meta_data->>'full_name', u.email)
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;


-- =====================================================
-- MIGRATION: profiles auto-creation trigger (Nov 2026)
-- Ensures every new Supabase Auth user gets a profiles row
-- =====================================================

-- 8. Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 9. Trigger to auto-create profile row on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'user',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 10. Backfill: create profiles for existing users who don't have one
INSERT INTO profiles (id, role, full_name)
SELECT
  u.id,
  'user',
  COALESCE(u.raw_user_meta_data->>'full_name', u.email)
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
