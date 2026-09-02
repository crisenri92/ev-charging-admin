/**
 * Payment System - Public API
 * Punto de entrada único para todo el sistema de pagos
 */

import { PaymentGateway } from './core/payment-gateway';
import { DeunaPaymentStrategy } from './strategies/deuna/deuna.strategy';
import { StripePaymentStrategy } from './strategies/stripe/stripe.strategy';
import { WalletPaymentStrategy } from './strategies/wallet/wallet.strategy';

let initialized = false;

/**
 * Inicializa todas las estrategias de pago disponibles
 * Se registran automáticamente en el gateway
 * Solo se registran las que están correctamente configuradas
 */
export function initializePaymentGateway(): PaymentGateway {
  if (initialized) {
    return PaymentGateway.getInstance();
  }

  const gateway = PaymentGateway.getInstance();

  console.log('[Payment System] 🚀 Initializing payment strategies...');

  // Registrar estrategia Deuna
  try {
    const deunaStrategy = new DeunaPaymentStrategy();
    deunaStrategy.initialize();
    gateway.registerStrategy(deunaStrategy);
  } catch (error) {
    console.error('[Payment System] Failed to initialize Deuna:', error);
  }

  // Registrar estrategia Stripe
  try {
    const stripeStrategy = new StripePaymentStrategy();
    stripeStrategy.initialize();
    gateway.registerStrategy(stripeStrategy);
  } catch (error) {
    console.error('[Payment System] Failed to initialize Stripe:', error);
  }

  // Registrar estrategia Wallet
  try {
    const walletStrategy = new WalletPaymentStrategy();
    walletStrategy.initialize();
    gateway.registerStrategy(walletStrategy);
  } catch (error) {
    console.error('[Payment System] Failed to initialize Wallet:', error);
  }

  console.log('[Payment System] ✅ Initialization complete');
  console.log('[Payment System] Available providers:', gateway.getAvailableProviders());

  initialized = true;
  return gateway;
}

// ============================================
// PUBLIC EXPORTS
// ============================================

// Core
export { PaymentGateway } from './core/payment-gateway';
export type { IPaymentStrategy } from './core/payment-strategy.interface';

// Types
export {
  PaymentProvider,
  PaymentContext,
  PaymentStatus,
} from './core/payment-types';

export type {
  CreatePaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  WebhookEvent,
  BasePaymentMetadata,
  RechargeMetadata,
  DirectChargeMetadata,
} from './core/payment-types';

// Strategies (por si se necesita acceso directo)
export { DeunaPaymentStrategy } from './strategies/deuna/deuna.strategy';
export { StripePaymentStrategy } from './strategies/stripe/stripe.strategy';
export { WalletPaymentStrategy } from './strategies/wallet/wallet.strategy';
