/**
 * Payment System - Core Types & Enums
 * Tipos compartidos para todo el sistema de pagos
 */

// ============================================
// ENUMS
// ============================================

/**
 * Contextos de pago
 */
export enum PaymentContext {
  WALLET_RECHARGE = 'wallet_recharge',
  DIRECT_CHARGE = 'direct_charge',
}

/**
 * Estados de pago
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  FAILED = 'failed',
  EXPIRED = 'expired',
  REVERSED = 'reversed',
}

/**
 * Tipos de provider de pago
 */
export enum PaymentProvider {
  DEUNA = 'deuna',
  STRIPE = 'stripe',
  WALLET = 'wallet',
}

// ============================================
// METADATA TYPES
// ============================================

/**
 * Metadata base para todos los pagos
 */
export interface BasePaymentMetadata {
  userId: string;
  context: PaymentContext;
  description: string;
  [key: string]: any;
}

/**
 * Metadata específica para recarga de wallet
 */
export interface RechargeMetadata extends BasePaymentMetadata {
  context: PaymentContext.WALLET_RECHARGE;
}

/**
 * Metadata específica para pago directo de carga
 */
export interface DirectChargeMetadata extends BasePaymentMetadata {
  context: PaymentContext.DIRECT_CHARGE;
  chargerId: string;
  chargerName?: string;
  estimatedKwh?: number;
  pricePerKwh?: number;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

/**
 * Request unificado para crear pagos
 */
export interface CreatePaymentRequest {
  provider: PaymentProvider;
  amount: number;
  metadata: RechargeMetadata | DirectChargeMetadata;
  expirationMinutes?: number;
  callbackUrl?: string;
}

/**
 * Response unificado al crear un pago
 */
export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  provider: PaymentProvider;
  context: PaymentContext;
  status: PaymentStatus;
  amount: number;
  
  // Métodos de pago disponibles (según provider)
  qrCode?: string;
  deeplink?: string;
  numericCode?: string;
  checkoutUrl?: string;
  
  expiresAt?: Date;
  metadata?: Record<string, any>;
  error?: string;
}

/**
 * Response al consultar estado de un pago
 */
export interface PaymentStatusResponse {
  paymentId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  paidAt?: Date;
  customerInfo?: {
    name?: string;
    identification?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Evento de webhook procesado
 */
export interface WebhookEvent {
  provider: PaymentProvider;
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  timestamp: Date;
  rawPayload: any;
}
