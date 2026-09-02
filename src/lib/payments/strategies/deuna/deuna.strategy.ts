/**
 * Deuna Payment Strategy
 * Implementación de la estrategia de pago para Deuna
 */

import { IPaymentStrategy } from '../../core/payment-strategy.interface';
import {
  PaymentProvider,
  PaymentContext,
  PaymentStatus,
  CreatePaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  WebhookEvent,
} from '../../core/payment-types';
import { DeunaClient, DeunaConfig } from './deuna-client';

/**
 * Estrategia de pago usando Deuna
 * Soporta tanto recarga de wallet como pago directo por carga
 */
export class DeunaPaymentStrategy implements IPaymentStrategy {
  readonly provider = PaymentProvider.DEUNA;
  readonly name = 'Deuna';
  readonly supportedContexts = [
    PaymentContext.WALLET_RECHARGE,
    PaymentContext.DIRECT_CHARGE,
  ];

  private client: DeunaClient | null = null;

  /**
   * Inicializa la estrategia con configuración de Deuna
   */
  initialize(config?: Record<string, any>): void {
    const deunaConfig: DeunaConfig = {
      apiKey: config?.apiKey || process.env.DEUNA_API_KEY || '',
      apiSecret: config?.apiSecret || process.env.DEUNA_API_SECRET || '',
      pointOfSale: config?.pointOfSale || process.env.DEUNA_PUNTO_DE_VENTA || process.env.DEUNA_POINT_OF_SALE || '',
      baseUrl:
        config?.baseUrl ||
        process.env.DEUNA_BASE_URL ||
        'https://apis-merchant.pdn.deunalab.com',
    };

    this.client = new DeunaClient(deunaConfig);

    if (this.isConfigured()) {
    } else {
      console.warn('[DeunaStrategy] ⚠️  Missing configuration. Check environment variables.');
    }
  }

  /**
   * Verifica si está correctamente configurado
   */
  isConfigured(): boolean {
    return this.client !== null && this.client.isConfigured();
  }

  /**
   * Verifica si soporta un contexto específico
   */
  supportsContext(context: PaymentContext): boolean {
    return this.supportedContexts.includes(context);
  }

  /**
   * Crea un pago en Deuna
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    if (!this.client) {
      throw new Error('Deuna strategy not initialized');
    }

    try {
      // Generar referencia interna única
      const internalRef = this.generateInternalReference(request.metadata);

      // Obtener configuración según el contexto
      const config = this.getConfigForContext(request);

      // Deuna espera el monto en USD, no en centavos (a diferencia de Stripe).
      const deunaResponse = await this.client.createPayment({
        amount: request.amount,
        internalReference: internalRef,
        detail: request.metadata.description,
        qrType: 'dynamic',
        format: config.format,
        expiredTime: request.expirationMinutes || config.defaultExpiration,
        callbackUrl: request.callbackUrl,
      });

      // Transformar respuesta a nuestro formato
      return {
        success: true,
        paymentId: deunaResponse.transactionId,
        provider: this.provider,
        context: request.metadata.context,
        status: PaymentStatus.PENDING,
        amount: request.amount,
        qrCode: deunaResponse.qr,
        deeplink: deunaResponse.deeplink,
        numericCode: deunaResponse.numericCode,
        expiresAt: new Date(
          Date.now() + (request.expirationMinutes || config.defaultExpiration) * 60000
        ),
        metadata: {
          internalReference: internalRef,
          ...request.metadata,
        },
      };
    } catch (error: any) {
      console.error('[DeunaStrategy] Create payment error:', error);
      
      return {
        success: false,
        paymentId: '',
        provider: this.provider,
        context: request.metadata.context,
        status: PaymentStatus.FAILED,
        amount: request.amount,
        error: error.message || 'Error al crear pago con Deuna',
      };
    }
  }

  /**
   * Consulta el estado de un pago
   */
  async getPaymentStatus(internalReference: string): Promise<PaymentStatusResponse> {
    if (!this.client) {
      throw new Error('Deuna strategy not initialized');
    }

    try {
      const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        internalReference
      );
      const status = await this.client.getPaymentStatus(
        internalReference,
        looksLikeUuid ? '0' : '1'
      );

      return {
        paymentId: status.transactionId,
        provider: this.provider,
        status: this.mapDeunaStatus(status.status),
        amount: status.amount,
        paidAt: status.date ? new Date(status.date) : undefined,
        customerInfo: {
          name: status.ordererName,
          identification: status.ordererIdentification,
        },
        metadata: {
          transferNumber: status.transferNumber,
          internalReference: status.internalTransactionReference,
          branchId: status.branchId,
          posId: status.posId,
        },
      };
    } catch (error: any) {
      console.error('[DeunaStrategy] Get payment status error:', error);
      throw error;
    }
  }

  /**
   * Procesa un webhook de Deuna
   */
  async processWebhook(
    headers: Record<string, string>,
    body: any
  ): Promise<WebhookEvent> {
    const {
      status,
      idTransaction,
      internalTransactionReference,
      amount,
      transferNumber,
      customerFullName,
      customerIdentification,
      date,
    } = body;

    return {
      provider: this.provider,
      paymentId: idTransaction,
      status: this.mapDeunaStatus(status),
      amount: parseFloat(amount),
      timestamp: date ? new Date(date) : new Date(),
      rawPayload: {
        internalReference: internalTransactionReference,
        transferNumber,
        customerName: customerFullName,
        customerIdentification,
      },
    };
  }

  /**
   * Valida la autenticidad de un webhook de Deuna
   * Nota: Deuna no provee firma HMAC en su documentación actual
   */
  validateWebhook(headers: Record<string, string>, body: any): boolean {
    const hasRequiredFields = !!(
      body.status &&
      body.idTransaction &&
      body.internalTransactionReference &&
      body.amount !== undefined
    );

    if (!hasRequiredFields) {
      console.warn('[DeunaStrategy] Webhook validation failed: missing required fields');
      return false;
    }

    return true;
  }

  /**
   * Cancela/reversa un pago
   */
  async cancelPayment(internalReference: string, reason?: string): Promise<boolean> {
    if (!this.client) {
      console.warn('[DeunaStrategy] Cannot cancel payment: strategy not initialized');
      return false;
    }

    const result = await this.client.refundPayment(internalReference, '1');
    
    if (!result) {
      console.error(`[DeunaStrategy] ❌ Failed to cancel payment: ${internalReference}`);
    }

    return result;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private generateInternalReference(metadata: any): string {
    const prefix = metadata.context === PaymentContext.WALLET_RECHARGE ? 'RCH' : 'CHG';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`.substring(0, 20);
  }

  private getConfigForContext(request: CreatePaymentRequest) {
    if (request.metadata.context === PaymentContext.WALLET_RECHARGE) {
      return {
        format: '2' as const,
        defaultExpiration: 30,
      };
    } else {
      return {
        format: '5' as const,
        defaultExpiration: 10,
      };
    }
  }

  private mapDeunaStatus(deunaStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      SUCCESS: PaymentStatus.APPROVED,
      APPROVED: PaymentStatus.APPROVED,
      PENDING: PaymentStatus.PENDING,
      '1': PaymentStatus.PENDING,
      REVERSED: PaymentStatus.REVERSED,
      REVERSED_FAILED: PaymentStatus.FAILED,
      NOT_FOUND: PaymentStatus.FAILED,
    };

    return statusMap[deunaStatus] || PaymentStatus.PENDING;
  }
}
