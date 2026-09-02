/**
 * Payment Strategy Interface
 * Contrato que deben cumplir todas las estrategias de pago
 */

import {
  PaymentProvider,
  PaymentContext,
  CreatePaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  WebhookEvent,
} from './payment-types';

/**
 * Interface que deben implementar todas las estrategias de pago
 * Patrón Strategy para hacer el sistema extensible
 */
export interface IPaymentStrategy {
  /**
   * Identificador del provider
   */
  readonly provider: PaymentProvider;
  
  /**
   * Nombre legible del provider
   */
  readonly name: string;
  
  /**
   * Contextos que soporta esta estrategia
   */
  readonly supportedContexts: PaymentContext[];
  
  /**
   * Inicializa la estrategia con configuración
   * Se llama automáticamente al registrar en el gateway
   */
  initialize(config?: Record<string, any>): Promise<void> | void;
  
  /**
   * Verifica si está correctamente configurado
   * Solo se registran estrategias configuradas
   */
  isConfigured(): boolean;
  
  /**
   * Crea un pago usando este provider
   * @param request - Datos del pago a crear
   * @returns Response con el pago creado o error
   */
  createPayment(request: CreatePaymentRequest): Promise<PaymentResponse>;
  
  /**
   * Consulta el estado actual de un pago
   * @param paymentId - ID del pago (puede ser interno o del provider)
   * @returns Estado actual del pago
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse>;
  
  /**
   * Procesa un webhook recibido del provider
   * @param headers - Headers HTTP del webhook
   * @param body - Cuerpo del webhook
   * @returns Evento procesado
   */
  processWebhook(
    headers: Record<string, string>,
    body: any
  ): Promise<WebhookEvent>;
  
  /**
   * Valida la autenticidad de un webhook
   * @param headers - Headers HTTP del webhook
   * @param body - Cuerpo del webhook
   * @returns true si es válido, false si no
   */
  validateWebhook(
    headers: Record<string, string>,
    body: any
  ): boolean;
  
  /**
   * Cancela/reversa un pago (si el provider lo soporta)
   * @param paymentId - ID del pago a cancelar
   * @param reason - Razón de la cancelación (opcional)
   * @returns true si se canceló exitosamente
   */
  cancelPayment?(paymentId: string, reason?: string): Promise<boolean>;
  
  /**
   * Verifica si soporta un contexto específico
   * @param context - Contexto a verificar
   * @returns true si lo soporta
   */
  supportsContext(context: PaymentContext): boolean;
}
