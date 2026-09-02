/**
 * POST /api/payments/webhooks/stripe
 * Procesa webhooks de Stripe (refactorizado para nueva arquitectura)
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializePaymentGateway, PaymentProvider, PaymentStatus, PaymentContext } from '@/lib/payments';
import { getPaymentRepository } from '@/lib/database/payment-repository';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1. Obtener body raw (Stripe lo necesita para validar firma)
    const body = await req.text();
    const headers = Object.fromEntries(req.headers);

    console.log('[Stripe Webhook] Received webhook');

    // 2. Procesar webhook usando el gateway
    const gateway = initializePaymentGateway();
    
    let webhookEvent;
    try {
      webhookEvent = await gateway.handleWebhook(
        PaymentProvider.STRIPE,
        headers,
        body
      );
    } catch (error: any) {
      console.error('[Stripe Webhook] Invalid webhook:', error);
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    console.log('[Stripe Webhook] Event processed:', {
      paymentId: webhookEvent.paymentId,
      status: webhookEvent.status,
      amount: webhookEvent.amount,
    });

    // 3. Buscar el pago en nuestra BD
    const repo = getPaymentRepository();
    const payment = await repo.findByPaymentId(webhookEvent.paymentId);
    
    if (!payment) {
      console.error('[Stripe Webhook] Payment not found:', webhookEvent.paymentId);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // 4. Verificar si ya fue procesado
    if (payment.status === 'approved') {
      console.log('[Stripe Webhook] Payment already processed');
      return NextResponse.json({
        received: true,
        message: 'Payment already processed',
      });
    }

    // 5. Solo procesar si está aprobado
    if (webhookEvent.status !== PaymentStatus.APPROVED) {
      console.log('[Stripe Webhook] Payment not approved');
      await repo.updatePaymentStatus(payment.id, webhookEvent.status);
      return NextResponse.json({ received: true });
    }

    // 6. Actualizar estado del pago
    await repo.updatePaymentStatus(
      payment.id,
      PaymentStatus.APPROVED,
      {
        paidAt: webhookEvent.timestamp,
      }
    );

    // 7. Ejecutar acciones según contexto
    if (payment.context === PaymentContext.WALLET_RECHARGE) {
      // RECARGA DE WALLET
      console.log('[Stripe Webhook] Processing wallet recharge');
      
      const { data: balanceRow } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('user_id', payment.user_id)
        .single();

      const balanceBefore = parseFloat(balanceRow?.balance || '0');
      const balanceAfter = parseFloat((balanceBefore + payment.amount).toFixed(2));

      // Actualizar saldo
      await supabase.from('user_balances').upsert({
        user_id: payment.user_id,
        balance: balanceAfter,
        currency: 'USD',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      // Registrar transacción
      await supabase.from('balance_transactions').insert({
        user_id: payment.user_id,
        amount: payment.amount,
        type: 'recharge',
        description: payment.description || `Recarga vía Stripe - $${payment.amount}`,
        payment_gateway: 'stripe',
        payment_id: payment.id,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        stripe_session_id: webhookEvent.paymentId,
      });

      console.log('[Stripe Webhook] ✅ Wallet recharged:', {
        userId: payment.user_id,
        amount: payment.amount,
        newBalance: balanceAfter,
      });
    }

    console.log('[Stripe Webhook] ✅ Webhook processed successfully');

    return NextResponse.json({
      received: true,
      status: 'processed',
      paymentId: payment.id,
    });

  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', detail: error.message },
      { status: 500 }
    );
  }
}
