/**
 * Deuna API Client
 * Cliente HTTP para interactuar con la API de Deuna
 */

export interface DeunaConfig {
  apiKey: string;
  apiSecret: string;
  pointOfSale: string;
  baseUrl: string;
}

export interface CreatePaymentParams {
  /** Monto en la moneda del POS (USD). No es centavos: 20 = $20, 4001 = $4001. */
  amount: number;
  internalReference: string;
  detail: string;
  qrType: 'static' | 'dynamic';
  format: '0' | '1' | '2' | '3' | '4' | '5';
  expiredTime: number;
  callbackUrl?: string;
}

export interface DeunaPaymentResponse {
  transactionId: string;
  status: string;
  deeplink?: string;
  qr?: string;
  numericCode?: string;
}

export interface DeunaStatusResponse {
  status: string;
  transactionId: string;
  internalTransactionReference: string;
  amount: number;
  transferNumber?: string;
  date?: string;
  branchId?: string;
  posId?: string;
  currency: string;
  description?: string;
  ordererName?: string;
  ordererIdentification?: string;
}

/**
 * Cliente HTTP para la API de Deuna
 * Maneja todas las llamadas HTTP y transformaciones
 */
export class DeunaClient {
  constructor(private config: DeunaConfig) {}

  /**
   * Verifica si el cliente está correctamente configurado
   */
  isConfigured(): boolean {
    return !!(
      this.config.apiKey &&
      this.config.apiSecret &&
      this.config.pointOfSale &&
      this.config.baseUrl
    );
  }

  /**
   * Genera headers para las peticiones
   */
  private getHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'x-api-secret': this.config.apiSecret,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Crea una solicitud de pago en Deuna
   */
  async createPayment(params: CreatePaymentParams): Promise<DeunaPaymentResponse> {
    const payload = {
      pointOfSale: this.config.pointOfSale,
      qrType: params.qrType,
      amount: params.amount,
      detail: params.detail,
      internalTransactionReference: params.internalReference,
      format: params.format,
      expiredTime: params.expiredTime,
      qrFormat: 'svgQr300x300_color',
      callbackUrl: params.callbackUrl,
    };

    const response = await fetch(
      `${this.config.baseUrl}/merchant/v1/payment/request`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Deuna API Error (${response.status}): ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    // Validar que la respuesta tenga el formato esperado
    if (!data.transactionId || !data.status) {
      throw new Error('Invalid response format from Deuna API');
    }

    return data;
  }

  /**
   * Consulta el estado de una transacción
   * @param reference - Referencia interna o transaction ID
   * @param idType - '0' = transactionId, '1' = internalReference, '2' = transferNumber
   */
  async getPaymentStatus(
    reference: string,
    idType: '0' | '1' | '2' = '1'
  ): Promise<DeunaStatusResponse> {
    const payload = {
      idTransacionReference: reference,
      idType,
    };

    const response = await fetch(
      `${this.config.baseUrl}/merchant/v1/payment/info`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Deuna Status Error (${response.status}): ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Solicita una devolución (solo dentro de 24 horas)
   * @param reference - Referencia interna o transaction ID
   * @param idType - '0' = transactionId, '1' = transferNumber
   */
  async refundPayment(
    reference: string,
    idType: '0' | '1' = '1'
  ): Promise<boolean> {
    const payload = {
      idTransacionReference: reference,
      idType,
    };

    try {
      const response = await fetch(
        `${this.config.baseUrl}/merchant/v1/payment/refund`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        console.error(`[DeunaClient] Refund failed with status ${response.status}`);
        return false;
      }

      const data = await response.json();
      return data.status === true;
    } catch (error) {
      console.error('[DeunaClient] Refund error:', error);
      return false;
    }
  }

  /**
   * Valida la configuración del cliente
   * @throws Error si falta alguna configuración
   */
  validateConfig(): void {
    const missing: string[] = [];

    if (!this.config.apiKey) missing.push('apiKey');
    if (!this.config.apiSecret) missing.push('apiSecret');
    if (!this.config.pointOfSale) missing.push('pointOfSale');
    if (!this.config.baseUrl) missing.push('baseUrl');

    if (missing.length > 0) {
      throw new Error(`Missing Deuna configuration: ${missing.join(', ')}`);
    }
  }
}
