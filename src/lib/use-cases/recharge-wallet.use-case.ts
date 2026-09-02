/**
 * RechargeWalletUseCase
 * 
 * Coordina el proceso completo de recarga de wallet:
 * 1. Crea el pago con el provider seleccionado
 * 2. Registra en base de datos
 * 3. Retorna métodos de pago al usuario
 * 4. (El webhook manejará la acreditación cuando el pago sea confirmado)
 */

import { BaseUseCase, UseCaseError } from './base-use-case';
import { initializePaymentGateway, PaymentProvider, PaymentContext } from '@/lib/payments';
import { getPaymentRepository } from '@/lib/database/payment-repository';

export interface RechargeWalletRequest {
  userId: string;
  provider: PaymentProvider;
  amount: number;
  description?: string;
  expirationMinutes?: number;
}

export interface RechargeWalletResponse {
  success: boolean;
  payment: {
    id: string;
    paymentId: string;
    provider: string;
    amount: number;
    status: string;
    
    // Métodos de pago
    qrCode?: string;
    deeplink?: string;
    numericCode?: string;
    checkoutUrl?: string;
    
    expiresAt?: string;
    createdAt: string;
  };
}

export class RechargeWalletUseCase extends BaseUseCase<
  RechargeWalletRequest,
  RechargeWalletResponse
> {
  protected readonly name = 'RechargeWalletUseCase';

  protected async validate(request: RechargeWalletRequest): Promise<void> {
    if (!request.userId) {
      throw new UseCaseError('userId es requerido', 'MISSING_USER_ID', 400);
    }

    if (!request.provider) {
      throw new UseCaseError('provider es requerido', 'MISSING_PROVIDER', 400);
    }

    if (!Object.values(PaymentProvider).includes(request.provider)) {
      throw new UseCaseError(
        `Provider inválido: ${request.provider}`,
        'INVALID_PROVIDER',
        400
      );
    }

    if (!request.amount || request.amount <= 0) {
      throw new UseCaseError(
        'amount debe ser mayor a 0',
        'INVALID_AMOUNT',
        400
      );
    }

    // Validar montos mínimos/máximos
    if (request.amount < 1) {
      throw new UseCaseError(
        'El monto mínimo de recarga es $1.00',
        'AMOUNT_TOO_LOW',
        400
      );
    }

    if (request.amount > 1000) {
      throw new UseCaseError(
        'El monto máximo de recarga es $1000.00',
        'AMOUNT_TOO_HIGH',
        400
      );
    }
  }

  async execute(request: RechargeWalletRequest): Promise<RechargeWalletResponse> {
    const { userId, provider, amount, description, expirationMinutes } = request;

    // 1. Preparar metadata
    const metadata = {
      userId,
      context: PaymentContext.WALLET_RECHARGE,
      description: description || `Recarga de wallet $${amount.toFixed(2)}`,
    };

    this.log('Creating payment', { provider, amount, userId });

    // 2. Crear pago usando el gateway
    const gateway = initializePaymentGateway();
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
      'https://ev-charging-admin-production.up.railway.app';
    
    const paymentResponse = await gateway.createPayment({
      provider,
      amount,
      metadata,
      expirationMinutes,
      callbackUrl: `${appUrl}/wallet?recharge=pending`,
    });

    if (!paymentResponse.success) {
      throw new UseCaseError(
        paymentResponse.error || 'Error al crear pago',
        'PAYMENT_CREATION_FAILED',
        500
      );
    }

    this.log('Payment created with provider', { paymentId: paymentResponse.paymentId });

    // 3. Guardar en base de datos
    const repo = getPaymentRepository();
    
    const dbPayment = await repo.createPayment({
      paymentId: paymentResponse.paymentId,
      internalReference: paymentResponse.metadata?.internalReference || paymentResponse.paymentId,
      userId,
      provider,
      context: PaymentContext.WALLET_RECHARGE,
      amount,
      description: metadata.description,
      metadata: paymentResponse.metadata,
      qrCode: paymentResponse.qrCode,
      deeplink: paymentResponse.deeplink,
      numericCode: paymentResponse.numericCode,
      checkoutUrl: paymentResponse.checkoutUrl,
      expiresAt: paymentResponse.expiresAt,
    });

    this.log('Payment saved to database', { id: dbPayment.id });

    // 4. Si es Deuna, crear registro específico
    if (provider === PaymentProvider.DEUNA) {
      await repo.createDeunaTransaction({
        paymentId: dbPayment.id,
        transactionId: paymentResponse.paymentId,
        internalReference: paymentResponse.metadata?.internalReference || paymentResponse.paymentId,
        pointOfSale: process.env.DEUNA_POINT_OF_SALE,
      });

      this.log('Deuna transaction record created');
    }

    this.logSuccess('Wallet recharge initiated', {
      paymentId: dbPayment.id,
      amount,
      provider,
    });

    // 5. Retornar respuesta
    return {
      success: true,
      payment: {
        id: dbPayment.id,
        paymentId: paymentResponse.paymentId,
        provider,
        amount,
        status: paymentResponse.status,
        
        qrCode: paymentResponse.qrCode,
        deeplink: paymentResponse.deeplink,
        numericCode: paymentResponse.numericCode,
        checkoutUrl: paymentResponse.checkoutUrl,
        
        expiresAt: paymentResponse.expiresAt,
        createdAt: dbPayment.created_at,
      },
    };
  }
}

// Export singleton instance
export const rechargeWalletUseCase = new RechargeWalletUseCase();
