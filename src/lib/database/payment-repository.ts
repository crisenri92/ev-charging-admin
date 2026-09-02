/**
 * Payment Repository
 * Capa de acceso a datos para el sistema de pagos
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  PaymentProvider,
  PaymentContext,
  PaymentStatus,
} from '../payments/core/payment-types';

// ============================================
// TYPES
// ============================================

export interface PaymentRecord {
  id: string;
  payment_id: string;
  internal_reference: string | null;
  user_id: string;
  provider: PaymentProvider;
  context: PaymentContext;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  metadata: Record<string, any> | null;
  qr_code: string | null;
  deeplink: string | null;
  numeric_code: string | null;
  checkout_url: string | null;
  customer_name: string | null;
  customer_identification: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  paid_at: string | null;
}

export interface DeunaTransactionRecord {
  id: string;
  payment_id: string;
  transaction_id: string;
  internal_reference: string;
  transfer_number: string | null;
  branch_id: string | null;
  pos_id: string | null;
  point_of_sale: string | null;
  raw_webhook_data: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface ChargingAuthorizationRecord {
  id: string;
  user_id: string;
  charger_id: string;
  payment_id: string;
  charging_session_id: string | null;
  amount_paid: number;
  provider: string;
  status: 'authorized' | 'used' | 'expired' | 'cancelled';
  authorized_at: string;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreatePaymentInput {
  paymentId: string;
  internalReference: string;
  userId: string;
  provider: PaymentProvider;
  context: PaymentContext;
  amount: number;
  description: string;
  metadata?: Record<string, any>;
  qrCode?: string;
  deeplink?: string;
  numericCode?: string;
  checkoutUrl?: string;
  expiresAt?: Date;
}

export interface CreateDeunaTransactionInput {
  paymentId: string;
  transactionId: string;
  internalReference: string;
  pointOfSale?: string;
}

// ============================================
// REPOSITORY CLASS
// ============================================

export class PaymentRepository {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Crea un nuevo pago en la base de datos
   */
  async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    const { data, error } = await this.supabase
      .from('payments')
      .insert({
        payment_id: input.paymentId,
        internal_reference: input.internalReference,
        user_id: input.userId,
        provider: input.provider,
        context: input.context,
        amount: input.amount,
        currency: 'USD',
        status: 'pending',
        description: input.description,
        metadata: input.metadata || null,
        qr_code: input.qrCode || null,
        deeplink: input.deeplink || null,
        numeric_code: input.numericCode || null,
        checkout_url: input.checkoutUrl || null,
        expires_at: input.expiresAt?.toISOString() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[PaymentRepository] Error creating payment:', error);
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    return data as PaymentRecord;
  }

  /**
   * Crea un registro de transacción Deuna
   */
  async createDeunaTransaction(input: CreateDeunaTransactionInput): Promise<DeunaTransactionRecord> {
    const { data, error } = await this.supabase
      .from('deuna_transactions')
      .insert({
        payment_id: input.paymentId,
        transaction_id: input.transactionId,
        internal_reference: input.internalReference,
        point_of_sale: input.pointOfSale || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[PaymentRepository] Error creating deuna transaction:', error);
      throw new Error(`Failed to create deuna transaction: ${error.message}`);
    }

    return data as DeunaTransactionRecord;
  }

  /**
   * Busca un pago por payment_id
   */
  async findByPaymentId(paymentId: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[PaymentRepository] Error finding payment:', error);
      throw new Error(`Failed to find payment: ${error.message}`);
    }

    return data as PaymentRecord | null;
  }

  /**
   * Busca un pago por internal_reference
   */
  async findByInternalReference(reference: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('internal_reference', reference)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[PaymentRepository] Error finding payment by reference:', error);
      throw new Error(`Failed to find payment: ${error.message}`);
    }

    return data as PaymentRecord | null;
  }

  /**
   * Busca un pago por ID interno (UUID)
   */
  async findById(id: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[PaymentRepository] Error finding payment by id:', error);
      throw new Error(`Failed to find payment: ${error.message}`);
    }

    return data as PaymentRecord | null;
  }

  /**
   * Busca transacción Deuna por transaction_id
   */
  async findDeunaByTransactionId(transactionId: string): Promise<DeunaTransactionRecord | null> {
    const { data, error } = await this.supabase
      .from('deuna_transactions')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[PaymentRepository] Error finding deuna transaction:', error);
      throw new Error(`Failed to find deuna transaction: ${error.message}`);
    }

    return data as DeunaTransactionRecord | null;
  }

  /**
   * Actualiza el estado de un pago
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    additionalData?: {
      customerName?: string;
      customerIdentification?: string;
      paidAt?: Date;
    }
  ): Promise<PaymentRecord> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (additionalData?.customerName) {
      updateData.customer_name = additionalData.customerName;
    }
    if (additionalData?.customerIdentification) {
      updateData.customer_identification = additionalData.customerIdentification;
    }
    if (additionalData?.paidAt) {
      updateData.paid_at = additionalData.paidAt.toISOString();
    }

    const { data, error } = await this.supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('[PaymentRepository] Error updating payment status:', error);
      throw new Error(`Failed to update payment status: ${error.message}`);
    }

    return data as PaymentRecord;
  }

  /**
   * Actualiza transacción Deuna con datos del webhook
   */
  async updateDeunaTransaction(
    transactionId: string,
    data: {
      transferNumber?: string;
      branchId?: string;
      posId?: string;
      webhookData?: Record<string, any>;
    }
  ): Promise<DeunaTransactionRecord> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.transferNumber) updateData.transfer_number = data.transferNumber;
    if (data.branchId) updateData.branch_id = data.branchId;
    if (data.posId) updateData.pos_id = data.posId;
    if (data.webhookData) updateData.raw_webhook_data = data.webhookData;

    const { data: result, error } = await this.supabase
      .from('deuna_transactions')
      .update(updateData)
      .eq('transaction_id', transactionId)
      .select()
      .single();

    if (error) {
      console.error('[PaymentRepository] Error updating deuna transaction:', error);
      throw new Error(`Failed to update deuna transaction: ${error.message}`);
    }

    return result as DeunaTransactionRecord;
  }

  /**
   * Crea una autorización de carga
   */
  async createChargingAuthorization(
    userId: string,
    chargerId: string,
    paymentId: string,
    amountPaid: number,
    provider: string,
    expiresInMinutes: number = 30
  ): Promise<ChargingAuthorizationRecord> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    const { data, error } = await this.supabase
      .from('charging_authorizations')
      .insert({
        user_id: userId,
        charger_id: chargerId,
        payment_id: paymentId,
        amount_paid: amountPaid,
        provider,
        status: 'authorized',
        authorized_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[PaymentRepository] Error creating charging authorization:', error);
      throw new Error(`Failed to create charging authorization: ${error.message}`);
    }

    return data as ChargingAuthorizationRecord;
  }

  /**
   * Busca autorización activa para un usuario y cargador
   */
  async findActiveAuthorization(
    userId: string,
    chargerId: string
  ): Promise<ChargingAuthorizationRecord | null> {
    const { data, error } = await this.supabase
      .from('charging_authorizations')
      .select('*')
      .eq('user_id', userId)
      .eq('charger_id', chargerId)
      .eq('status', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[PaymentRepository] Error finding authorization:', error);
      throw new Error(`Failed to find authorization: ${error.message}`);
    }

    return data as ChargingAuthorizationRecord | null;
  }

  /**
   * Marca una autorización como usada
   */
  async useAuthorization(
    authorizationId: string,
    chargingSessionId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('charging_authorizations')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        charging_session_id: chargingSessionId,
      })
      .eq('id', authorizationId);

    if (error) {
      console.error('[PaymentRepository] Error using authorization:', error);
      throw new Error(`Failed to use authorization: ${error.message}`);
    }
  }

  /**
   * Obtiene pagos de un usuario
   */
  async getUserPayments(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PaymentRecord[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[PaymentRepository] Error getting user payments:', error);
      throw new Error(`Failed to get user payments: ${error.message}`);
    }

    return data as PaymentRecord[];
  }

  /**
   * Busca una autorización por payment_id
   */
  async findAuthorizationByPaymentId(paymentId: string): Promise<ChargingAuthorizationRecord | null> {
    const { data, error } = await this.supabase
      .from('charging_authorizations')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No encontrado
      }
      console.error('[PaymentRepository] Error finding authorization by payment:', error);
      throw new Error(`Failed to find authorization by payment: ${error.message}`);
    }

    return data as ChargingAuthorizationRecord;
  }

  /**
   * Cancela una autorización
   */
  async cancelAuthorization(authorizationId: string, reason?: string): Promise<void> {
    const { error } = await this.supabase
      .from('charging_authorizations')
      .update({
        status: 'cancelled',
        metadata: { cancellationReason: reason, cancelledAt: new Date().toISOString() },
      })
      .eq('id', authorizationId);

    if (error) {
      console.error('[PaymentRepository] Error cancelling authorization:', error);
      throw new Error(`Failed to cancel authorization: ${error.message}`);
    }
  }

  /**
   * Limpia pagos expirados
   */
  async cleanupExpiredPayments(): Promise<number> {
    const { data, error } = await this.supabase.rpc('cleanup_expired_payments');

    if (error) {
      console.error('[PaymentRepository] Error cleaning expired payments:', error);
      throw new Error(`Failed to cleanup expired payments: ${error.message}`);
    }

    return 0; // La función retorna void
  }
}

/**
 * Singleton instance
 */
let repositoryInstance: PaymentRepository | null = null;

export function getPaymentRepository(): PaymentRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PaymentRepository();
  }
  return repositoryInstance;
}
