-- ============================================
-- PAYMENTS SYSTEM - MIGRATION 004
-- Sistema unificado de pagos multi-gateway
-- ============================================

-- ============================================
-- 1. TABLA: payments (Registro unificado de pagos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identificadores
  payment_id text NOT NULL UNIQUE,           -- ID del pago (puede ser de Deuna, Stripe, etc)
  internal_reference text UNIQUE,            -- Referencia interna única generada por nosotros
  
  -- Usuario
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Información del pago
  provider text NOT NULL CHECK (provider IN ('deuna', 'stripe', 'wallet')),
  context text NOT NULL CHECK (context IN ('wallet_recharge', 'direct_charge')),
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'approved', 'failed', 'expired', 'reversed')),
  
  -- Metadata del pago
  description text,
  metadata jsonb,                            -- Metadata flexible (chargerId, etc)
  
  -- Métodos de pago generados (para Deuna)
  qr_code text,                              -- QR en base64/SVG
  deeplink text,                             -- Link de pago
  numeric_code text,                         -- Código de 6 dígitos
  checkout_url text,                         -- URL de checkout (Stripe)
  
  -- Info del cliente (llenado por webhook)
  customer_name text,
  customer_identification text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz,                    -- Cuándo expira el pago
  paid_at timestamptz,                       -- Cuándo se confirmó el pago
  
  -- Índices para búsquedas rápidas
  CONSTRAINT payments_amount_positive CHECK (amount > 0)
);

-- Índices para performance
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_payment_id ON public.payments(payment_id);
CREATE INDEX idx_payments_internal_ref ON public.payments(internal_reference) WHERE internal_reference IS NOT NULL;
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_provider ON public.payments(provider);
CREATE INDEX idx_payments_context ON public.payments(context);
CREATE INDEX idx_payments_created_at ON public.payments(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios ven sus propios pagos
CREATE POLICY "Users see own payments" 
  ON public.payments FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy: service role acceso total
CREATE POLICY "Service role full access" 
  ON public.payments 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at_trigger
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- ============================================
-- 2. TABLA: deuna_transactions (Específica Deuna)
-- ============================================
CREATE TABLE IF NOT EXISTS public.deuna_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Relación con payment unificado
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  
  -- IDs de Deuna
  transaction_id text NOT NULL UNIQUE,       -- UUID de Deuna
  internal_reference text NOT NULL UNIQUE,   -- Nuestra referencia interna
  transfer_number text,                      -- Número de transferencia (cuando se paga)
  
  -- Info adicional de Deuna
  branch_id text,                            -- ID de sucursal
  pos_id text,                               -- ID de punto de venta
  point_of_sale text,                        -- Código de caja usado
  
  -- Metadata de Deuna
  raw_webhook_data jsonb,                    -- Data cruda del webhook
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_deuna_transaction_id ON public.deuna_transactions(transaction_id);
CREATE INDEX idx_deuna_internal_ref ON public.deuna_transactions(internal_reference);
CREATE INDEX idx_deuna_transfer_number ON public.deuna_transactions(transfer_number) WHERE transfer_number IS NOT NULL;
CREATE INDEX idx_deuna_payment_id ON public.deuna_transactions(payment_id);

-- RLS
ALTER TABLE public.deuna_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: service role only
CREATE POLICY "Service role access deuna transactions" 
  ON public.deuna_transactions 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- ============================================
-- 3. ACTUALIZAR: balance_transactions
-- ============================================
-- Agregar columnas para multi-gateway
DO $$ 
BEGIN
  -- Agregar columna payment_gateway si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'balance_transactions' 
    AND column_name = 'payment_gateway'
  ) THEN
    ALTER TABLE public.balance_transactions 
    ADD COLUMN payment_gateway text DEFAULT 'legacy';
  END IF;

  -- Agregar columna payment_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'balance_transactions' 
    AND column_name = 'payment_id'
  ) THEN
    ALTER TABLE public.balance_transactions 
    ADD COLUMN payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;
  END IF;

  -- Agregar columna gateway_metadata si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'balance_transactions' 
    AND column_name = 'gateway_metadata'
  ) THEN
    ALTER TABLE public.balance_transactions 
    ADD COLUMN gateway_metadata jsonb;
  END IF;

  -- Agregar columna deuna_transaction_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'balance_transactions' 
    AND column_name = 'deuna_transaction_id'
  ) THEN
    ALTER TABLE public.balance_transactions 
    ADD COLUMN deuna_transaction_id text;
  END IF;

  -- Agregar columna deuna_transfer_number si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'balance_transactions' 
    AND column_name = 'deuna_transfer_number'
  ) THEN
    ALTER TABLE public.balance_transactions 
    ADD COLUMN deuna_transfer_number text;
  END IF;
