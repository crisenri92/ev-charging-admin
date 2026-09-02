-- ============================================
-- PAYMENT SYSTEM OPTIMIZATION - MIGRATION 005
-- Índices adicionales y optimizaciones
-- ============================================

-- ============================================
-- 1. ÍNDICES COMPUESTOS para queries comunes
-- ============================================

-- Búsqueda de pagos pendientes por usuario
CREATE INDEX IF NOT EXISTS idx_payments_user_status_created 
  ON public.payments(user_id, status, created_at DESC)
  WHERE status IN ('pending', 'processing');

-- Búsqueda de pagos por provider y contexto
CREATE INDEX IF NOT EXISTS idx_payments_provider_context_status 
  ON public.payments(provider, context, status);

-- Búsqueda de pagos recientes por usuario
CREATE INDEX IF NOT EXISTS idx_payments_user_recent 
  ON public.payments(user_id, created_at DESC)
  INCLUDE (amount, status, provider, context);

-- Pagos que están por expirar (para cleanup)
CREATE INDEX IF NOT EXISTS idx_payments_expiring 
  ON public.payments(expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

-- ============================================
-- 2. ÍNDICES PARA REPORTES
-- ============================================

-- Pagos aprobados por fecha (para reportes diarios)
CREATE INDEX IF NOT EXISTS idx_payments_approved_date 
  ON public.payments(DATE(paid_at), provider)
  WHERE status = 'approved';

-- Pagos por rango de montos
CREATE INDEX IF NOT EXISTS idx_payments_amount_range 
  ON public.payments(amount, created_at DESC)
  WHERE status = 'approved';

-- ============================================
-- 3. ÍNDICES PARCIALES para mejor performance
-- ============================================

-- Solo pagos activos (no expirados ni fallidos)
CREATE INDEX IF NOT EXISTS idx_payments_active 
  ON public.payments(user_id, created_at DESC)
  WHERE status IN ('pending', 'processing', 'approved');

-- Solo Deuna con QR code
CREATE INDEX IF NOT EXISTS idx_payments_deuna_qr 
  ON public.payments(payment_id)
  WHERE provider = 'deuna' AND qr_code IS NOT NULL;

-- Autorizaciones activas de carga
CREATE INDEX IF NOT EXISTS idx_charging_auth_active 
  ON public.charging_authorizations(charger_id, user_id)
  WHERE status = 'authorized';

-- ============================================
-- 4. FUNCIÓN: Estadísticas de pagos
-- ============================================
CREATE OR REPLACE FUNCTION get_payment_stats(
  p_user_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'approved') as total_approved,
      COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
      COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
      SUM(amount) FILTER (WHERE status = 'approved') as total_amount,
      COUNT(DISTINCT user_id) as unique_users,
      jsonb_object_agg(
        provider,
        jsonb_build_object(
          'count', COUNT(*),
          'amount', COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)
        )
      ) as by_provider
    FROM public.payments
    WHERE 
      (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
  )
  SELECT jsonb_build_object(
    'total_approved', COALESCE(total_approved, 0),
    'total_pending', COALESCE(total_pending, 0),
    'total_failed', COALESCE(total_failed, 0),
    'total_amount', COALESCE(total_amount, 0),
    'unique_users', COALESCE(unique_users, 0),
    'by_provider', COALESCE(by_provider, '{}'::jsonb)
  )
  INTO result
  FROM stats;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. FUNCIÓN: Buscar pago por cualquier ID
