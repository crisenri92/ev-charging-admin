export interface DeunaConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  pointOfSale: string;
}

export interface DeunaCreatePaymentRequest {
  amount: number;
  internalReference: string;
  detail: string;
  qrType: string;
  format: string;
  expiredTime: number;
  callbackUrl?: string;
}

export interface DeunaCreatePaymentResponse {
  transactionId: string;
  qr: string;
  deeplink: string;
  numericCode: string;
}

export interface DeunaPaymentStatusResponse {
  transactionId: string;
  status: string;
  amount: number;
  date: string;
  ordererName: string;
  ordererIdentification: string;
  transferNumber: string;
  internalTransactionReference: string;
  branchId: string;
  posId: string;
}

export class DeunaClient {
  constructor(private config: DeunaConfig) {}

  isConfigured(): boolean {
    return !!(
      this.config.apiKey &&
      this.config.apiSecret &&
      this.config.pointOfSale &&
      this.config.baseUrl
    );
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await globalThis.fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error(`DEUNA API timeout (${timeoutMs / 1000}s)`);
      throw err;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'x-api-secret': this.config.apiSecret,
      'Content-Type': 'application/json',
    };
  }

  async createPayment(request: DeunaCreatePaymentRequest): Promise<DeunaCreatePaymentResponse> {
    const url = `${this.config.baseUrl}/merchant/v1/payment/request`;
    console.log('[DeunaClient] POST', url);

    const body = {
      pointOfSale: this.config.pointOfSale,
      amount: request.amount,
      internalTransactionReference: request.internalReference,
      detail: request.detail,
      qrType: request.qrType,
      format: request.format,
      ...(request.expiredTime ? { expiredTime: request.expiredTime } : {}),
      ...(request.callbackUrl ? { callbackUrl: request.callbackUrl } : {}),
    };

    console.log('[DeunaClient] Request body:', JSON.stringify(body));

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[DeunaClient] Error response:', response.status, JSON.stringify(error));
      throw new Error(`DEUNA API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    console.log('[DeunaClient] Success response:', JSON.stringify(data));

    return {
      transactionId: data.transactionId || data.transaction_id || data.id || '',
      qr: data.qr || data.qrCode || data.qr_code || '',
      deeplink: data.deeplink || data.deep_link || '',
      numericCode: data.numericCode || data.numeric_code || '',
    };
  }

  async getPaymentStatus(transactionId: string, idType: string = '0'): Promise<DeunaPaymentStatusResponse> {
    const url = `${this.config.baseUrl}/merchant/v1/payment/info`;
    console.log('[DeunaClient] POST payment/info', transactionId);

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          idTransacionReference: transactionId,
          idType: idType,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[DeunaClient] Status error response:', response.status, JSON.stringify(error));
      throw new Error(`DEUNA API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    return {
      transactionId: data.transactionId || data.transaction_id || data.id || '',
      status: data.status || 'PENDING',
      amount: data.amount || 0,
      date: data.date || data.created_at || '',
      ordererName: data.ordererName || data.orderer_name || '',
      ordererIdentification: data.ordererIdentification || data.orderer_identification || '',
      transferNumber: data.transferNumber || data.transfer_number || '',
      internalTransactionReference: data.internalTransactionReference || data.internal_transaction_reference || transactionId,
      branchId: data.branchId || data.branch_id || '',
      posId: data.posId || data.pos_id || '',
    };
  }

  async refundPayment(internalReference: string, type: string): Promise<boolean> {
    const url = `${this.config.baseUrl}/merchant/v1/payment/request/${internalReference}/refund`;

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ type }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[DeunaClient] Refund error: ${response.status} - ${JSON.stringify(error)}`);
      return false;
    }

    return true;
  }
}
