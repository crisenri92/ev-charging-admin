CREATE TABLE IF NOT EXISTS public.user_balances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  balance decimal(10,2) DEFAULT 0.00,
  currency text DEFAULT 'USD',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.user_balances TO service_role USING (true) WITH CHECK (true);