-- ============================================
CREATE OR REPLACE FUNCTION find_payment(
  p_identifier text
)
RETURNS TABLE (
  payment record,
  deuna_info record
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    row(p.*)::record as payment,
    row(dt.*)::record as deuna_info
  FROM public.payments p
  LEFT JOIN public.deuna_transactions dt ON p.id = dt.payment_id
  WHERE 
    p.payment_id = p_identifier
    OR p.internal_reference = p_identifier
    OR dt.transaction_id = p_identifier
    OR dt.transfer_number = p_identifier
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. FUNCIÓN: Crear pago (helper)
-- ============================================
CREATE OR REPLACE FUNCTION create_payment(
  p_payment_id text,
  p_internal_reference text,
  p_user_id uuid,
  p_provider text,
  p_context text,
  p_amount decimal,
  p_description text,
  p_metadata jsonb DEFAULT NULL,
  p_qr_code text DEFAULT NULL,
  p_deeplink text DEFAULT NULL,
  p_numeric_code text DEFAULT NULL,
  p_checkout_url text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_payment_id uuid;
BEGIN
  INSERT INTO public.payments (
    payment_id,
    internal_reference,
    user_id,
    provider,
    context,
    amount,
    currency,
    status,
    description,
    metadata,
    qr_code,
    deeplink,
    numeric_code,
    checkout_url,
    expires_at
  ) VALUES (
    p_payment_id,
    p_internal_reference,
    p_user_id,
    p_provider,
    p_context,
    p_amount,
    'USD',
    'pending',
    p_description,
    p_metadata,
    p_qr_code,
    p_deeplink,
    p_numeric_code,
    p_checkout_url,
    p_expires_at
  )
  RETURNING id INTO v_payment_id;
  
  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. FUNCIÓN: Aprobar pago y ejecutar acciones
-- ============================================
CREATE OR REPLACE FUNCTION approve_payment(
  p_payment_id uuid,
  p_customer_name text DEFAULT NULL,
  p_customer_identification text DEFAULT NULL,
  p_gateway_metadata jsonb DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_payment record;
  v_balance_before decimal;
  v_balance_after decimal;
BEGIN
  -- Obtener el pago
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id;

  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  -- Si ya está aprobado, no hacer nada
  IF v_payment.status = 'approved' THEN
    RETURN true;
  END IF;

  -- Actualizar estado del pago
  UPDATE public.payments
  SET 
    status = 'approved',
    paid_at = now(),
    customer_name = p_customer_name,
    customer_identification = p_customer_identification,
    updated_at = now()
  WHERE id = p_payment_id;

  -- Ejecutar acción según el contexto
  IF v_payment.context = 'wallet_recharge' THEN
    -- RECARGA DE WALLET
    SELECT COALESCE(balance, 0) INTO v_balance_before
    FROM public.user_balances
    WHERE user_id = v_payment.user_id;

    v_balance_after := v_balance_before + v_payment.amount;

    -- Actualizar saldo
    INSERT INTO public.user_balances (user_id, balance, currency, updated_at)
    VALUES (v_payment.user_id, v_balance_after, 'USD', now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      balance = v_balance_after,
      updated_at = now();

    -- Registrar transacción
    INSERT INTO public.balance_transactions (
      user_id,
      amount,
      type,
      description,
      payment_gateway,
      payment_id,
      balance_before,
      balance_after,
      gateway_metadata
    ) VALUES (
      v_payment.user_id,
      v_payment.amount,
      'recharge',
      COALESCE(v_payment.description, 'Recarga de saldo'),
      v_payment.provider,
      p_payment_id,
      v_balance_before,
      v_balance_after,
      p_gateway_metadata
    );

  ELSIF v_payment.context = 'direct_charge' THEN
    -- PAGO DIRECTO DE CARGA
    -- Crear autorización de carga
    INSERT INTO public.charging_authorizations (
      user_id,
      charger_id,
      payment_id,
      amount_paid,
      provider,
      status,
      authorized_at,
      expires_at
    ) VALUES (
      v_payment.user_id,
      (v_payment.metadata->>'chargerId')::text,
      p_payment_id,
      v_payment.amount,
      v_payment.provider,
      'authorized',
      now(),
      now() + interval '30 minutes'
    );
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. TRIGGER: Auto-cleanup de expirados
-- ============================================
-- Nota: En producción, esto debería ser un cron job
-- Este trigger es solo un ejemplo

-- ============================================
-- 9. GRANTS para funciones
-- ============================================
GRANT EXECUTE ON FUNCTION cleanup_expired_payments() TO service_role;
GRANT EXECUTE ON FUNCTION get_payment_stats(uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION find_payment(text) TO service_role;
GRANT EXECUTE ON FUNCTION create_payment(text, text, uuid, text, text, decimal, text, jsonb, text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION approve_payment(uuid, text, text, jsonb) TO service_role;

-- ============================================
-- FIN DE MIGRACIÓN 005
-- ============================================
