/**
 * Payment Gateway - Orchestrator
 * Orquesta todas las estrategias de pago disponibles
 * Patrón Singleton + Strategy
 */

import { IPaymentStrategy } from './payment-strategy.interface';
import {
  PaymentProvider,
  PaymentContext,
  CreatePaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  WebhookEvent,
} from './payment-types';

/**
 * Gateway central que orquesta todas las estrategias de pago
 * Permite agregar/quitar providers sin modificar el código cliente
 */
export class PaymentGateway {
  private strategies: Map<PaymentProvider, IPaymentStrategy>;
  private static instance: PaymentGateway;

  private constructor() {
    this.strategies = new Map();
  }

  /**
   * Obtiene la instancia única del gateway (Singleton)
   */
  static getInstance(): PaymentGateway {
    if (!PaymentGateway.instance) {
      PaymentGateway.instance = new PaymentGateway();
    }
    return PaymentGateway.instance;
  }

  /**
   * Registra una estrategia de pago en el gateway
   * Solo se registran estrategias correctamente configuradas
   */
  registerStrategy(strategy: IPaymentStrategy): void {
    if (!strategy.isConfigured()) {
      console.warn(
        `[PaymentGateway] ⚠️  Strategy ${strategy.name} is not properly configured. Skipping registration.`
      );
      return;
    }

    this.strategies.set(strategy.provider, strategy);
    console.log(
      `[PaymentGateway] ✅ Registered: ${strategy.name} (supports: ${strategy.supportedContexts.join(', ')})`
    );
  }

  /**
   * Obtiene una estrategia específica por su provider
   * @throws Error si el provider no está registrado
   */
  private getStrategy(provider: PaymentProvider): IPaymentStrategy {
    const strategy = this.strategies.get(provider);

    if (!strategy) {
      const available = Array.from(this.strategies.keys()).join(', ');
      throw new Error(
        `Payment provider '${provider}' not available. Available providers: ${available || 'none'}`
      );
    }

    return strategy;
  }

  /**
   * Lista providers disponibles, opcionalmente filtrados por contexto
   */
  getAvailableProviders(context?: PaymentContext): PaymentProvider[] {
    const providers = Array.from(this.strategies.values());

    if (context) {
      return providers
        .filter((s) => s.supportsContext(context))
        .map((s) => s.provider);
    }

    return providers.map((s) => s.provider);
  }

  /**
   * Crea un pago usando el provider especificado
   * Valida que el provider soporte el contexto antes de ejecutar
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    const strategy = this.getStrategy(request.provider);

    // Verificar que el provider soporte el contexto
    if (!strategy.supportsContext(request.metadata.context)) {
      throw new Error(
        `Provider ${request.provider} does not support context ${request.metadata.context}`
      );
    }

    console.log(`[PaymentGateway] Creating ${request.metadata.context} payment`, {
      provider: request.provider,
      amount: request.amount,
      userId: request.metadata.userId,
    });

    try {
      const response = await strategy.createPayment(request);
      
      if (response.success) {
        console.log(`[PaymentGateway] ✅ Payment created: ${response.paymentId}`);
      } else {
        console.error(`[PaymentGateway] ❌ Payment failed: ${response.error}`);
      }
      
      return response;
    } catch (error: any) {
      console.error(`[PaymentGateway] ❌ Exception during payment creation:`, error);
      throw error;
    }
  }

  /**
   * Consulta el estado de un pago
   */
  async getPaymentStatus(
    provider: PaymentProvider,
    paymentId: string
  ): Promise<PaymentStatusResponse> {
    const strategy = this.getStrategy(provider);
    return await strategy.getPaymentStatus(paymentId);
  }

  /**
   * Procesa un webhook de cualquier provider
   * Valida la autenticidad antes de procesar
   */
  async handleWebhook(
    provider: PaymentProvider,
    headers: Record<string, string>,
    body: any
  ): Promise<WebhookEvent> {
    const strategy = this.getStrategy(provider);

    // Validar autenticidad del webhook
    if (!strategy.validateWebhook(headers, body)) {
      throw new Error(`Invalid webhook signature for provider: ${provider}`);
    }

    console.log(`[PaymentGateway] Processing webhook from ${provider}`);
    
    const event = await strategy.processWebhook(headers, body);
    
    console.log(`[PaymentGateway] ✅ Webhook processed:`, {
      provider: event.provider,
      paymentId: event.paymentId,
      status: event.status,
    });

    return event;
  }

  /**
   * Cancela un pago si el provider lo soporta
   */
  async cancelPayment(
    provider: PaymentProvider,
    paymentId: string,
    reason?: string
  ): Promise<boolean> {
    const strategy = this.getStrategy(provider);

    if (!strategy.cancelPayment) {
      console.warn(
        `[PaymentGateway] Provider ${provider} does not support payment cancellation`
      );
      return false;
    }

    console.log(`[PaymentGateway] Cancelling payment ${paymentId}`, { provider, reason });
    
    const result = await strategy.cancelPayment(paymentId, reason);
    
    if (result) {
      console.log(`[PaymentGateway] ✅ Payment cancelled: ${paymentId}`);
    } else {
      console.error(`[PaymentGateway] ❌ Failed to cancel payment: ${paymentId}`);
    }

    return result;
  }

  /**
   * Verifica si un provider específico está disponible
   */
  isProviderAvailable(provider: PaymentProvider): boolean {
    return this.strategies.has(provider);
  }

  /**
   * Health check de todas las estrategias registradas
   * Útil para monitoreo y debugging
   */
  getHealthStatus(): Record<string, {
    configured: boolean;
    supportedContexts: string[];
  }> {
    const status: Record<string, any> = {};
    
    for (const [provider, strategy] of this.strategies) {
      status[provider] = {
        configured: strategy.isConfigured(),
        supportedContexts: strategy.supportedContexts,
      };
    }
    
    return status;
  }

  /**
   * Obtiene información sobre todos los providers registrados
   */
  getProvidersInfo(): Array<{
    provider: PaymentProvider;
    name: string;
    supportedContexts: PaymentContext[];
  }> {
    return Array.from(this.strategies.values()).map(strategy => ({
      provider: strategy.provider,
      name: strategy.name,
      supportedContexts: strategy.supportedContexts,
    }));
  }

  /**
   * Resetea el gateway (útil para testing)
   * @internal
   */
  _reset(): void {
    this.strategies.clear();
    console.log('[PaymentGateway] Gateway reset');
  }
}
