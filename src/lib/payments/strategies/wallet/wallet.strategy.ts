/**
 * Wallet Payment Strategy
 * Implementación de la estrategia de pago con wallet interno (prepago)
 */

import { createClient } from '@supabase/supabase-js';
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
 * Estrategia de pago usando wallet interno
 * Solo soporta pago directo por carga (el usuario ya tiene saldo)
 */
export class WalletPaymentStrategy implements IPaymentStrategy {
  readonly provider = PaymentProvider.WALLET;
  readonly name = 'Wallet';
  readonly supportedContexts = [PaymentContext.DIRECT_CHARGE];

  private supabase: any = null;

  /**
   * Inicializa la estrategia con Supabase client
   */
  initialize(config?: Record<string, any>): void {
    try {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      console.log('[WalletStrategy] ✅ Initialized successfully');
    } catch (error) {
      console.error('[WalletStrategy] ❌ Failed to initialize:', error);
    }
  }

  /**
   * Verifica si está correctamente configurado
   */
  isConfigured(): boolean {
    return this.supabase !== null;
  }

  /**
   * Verifica si soporta un contexto específico
   */
  supportsContext(context: PaymentContext): boolean {
    return this.supportedContexts.includes(context);
  }

  /**
   * Crea un "pago" con wallet (verifica saldo)
   * No realiza el cobro aún, solo valida
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    if (!this.supabase) {
      throw new Error('Wallet strategy not initialized');
    }

    try {
      const userId = request.metadata.userId;
      
      // Verificar saldo disponible
      const { data: balanceRow, error } = await this.supabase
        .from('user_balances')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[WalletStrategy] Error fetching balance:', error);
        return {
          success: false,
          paymentId: '',
          provider: this.provider,
          context: request.metadata.context,
          status: PaymentStatus.FAILED,
          amount: request.amount,
          error: 'Error al verificar saldo',
        };
      }

      const balance = balanceRow?.balance || 0;

      // Validar saldo suficiente
      if (balance < request.amount) {
        return {
          success: false,
          paymentId: '',
          provider: this.provider,
          context: request.metadata.context,
          status: PaymentStatus.FAILED,
          amount: request.amount,
          error: `Saldo insuficiente. Disponible: $${balance.toFixed(2)}, Requerido: $${request.amount.toFixed(2)}`,
        };
      }

      // Generar ID de pago (se usará para vincular con la sesión de carga)
      const paymentId = crypto.randomUUID();

      return {
        success: true,
        paymentId,
        provider: this.provider,
        context: request.metadata.context,
        status: PaymentStatus.APPROVED, // Wallet es inmediato
        amount: request.amount,
        metadata: {
          balance,
          balanceAfter: balance - request.amount,
          ...request.metadata,
        },
      };
    } catch (error: any) {
      console.error('[WalletStrategy] Create payment error:', error);
      
      return {
        success: false,
        paymentId: '',
        provider: this.provider,
        context: request.metadata.context,
        status: PaymentStatus.FAILED,
        amount: request.amount,
        error: error.message || 'Error al procesar pago con wallet',
      };
    }
  }

  /**
   * Consulta el estado de un pago con wallet
   * Los pagos con wallet son instantáneos
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    // Wallet payments son instantáneos, siempre están aprobados si existen
    return {
      paymentId,
      provider: this.provider,
      status: PaymentStatus.APPROVED,
      amount: 0, // No tenemos forma de recuperar el monto sin más contexto
    };
  }

  /**
   * Procesa webhook (Wallet no usa webhooks)
   */
  async processWebhook(
    headers: Record<string, string>,
    body: any
  ): Promise<WebhookEvent> {
    throw new Error('Wallet provider does not use webhooks');
  }

  /**
   * Valida webhook (Wallet no usa webhooks)
   */
  validateWebhook(headers: Record<string, string>, body: any): boolean {
    return false; // Wallet no usa webhooks
  }
}
