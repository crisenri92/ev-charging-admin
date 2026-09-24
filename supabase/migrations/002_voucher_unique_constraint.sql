-- C-1: Prevent double redemption of vouchers by the same user
-- The UNIQUE(voucher_id, user_id) constraint was already declared in 003_vouchers.sql.
-- This migration ensures it exists as a named constraint on all environments,
-- running idempotently via a DO block (ADD CONSTRAINT IF NOT EXISTS is not valid PostgreSQL).
DO $$
BEGIN
  -- Add a named unique constraint only if no equivalent unique constraint exists yet
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    WHERE r.relname = 'voucher_redemptions'
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 2
      AND c.conkey @> ARRAY(
        SELECT a.attnum::smallint
        FROM pg_attribute a
        WHERE a.attrelid = r.oid
          AND a.attname IN ('voucher_id', 'user_id')
      )
  ) THEN
    ALTER TABLE voucher_redemptions
      ADD CONSTRAINT unique_voucher_user_redemption UNIQUE (voucher_id, user_id);
  END IF;
END $$;
