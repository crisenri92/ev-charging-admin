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
