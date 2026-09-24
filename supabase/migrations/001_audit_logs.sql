-- Migration: 001_audit_logs
-- Creates the audit_logs table for tracking admin and user actions.
-- Run this in the Supabase SQL editor (dashboard.supabase.com > SQL Editor).

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT          NOT NULL,               -- e.g. 'charging.start'
  resource_type TEXT          NOT NULL,               -- e.g. 'charging_session'
  resource_id   TEXT,                                 -- primary key of affected row
  metadata      JSONB         DEFAULT '{}'::jsonb,    -- any extra context
  created_at    TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only the service role (backend) can write audit logs
-- (service_role bypasses RLS anyway, but this makes intent explicit)
CREATE POLICY "service_role_full_access" ON audit_logs
  FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Optional: allow authenticated users to read their own audit logs
CREATE POLICY "users_read_own_logs" ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);
