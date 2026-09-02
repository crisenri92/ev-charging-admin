/**
 * POST /api/payments/webhooks/deuna
 * Procesa webhooks de Deuna cuando un pago es confirmado
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializePaymentGateway, PaymentProvider, PaymentStatus } from '@/lib/payments';
import { applyApprovedPayment } from '@/lib/payments/apply-approved-payment';
import { getPaymentRepository } from '@/lib/database/payment-repository';

export async function POST(req: NextRequest) {
  try {
    // 1. Obtener headers y body
    const headers = Object.fromEntries(req.headers);
    const body = await req.json();


    // 2. Procesar webhook usando el gateway
    const gateway = initializePaymentGateway();
    
    let webhookEvent;
    try {
      webhookEvent = await gateway.handleWebhook(
        PaymentProvider.DEUNA,
        headers,
        body
      );
    } catch (error: any) {
      console.error('[Deuna Webhook] Invalid webhook:', error);
      return NextResponse.json(
        { error: 'Invalid webhook', detail: error.message },
        { status: 400 }
      );
    }


    // 3. Buscar el pago en nuestra BD
    const repo = getPaymentRepository();
    
    // Intentar buscar por transaction_id de Deuna
    const deunaTransaction = await repo.findDeunaByTransactionId(webhookEvent.paymentId);
    
    if (!deunaTransaction) {
      console.error('[Deuna Webhook] Payment not found:', webhookEvent.paymentId);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    const payment = await repo.findByPaymentId(webhookEvent.paymentId);
    
    if (!payment) {
      console.error('[Deuna Webhook] Payment record not found');
      return NextResponse.json(
        { error: 'Payment record not found' },
        { status: 404 }
      );
    }

    // 4. Verificar si ya fue procesado (evitar duplicados)
    if (payment.status === 'approved') {
      return NextResponse.json({
        received: true,
        message: 'Payment already processed',
      });
    }

    // 5. Solo procesar si está aprobado
    if (webhookEvent.status !== PaymentStatus.APPROVED) {
      
      // Actualizar estado si cambió
      await repo.updatePaymentStatus(payment.id, webhookEvent.status);
      
      return NextResponse.json({ received: true });
    }

    const applied = await applyApprovedPayment(payment, {
      transferNumber: webhookEvent.rawPayload.transferNumber,
      customerName: webhookEvent.rawPayload.customerName,
      customerIdentification: webhookEvent.rawPayload.customerIdentification,
      paidAt: webhookEvent.timestamp,
      providerPayload: webhookEvent.rawPayload,
    });

    if (applied.alreadyProcessed) {
      return NextResponse.json({
        received: true,
        message: 'Payment already processed',
      });
    }


    return NextResponse.json({
      received: true,
      status: 'processed',
      paymentId: payment.id,
    });

  } catch (error: any) {
    console.error('[Deuna Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', detail: error.message },
      { status: 500 }
    );
  }
}
