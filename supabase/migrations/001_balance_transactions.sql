-- Ejecutar en: https://supabase.com/dashboard/project/gxuqwjeenjxiljdfegqr/sql/new
CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('recharge','charge_deduction','manual_adjustment','refund')),
  description text,
  charging_session_id uuid,
  stripe_session_id text,
  balance_before decimal(10,2),
  balance_after decimal(10,2),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role" ON public.balance_transactions TO service_role USING (true) WITH CHECK (true);