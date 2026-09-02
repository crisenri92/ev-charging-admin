/**
 * DirectPaymentUseCase
 * 
 * Coordina el proceso de pago directo para carga:
 * 1. Valida que el cargador esté disponible
 * 2. Calcula precio estimado
 * 3. Crea el pago
 * 4. Si es Wallet: autoriza inmediatamente
 * 5. Si es Deuna: genera QR y espera webhook
 */

import { BaseUseCase, UseCaseError } from './base-use-case';
import { initializePaymentGateway, PaymentProvider, PaymentContext } from '@/lib/payments';
import { getPaymentRepository } from '@/lib/database/payment-repository';
import { createClient } from '@supabase/supabase-js';
import { getCurrentPrice } from '@/lib/pricing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DirectPaymentRequest {
  userId: string;
  chargerId: string;
  provider: PaymentProvider;
  estimatedKwh?: number;
}

export interface DirectPaymentResponse {
  success: boolean;
  authorized: boolean;
  waitingForPayment?: boolean;
  
  payment: {
    id: string;
    paymentId: string;
    provider: string;
    amount: number;
    status: string;
    
    // Métodos de pago (si no está autorizado inmediatamente)
    qrCode?: string;
    deeplink?: string;
    numericCode?: string;
    checkoutUrl?: string;
    
    expiresAt?: string;
  };
  
  charger: {
    id: string;
    name: string;
  };
  
  pricing: {
    estimatedKwh: number;
    pricePerKwh: number;
    estimatedAmount: number;
    pricingRule: string;
  };
}

export class DirectPaymentUseCase extends BaseUseCase<
  DirectPaymentRequest,
  DirectPaymentResponse
> {
  protected readonly name = 'DirectPaymentUseCase';

  protected async validate(request: DirectPaymentRequest): Promise<void> {
    if (!request.userId) {
      throw new UseCaseError('userId es requerido', 'MISSING_USER_ID', 400);
    }

    if (!request.chargerId) {
      throw new UseCaseError('chargerId es requerido', 'MISSING_CHARGER_ID', 400);
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

    // Wallet no soporta pago directo (usa saldo existente)
    // Pero sí puede usarse para validar saldo
  }

  async execute(request: DirectPaymentRequest): Promise<DirectPaymentResponse> {
    const { userId, chargerId, provider, estimatedKwh = 10 } = request;

    // 1. Validar que el cargador existe y está disponible
    this.log('Validating charger', { chargerId });
    
    const { data: charger, error: chargerError } = await supabase
      .from('chargers')
      .select('id, name, status')
      .eq('id', chargerId)
      .single();

    if (chargerError || !charger) {
      throw new UseCaseError(
        'Cargador no encontrado',
        'CHARGER_NOT_FOUND',
        404
      );
    }

    if (charger.status !== 'Available') {
      throw new UseCaseError(
        `Cargador no disponible (status: ${charger.status})`,
        'CHARGER_NOT_AVAILABLE',
        400
      );
    }

    // 2. Calcular precio estimado
    this.log('Calculating estimated price', { estimatedKwh });
    
    const { price: pricePerKwh, ruleName } = await getCurrentPrice(
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const estimatedAmount = parseFloat((estimatedKwh * pricePerKwh).toFixed(2));

    this.log('Price calculated', {
      pricePerKwh,
      estimatedKwh,
      estimatedAmount,
      ruleName,
    });

    // 3. Preparar metadata
    const metadata: any = {
      userId,
      context: PaymentContext.DIRECT_CHARGE,
      chargerId,
      chargerName: charger.name,
      estimatedKwh,
      pricePerKwh,
      pricingRule: ruleName,
      description: `Carga en ${charger.name} - ~${estimatedKwh} kWh`,
    };

    // 4. Crear pago
    this.log('Creating payment', { provider, estimatedAmount });
    
    const gateway = initializePaymentGateway();
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
      'https://ev-charging-admin-production.up.railway.app';

    const paymentResponse = await gateway.createPayment({
      provider,
      amount: estimatedAmount,
      metadata,
      expirationMinutes: provider === PaymentProvider.WALLET ? undefined : 10,
      callbackUrl: `${appUrl}/mobile/charging/${chargerId}?payment=pending`,
    });

    if (!paymentResponse.success) {
      throw new UseCaseError(
        paymentResponse.error || 'Error al crear pago',
        'PAYMENT_CREATION_FAILED',
        500
      );
    }

    this.log('Payment created', { paymentId: paymentResponse.paymentId });

    // 5. Guardar en BD
    const repo = getPaymentRepository();
    
    const dbPayment = await repo.createPayment({
      paymentId: paymentResponse.paymentId,
      internalReference: paymentResponse.metadata?.internalReference || paymentResponse.paymentId,
      userId,
      provider,
      context: PaymentContext.DIRECT_CHARGE,
      amount: estimatedAmount,
      description: metadata.description,
      metadata: paymentResponse.metadata,
      qrCode: paymentResponse.qrCode,
      deeplink: paymentResponse.deeplink,
      numericCode: paymentResponse.numericCode,
      checkoutUrl: paymentResponse.checkoutUrl,
      expiresAt: paymentResponse.expiresAt,
    });

    this.log('Payment saved to database', { id: dbPayment.id });

    // 6. Si es Deuna, crear registro específico
    if (provider === PaymentProvider.DEUNA) {
      await repo.createDeunaTransaction({
        paymentId: dbPayment.id,
        transactionId: paymentResponse.paymentId,
        internalReference: paymentResponse.metadata?.internalReference || paymentResponse.paymentId,
        pointOfSale: process.env.DEUNA_POINT_OF_SALE,
      });

      this.log('Deuna transaction record created');
    }

    // 7. Si es Wallet y está aprobado, crear autorización inmediata
    if (provider === PaymentProvider.WALLET && paymentResponse.status === 'approved') {
      await repo.createChargingAuthorization(
        userId,
        chargerId,
        dbPayment.id,
        estimatedAmount,
        'wallet',
        30 // 30 minutos de validez
      );

      this.logSuccess('Wallet payment approved, authorization created', {
        paymentId: dbPayment.id,
        chargerId,
      });

      return {
        success: true,
        authorized: true,
        payment: {
          id: dbPayment.id,
          paymentId: paymentResponse.paymentId,
          provider,
          amount: estimatedAmount,
          status: 'approved',
        },
        charger: {
          id: charger.id,
          name: charger.name,
        },
        pricing: {
          estimatedKwh,
          pricePerKwh,
          estimatedAmount,
          pricingRule: ruleName,
        },
      };
    }

    // 8. Para Deuna, retornar métodos de pago
    this.logSuccess('Direct payment initiated, waiting for confirmation', {
      paymentId: dbPayment.id,
      provider,
    });

    return {
      success: true,
      authorized: false,
      waitingForPayment: true,
      payment: {
        id: dbPayment.id,
        paymentId: paymentResponse.paymentId,
        provider,
        amount: estimatedAmount,
        status: paymentResponse.status,
        
        qrCode: paymentResponse.qrCode,
        deeplink: paymentResponse.deeplink,
        numericCode: paymentResponse.numericCode,
        checkoutUrl: paymentResponse.checkoutUrl,
        
        expiresAt: paymentResponse.expiresAt,
      },
      charger: {
        id: charger.id,
        name: charger.name,
      },
      pricing: {
        estimatedKwh,
        pricePerKwh,
        estimatedAmount,
        pricingRule: ruleName,
      },
    };
  }
}

// Export singleton instance
export const directPaymentUseCase = new DirectPaymentUseCase();
