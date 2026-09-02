/**
 * CheckPaymentStatusUseCase
 * 
 * Coordina la consulta del estado de un pago:
 * 1. Busca el pago en BD
 * 2. Si está pendiente y no ha expirado, consulta al provider
 * 3. Actualiza el estado en BD si cambió
 * 4. Retorna el estado actualizado
 */

import { BaseUseCase, UseCaseError } from './base-use-case';
import { initializePaymentGateway, PaymentProvider } from '@/lib/payments';
import { getPaymentRepository } from '@/lib/database/payment-repository';

export interface CheckPaymentStatusRequest {
  userId: string;
  paymentId: string; // payment_id o internal_reference
}

export interface CheckPaymentStatusResponse {
  paymentId: string;
  status: string;
  amount: number;
  provider: string;
  context: string;
  paidAt?: string;
  expiresAt?: string;
  customerInfo?: {
    name?: string;
    identification?: string;
  };
  metadata?: any;
}

export class CheckPaymentStatusUseCase extends BaseUseCase<
  CheckPaymentStatusRequest,
  CheckPaymentStatusResponse
> {
  protected readonly name = 'CheckPaymentStatusUseCase';

  protected async validate(request: CheckPaymentStatusRequest): Promise<void> {
    if (!request.userId) {
      throw new UseCaseError('userId es requerido', 'MISSING_USER_ID', 400);
    }

    if (!request.paymentId) {
      throw new UseCaseError('paymentId es requerido', 'MISSING_PAYMENT_ID', 400);
    }
  }

  async execute(request: CheckPaymentStatusRequest): Promise<CheckPaymentStatusResponse> {
    const { userId, paymentId } = request;

    // 1. Buscar pago en BD
    this.log('Finding payment', { paymentId });
    
    const repo = getPaymentRepository();
    const payment = await repo.findByPaymentId(paymentId);

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
        'No autorizado para consultar este pago',
        'UNAUTHORIZED',
        403
      );
    }

    this.log('Payment found', {
      id: payment.id,
      status: payment.status,
      provider: payment.provider,
    });

    // 3. Si ya está aprobado, retornar inmediatamente
    if (payment.status === 'approved') {
      this.log('Payment already approved');
      
      return {
        paymentId: payment.payment_id,
        status: payment.status,
        amount: parseFloat(payment.amount.toString()),
        provider: payment.provider,
        context: payment.context,
        paidAt: payment.paid_at,
        customerInfo: {
          name: payment.customer_name,
          identification: payment.customer_identification,
        },
        metadata: payment.metadata,
      };
    }

    // 4. Si está pendiente y no ha expirado, consultar al provider
    if (payment.status === 'pending' && payment.expires_at) {
      const now = new Date();
      const expiresAt = new Date(payment.expires_at);

      if (expiresAt > now) {
        // Todavía válido, consultar en el provider
        this.log('Payment still pending, checking with provider');
        
        try {
          const gateway = initializePaymentGateway();
          
          // Para Deuna usamos internal_reference
          const reference = payment.internal_reference || payment.payment_id;
          
          const providerStatus = await gateway.getPaymentStatus(
            payment.provider as PaymentProvider,
            reference
          );

          this.log('Provider status received', {
            status: providerStatus.status,
            amount: providerStatus.amount,
          });

          // Si el status cambió, actualizar en BD
          if (providerStatus.status !== payment.status) {
            this.log('Status changed', {
              oldStatus: payment.status,
              newStatus: providerStatus.status,
            });

            if (providerStatus.status === 'approved') {
              const { applyApprovedPayment } = await import(
                '@/lib/payments/apply-approved-payment'
              );
              await applyApprovedPayment(payment, {
                transferNumber: providerStatus.metadata?.transferNumber,
                customerName: providerStatus.customerInfo?.name,
                customerIdentification: providerStatus.customerInfo?.identification,
                paidAt: providerStatus.paidAt,
                providerPayload: providerStatus.metadata,
              });
            } else {
              await repo.updatePaymentStatus(
                payment.id,
                providerStatus.status,
                {
                  customerName: providerStatus.customerInfo?.name,
                  customerIdentification: providerStatus.customerInfo?.identification,
                  paidAt: providerStatus.paidAt,
                }
              );
            }
          }

          return {
            paymentId: payment.payment_id,
            status: providerStatus.status,
            amount: providerStatus.amount,
            provider: payment.provider,
            context: payment.context,
            paidAt: providerStatus.paidAt,
            expiresAt: payment.expires_at,
            customerInfo: providerStatus.customerInfo,
            metadata: providerStatus.metadata,
          };

        } catch (error: any) {
          this.logError('Error checking provider status', error);
          // Si falla la consulta al provider, retornar el estado local
        }
      } else {
        // Ya expiró, marcar como expirado
        this.log('Payment expired, updating status');
        
        if (payment.status === 'pending') {
          await repo.updatePaymentStatus(payment.id, 'expired');
        }

        return {
          paymentId: payment.payment_id,
          status: 'expired',
          amount: parseFloat(payment.amount.toString()),
          provider: payment.provider,
          context: payment.context,
          expiresAt: payment.expires_at,
          metadata: payment.metadata,
        };
      }
    }

    // 5. Retornar estado actual de BD
    this.log('Returning current status from database', { status: payment.status });
    
    return {
      paymentId: payment.payment_id,
      status: payment.status,
      amount: parseFloat(payment.amount.toString()),
      provider: payment.provider,
      context: payment.context,
      paidAt: payment.paid_at,
      expiresAt: payment.expires_at,
      customerInfo: {
        name: payment.customer_name,
        identification: payment.customer_identification,
      },
      metadata: payment.metadata,
    };
  }
}

// Export singleton instance
export const checkPaymentStatusUseCase = new CheckPaymentStatusUseCase();
