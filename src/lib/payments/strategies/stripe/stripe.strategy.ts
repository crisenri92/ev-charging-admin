/**
 * Stripe Payment Strategy
 * Implementación de la estrategia de pago para Stripe
 */

import Stripe from 'stripe';
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

/**
 * Estrategia de pago usando Stripe
 * Solo soporta recarga de wallet (recharge)
 */
export class StripePaymentStrategy implements IPaymentStrategy {
  readonly provider = PaymentProvider.STRIPE;
  readonly name = 'Stripe';
  readonly supportedContexts = [PaymentContext.WALLET_RECHARGE];

  private stripe: Stripe | null = null;
  private webhookSecret: string = '';

  /**
   * Inicializa la estrategia con Stripe SDK
   */
  initialize(config?: Record<string, any>): void {
    const secretKey = config?.secretKey || process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = config?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';

    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2024-06-20',
      });
      console.log('[StripeStrategy] ✅ Initialized successfully');
    } else {
      console.warn('[StripeStrategy] ⚠️  Missing STRIPE_SECRET_KEY');
    }
  }

  /**
   * Verifica si está correctamente configurado
   */
  isConfigured(): boolean {
    return this.stripe !== null && !!this.webhookSecret;
  }

  /**
   * Verifica si soporta un contexto específico
   */
  supportsContext(context: PaymentContext): boolean {
    return this.supportedContexts.includes(context);
  }

  /**
   * Crea un pago en Stripe (Checkout Session)
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    if (!this.stripe) {
      throw new Error('Stripe strategy not initialized');
    }

    try {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://ev-charging-admin-production.up.railway.app';

      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Recarga de saldo EV Charging',
                description: `Agregar $${request.amount.toFixed(2)} a tu wallet`,
              },
              unit_amount: Math.round(request.amount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: request.metadata.userId,
          amount: String(request.amount),
          context: request.metadata.context,
        },
        success_url: `${appUrl}/wallet?recharge=success`,
        cancel_url: `${appUrl}/wallet`,
      });

      return {
        success: true,
        paymentId: session.id,
        provider: this.provider,
        context: request.metadata.context,
        status: PaymentStatus.PENDING,
        amount: request.amount,
        checkoutUrl: session.url || undefined,
        metadata: request.metadata,
      };
    } catch (error: any) {
      console.error('[StripeStrategy] Create payment error:', error);
      
      return {
        success: false,
        paymentId: '',
        provider: this.provider,
        context: request.metadata.context,
        status: PaymentStatus.FAILED,
        amount: request.amount,
        error: error.message || 'Error al crear pago con Stripe',
      };
    }
  }

  /**
   * Consulta el estado de un pago en Stripe
   */
  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResponse> {
    if (!this.stripe) {
      throw new Error('Stripe strategy not initialized');
    }

    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      return {
        paymentId: session.id,
        provider: this.provider,
        status: this.mapStripeStatus(session.payment_status),
        amount: (session.amount_total || 0) / 100,
        paidAt: session.payment_status === 'paid' ? new Date() : undefined,
        metadata: session.metadata,
      };
    } catch (error: any) {
      console.error('[StripeStrategy] Get payment status error:', error);
      throw error;
    }
  }

  /**
   * Procesa un webhook de Stripe
   */
  async processWebhook(
    headers: Record<string, string>,
    body: any
  ): Promise<WebhookEvent> {
    if (!this.stripe) {
      throw new Error('Stripe strategy not initialized');
    }

    const sig = headers['stripe-signature'] || '';
    const event = this.stripe.webhooks.constructEvent(
      body,
      sig,
      this.webhookSecret
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};

      return {
        provider: this.provider,
        paymentId: session.id,
        status: PaymentStatus.APPROVED,
        amount: (session.amount_total || 0) / 100,
        timestamp: new Date(event.created * 1000),
        rawPayload: {
          userId: meta.userId,
          context: meta.context,
          sessionId: session.id,
        },
      };
    }

    throw new Error(`Unhandled Stripe event type: ${event.type}`);
  }

  /**
   * Valida la autenticidad de un webhook de Stripe
   */
  validateWebhook(headers: Record<string, string>, body: any): boolean {
    if (!this.stripe) return false;

    try {
      const sig = headers['stripe-signature'] || '';
      this.stripe.webhooks.constructEvent(body, sig, this.webhookSecret);
      return true;
    } catch (error) {
      console.warn('[StripeStrategy] Webhook validation failed:', error);
      return false;
    }
  }

  /**
   * Mapea estados de Stripe a nuestros estados
   */
  private mapStripeStatus(status: string | null): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      paid: PaymentStatus.APPROVED,
      unpaid: PaymentStatus.PENDING,
      no_payment_required: PaymentStatus.APPROVED,
    };

    return statusMap[status || ''] || PaymentStatus.PENDING;
  }
}
