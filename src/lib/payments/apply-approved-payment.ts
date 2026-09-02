/**
 * Aplica los efectos de un pago aprobado (wallet o autorización de carga).
 * Lo usan el webhook y el polling para no duplicar lógica.
 */

import { createClient } from '@supabase/supabase-js';
import { PaymentContext, PaymentStatus } from './core/payment-types';
import { getPaymentRepository, PaymentRecord } from '@/lib/database/payment-repository';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ApplyApprovedExtras {
  transferNumber?: string;
  customerName?: string;
  customerIdentification?: string;
  paidAt?: Date;
  providerPayload?: Record<string, any>;
}

export interface ApplyApprovedResult {
  alreadyProcessed: boolean;
  newBalance?: number;
  authorizationCreated?: boolean;
}

export async function applyApprovedPayment(
  payment: PaymentRecord,
  extras: ApplyApprovedExtras = {}
): Promise<ApplyApprovedResult> {
  const repo = getPaymentRepository();

  if (payment.status === PaymentStatus.APPROVED) {
    return { alreadyProcessed: true };
  }

  if (payment.provider === 'deuna' && extras.transferNumber) {
    await repo.updateDeunaTransaction(payment.payment_id, {
      transferNumber: extras.transferNumber,
      webhookData: extras.providerPayload,
    });
  }

  await repo.updatePaymentStatus(payment.id, PaymentStatus.APPROVED, {
    customerName: extras.customerName,
    customerIdentification: extras.customerIdentification,
    paidAt: extras.paidAt,
  });

  if (payment.context === PaymentContext.WALLET_RECHARGE) {
    const { data: balanceRow } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_id', payment.user_id)
      .single();

    const balanceBefore = parseFloat(balanceRow?.balance || '0');
    const amount = parseFloat(payment.amount.toString());
    const balanceAfter = parseFloat((balanceBefore + amount).toFixed(2));

    await supabase.from('user_balances').upsert(
      {
        user_id: payment.user_id,
        balance: balanceAfter,
        currency: 'USD',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    await supabase.from('balance_transactions').insert({
      user_id: payment.user_id,
      amount,
      type: 'recharge',
      description: payment.description || `Recarga vía ${payment.provider} - $${amount}`,
      payment_gateway: payment.provider,
      payment_id: payment.id,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      gateway_metadata: extras.providerPayload || {},
      deuna_transaction_id: payment.payment_id,
      deuna_transfer_number: extras.transferNumber,
    });

    console.log('[ApplyApprovedPayment] Wallet recharged', {
      userId: payment.user_id,
      amount,
      newBalance: balanceAfter,
    });

    return { alreadyProcessed: false, newBalance: balanceAfter };
  }

  if (payment.context === PaymentContext.DIRECT_CHARGE) {
    const chargerId = (payment.metadata as any)?.chargerId;

    if (!chargerId) {
      throw new Error('Missing chargerId in payment metadata');
    }

    await repo.createChargingAuthorization(
      payment.user_id,
      chargerId,
      payment.id,
      parseFloat(payment.amount.toString()),
      payment.provider,
      30
    );

    console.log('[ApplyApprovedPayment] Charging authorized', {
      userId: payment.user_id,
      chargerId,
      amount: payment.amount,
    });

    return { alreadyProcessed: false, authorizationCreated: true };
  }

  return { alreadyProcessed: false };
}