END $$;

-- Crear índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_balance_transactions_gateway 
  ON public.balance_transactions(payment_gateway);

CREATE INDEX IF NOT EXISTS idx_balance_transactions_payment_id 
  ON public.balance_transactions(payment_id) 
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_balance_transactions_deuna_id 
  ON public.balance_transactions(deuna_transaction_id) 
  WHERE deuna_transaction_id IS NOT NULL;

-- ============================================
-- 4. TABLA: charging_authorizations
-- ============================================
-- Vincula pagos con sesiones de carga autorizadas
CREATE TABLE IF NOT EXISTS public.charging_authorizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Referencias
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charger_id text NOT NULL,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  charging_session_id uuid REFERENCES public.charging_sessions(id) ON DELETE SET NULL,
  
  -- Info de la autorización
  amount_paid decimal(10,2) NOT NULL,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('authorized', 'used', 'expired', 'cancelled')),
  
  -- Timestamps
  authorized_at timestamptz DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_charging_auth_user_id ON public.charging_authorizations(user_id);
CREATE INDEX idx_charging_auth_charger_id ON public.charging_authorizations(charger_id);
CREATE INDEX idx_charging_auth_payment_id ON public.charging_authorizations(payment_id);
CREATE INDEX idx_charging_auth_status ON public.charging_authorizations(status);
CREATE INDEX idx_charging_auth_session_id ON public.charging_authorizations(charging_session_id) 
  WHERE charging_session_id IS NOT NULL;

-- RLS
ALTER TABLE public.charging_authorizations ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios ven sus propias autorizaciones
CREATE POLICY "Users see own authorizations" 
  ON public.charging_authorizations FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy: service role acceso total
CREATE POLICY "Service role full access charging auth" 
  ON public.charging_authorizations 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- ============================================
-- 5. FUNCIÓN: Limpiar pagos expirados
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_payments()
RETURNS void AS $$
BEGIN
  -- Marcar como expirados los pagos pendientes que pasaron su tiempo
  UPDATE public.payments
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  -- Marcar como expiradas las autorizaciones no usadas
  UPDATE public.charging_authorizations
  SET status = 'expired'
  WHERE status = 'authorized'
    AND expires_at IS NOT NULL
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. VISTAS ÚTILES
-- ============================================

-- Vista: Pagos con info del usuario
CREATE OR REPLACE VIEW public.payments_with_user AS
SELECT 
  p.*,
  u.email as user_email,
  u.raw_user_meta_data->>'name' as user_name
FROM public.payments p
LEFT JOIN auth.users u ON p.user_id = u.id;

-- Vista: Resumen de pagos por provider
CREATE OR REPLACE VIEW public.payment_summary_by_provider AS
SELECT 
  provider,
  context,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(created_at) as first_payment,
  MAX(created_at) as last_payment
FROM public.payments
GROUP BY provider, context, status;

-- Vista: Pagos Deuna con detalles
CREATE OR REPLACE VIEW public.deuna_payments_full AS
SELECT 
  p.*,
  dt.transaction_id as deuna_transaction_id,
  dt.transfer_number,
  dt.branch_id,
  dt.pos_id,
  dt.point_of_sale
FROM public.payments p
INNER JOIN public.deuna_transactions dt ON p.id = dt.payment_id
WHERE p.provider = 'deuna';

-- ============================================
-- 7. COMENTARIOS EN TABLAS (Documentación)
-- ============================================
COMMENT ON TABLE public.payments IS 'Registro unificado de todos los pagos del sistema (Deuna, Stripe, Wallet)';
COMMENT ON TABLE public.deuna_transactions IS 'Información específica de transacciones Deuna';
COMMENT ON TABLE public.charging_authorizations IS 'Autorizaciones de carga vinculadas a pagos';

COMMENT ON COLUMN public.payments.payment_id IS 'ID externo del pago (del provider)';
COMMENT ON COLUMN public.payments.internal_reference IS 'Referencia interna única generada por nosotros';
COMMENT ON COLUMN public.payments.provider IS 'Provider de pago: deuna, stripe, wallet';
COMMENT ON COLUMN public.payments.context IS 'Contexto: wallet_recharge o direct_charge';
COMMENT ON COLUMN public.payments.metadata IS 'Metadata flexible en JSON (chargerId, estimatedKwh, etc)';

-- ============================================
-- FIN DE MIGRACIÓN 004
-- ============================================
