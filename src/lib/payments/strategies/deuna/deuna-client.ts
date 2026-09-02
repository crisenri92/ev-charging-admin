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
    console.log('[DeunaClient] Auth check - apiKey present:', !!this.config.apiKey, 'length:', this.config.apiKey?.length, 'prefix:', this.config.apiKey?.substring(0, 6));
    return {
      'Ocp-Apim-Subscription-Key': this.config.apiKey,
      'Content-Type': 'application/json',
      'X-Point-Of-Sale': this.config.pointOfSale,
    };
  }

  private buildUrl(path: string): string {
    // Pass subscription key as query param too (Azure APIM accepts header OR query param)
    const base = `${this.config.baseUrl}${path}`;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}subscription-key=${this.config.apiKey}`;
  }

  async createPayment(request: DeunaCreatePaymentRequest): Promise<DeunaCreatePaymentResponse> {
    const url = this.buildUrl('/merchant/v1/payment/request');
    console.log('[DeunaClient] POST', url.replace(this.config.apiKey, '***'));

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          amount: request.amount,
          internalReference: request.internalReference,
          detail: request.detail,
          qrType: request.qrType,
          format: request.format,
          expiredTime: request.expiredTime,
          callbackUrl: request.callbackUrl,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[DeunaClient] Error response:', response.status, JSON.stringify(error));
      throw new Error(`DEUNA API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    return {
      transactionId: data.transactionId || data.transaction_id || data.id || '',
      qr: data.qr || data.qrCode || data.qr_code || '',
      deeplink: data.deeplink || data.deep_link || '',
      numericCode: data.numericCode || data.numeric_code || '',
    };
  }

  async getPaymentStatus(internalReference: string, type: string): Promise<DeunaPaymentStatusResponse> {
    const url = this.buildUrl(`/merchant/v1/payment/request/${internalReference}?type=${type}`);
    console.log('[DeunaClient] GET status', internalReference);

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
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
      internalTransactionReference: data.internalTransactionReference || data.internal_transaction_reference || internalReference,
      branchId: data.branchId || data.branch_id || '',
      posId: data.posId || data.pos_id || '',
    };
  }

  async refundPayment(internalReference: string, type: string): Promise<boolean> {
    const url = this.buildUrl(`/merchant/v1/payment/request/${internalReference}/refund`);

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
