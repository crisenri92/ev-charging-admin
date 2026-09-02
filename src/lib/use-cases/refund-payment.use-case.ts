/**
 * RefundPaymentUseCase
 * 
 * Coordina el proceso de devolución de un pago:
 * 1. Valida que el pago existe y puede ser devuelto
 * 2. Procesa refund en el provider (Deuna/Stripe)
 * 3. Si era recarga: resta del saldo del usuario
 * 4. Si era pago directo: cancela autorización
 * 5. Registra la devolución en balance_transactions
 */

import { BaseUseCase, UseCaseError } from './base-use-case';
import { initializePaymentGateway, PaymentProvider, PaymentContext } from '@/lib/payments';
import { getPaymentRepository } from '@/lib/database/payment-repository';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RefundPaymentRequest {
  userId: string;
  paymentId: string; // ID interno (UUID)
  reason?: string;
  amount?: number; // Opcional: para refund parcial
}

export interface RefundPaymentResponse {
  success: boolean;
  refund: {
    paymentId: string;
    refundId?: string;
    amount: number;
    status: string;
    reason?: string;
  };
  balanceRestored?: number;
  authorizationCancelled?: boolean;
}

export class RefundPaymentUseCase extends BaseUseCase<
  RefundPaymentRequest,
  RefundPaymentResponse
> {
  protected readonly name = 'RefundPaymentUseCase';

  protected async validate(request: RefundPaymentRequest): Promise<void> {
    if (!request.userId) {
      throw new UseCaseError('userId es requerido', 'MISSING_USER_ID', 400);
    }

    if (!request.paymentId) {
      throw new UseCaseError('paymentId es requerido', 'MISSING_PAYMENT_ID', 400);
    }

    if (request.amount !== undefined && request.amount <= 0) {
      throw new UseCaseError(
        'amount debe ser mayor a 0',
        'INVALID_AMOUNT',
        400
      );
    }
  }

  async execute(request: RefundPaymentRequest): Promise<RefundPaymentResponse> {
    const { userId, paymentId, reason, amount } = request;

    // 1. Buscar el pago en BD
    this.log('Finding payment', { paymentId });
    
    const repo = getPaymentRepository();
    const payment = await repo.findById(paymentId);

    if (!payment) {
      throw new UseCaseError(
        'Pago no encontrado',
        'PAYMENT_NOT_FOUND',
        404
      );
    }

    // 2. Verificar ownership
    if (payment.user_id !== userId) {
      throw new UseCaseError(
        'No autorizado para devolver este pago',
        'UNAUTHORIZED',
        403
      );
    }

    // 3. Verificar que el pago está aprobado
    if (payment.status !== 'approved') {
      throw new UseCaseError(
        `No se puede devolver un pago con status: ${payment.status}`,
        'INVALID_PAYMENT_STATUS',
        400
      );
    }

    // 4. Verificar que no haya pasado mucho tiempo (ej: 30 días)
    const paymentDate = new Date(payment.paid_at || payment.created_at);
    const daysSincePayment = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSincePayment > 30) {
      throw new UseCaseError(
        'No se pueden devolver pagos de más de 30 días',
        'PAYMENT_TOO_OLD',
        400
      );
    }

    const refundAmount = amount || parseFloat(payment.amount.toString());

    if (refundAmount > parseFloat(payment.amount.toString())) {
      throw new UseCaseError(
        'El monto de devolución no puede ser mayor al monto del pago',
        'REFUND_AMOUNT_TOO_HIGH',
        400
      );
    }

    this.log('Payment found, processing refund', {
      paymentId,
      originalAmount: payment.amount,
      refundAmount,
      provider: payment.provider,
    });

    // 5. Procesar refund en el provider
    let refundId: string | undefined;
    
    if (payment.provider !== PaymentProvider.WALLET) {
      this.log('Processing refund with provider', { provider: payment.provider });
      
      const gateway = initializePaymentGateway();
      
      try {
        const refundResponse = await gateway.cancelPayment(
          payment.provider as PaymentProvider,
          payment.payment_id,
          refundAmount
        );

        if (!refundResponse.success) {
          throw new UseCaseError(
            refundResponse.error || 'Error al procesar refund en provider',
            'PROVIDER_REFUND_FAILED',
            500
          );
        }

        refundId = refundResponse.refundId;
        
        this.log('Refund processed with provider', { refundId });
      } catch (error: any) {
        this.logError('Provider refund failed', error);
        throw new UseCaseError(
          'Error al procesar refund en el proveedor de pago',
          'PROVIDER_REFUND_ERROR',
          500,
          { originalError: error.message }
        );
      }
    }

    // 6. Actualizar según el contexto
    let balanceRestored: number | undefined;
    let authorizationCancelled = false;

    if (payment.context === PaymentContext.WALLET_RECHARGE) {
      // RECARGA: Restar del saldo del usuario
      this.log('Refunding wallet recharge', { userId, amount: refundAmount });
      
      const { data: balanceRow } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('user_id', userId)
        .single();

      const currentBalance = parseFloat(balanceRow?.balance || '0');
      
      if (currentBalance < refundAmount) {
        throw new UseCaseError(
          'Saldo insuficiente para procesar la devolución',
          'INSUFFICIENT_BALANCE',
          400
        );
      }

      const newBalance = parseFloat((currentBalance - refundAmount).toFixed(2));

      // Actualizar saldo
      await supabase.from('user_balances').upsert({
        user_id: userId,
        balance: newBalance,
        currency: 'USD',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      // Registrar transacción de devolución
      await supabase.from('balance_transactions').insert({
        user_id: userId,
        amount: -refundAmount, // Negativo para devolución
        type: 'refund',
        description: `Devolución: ${reason || 'Sin motivo especificado'}`,
        payment_gateway: payment.provider,
        payment_id: payment.id,
        balance_before: currentBalance,
        balance_after: newBalance,
        gateway_metadata: { refundId, originalPaymentId: payment.payment_id },
      });

      balanceRestored = newBalance;

      this.log('Balance updated', { newBalance, refundAmount });

    } else if (payment.context === PaymentContext.DIRECT_CHARGE) {
      // PAGO DIRECTO: Cancelar autorización
      this.log('Cancelling charging authorization', { paymentId: payment.id });
      
      const authorization = await repo.findAuthorizationByPaymentId(payment.id);
      
      if (authorization && authorization.status !== 'used') {
        await repo.cancelAuthorization(authorization.id, reason || 'Refund requested');
        authorizationCancelled = true;
        
        this.log('Authorization cancelled', { authorizationId: authorization.id });
      }
    }

    // 7. Actualizar estado del pago
    await repo.updatePaymentStatus(
      payment.id,
      'refunded',
      {
        refundId,
        refundReason: reason,
        refundedAt: new Date().toISOString(),
        refundAmount,
      }
    );

    this.logSuccess('Refund completed', {
      paymentId,
      refundAmount,
      refundId,
      balanceRestored,
      authorizationCancelled,
    });

    // 8. Retornar respuesta
    return {
      success: true,
      refund: {
        paymentId: payment.id,
        refundId,
        amount: refundAmount,
        status: 'refunded',
        reason,
      },
      balanceRestored,
      authorizationCancelled,
    };
  }
}

// Export singleton instance
export const refundPaymentUseCase = new RefundPaymentUseCase();
