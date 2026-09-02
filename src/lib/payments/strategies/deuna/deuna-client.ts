import { PaymentGatewayConfig } from '../../types';

export interface DeunaConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  pointOfSale: string;
}

export interface DeunaPaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  description: string;
  customerEmail: string;
  customerName: string;
  metadata?: Record<string, unknown>;
}

export interface DeunaPaymentResponse {
  paymentId: string;
  status: string;
  checkoutUrl?: string;
  redirectUrl?: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface DeunaWebhookPayload {
  event: string;
  paymentId: string;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export class DeunaClient {
  constructor(private config: DeunaConfig) {}

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
    const credentials = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64');
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'X-Point-Of-Sale': this.config.pointOfSale,
    };
  }

  async createPayment(request: DeunaPaymentRequest): Promise<DeunaPaymentResponse> {
    const response = await this.fetchWithTimeout(
      `${this.config.baseUrl}/merchant/v1/payment/request`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          amount: request.amount,
          currency: request.currency,
          order_id: request.orderId,
          description: request.description,
          customer: {
            email: request.customerEmail,
            name: request.customerName,
          },
          metadata: request.metadata,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`DEUNA API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    return {
      paymentId: data.payment_id || data.id,
      status: data.status,
      checkoutUrl: data.checkout_url,
      redirectUrl: data.redirect_url,
      amount: request.amount,
      currency: request.currency,
      createdAt: data.created_at || new Date().toISOString(),
    };
  }

  async getPaymentStatus(paymentId: string): Promise<DeunaPaymentResponse> {
    const response = await this.fetchWithTimeout(
      `${this.config.baseUrl}/merchant/v1/payment/request/${paymentId}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`DEUNA API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    return {
      paymentId: data.payment_id || data.id,
      status: data.status,
      checkoutUrl: data.checkout_url,
      redirectUrl: data.redirect_url,
      amount: data.amount,
      currency: data.currency,
      createdAt: data.created_at,
    };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<{ success: boolean; refundId?: string }> {
    const body: Record<string, unknown> = { payment_id: paymentId };
    if (amount !== undefined) body.amount = amount;

    const response = await this.fetchWithTimeout(
      `${this.config.baseUrl}/merchant/v1/payment/request/${paymentId}/refund`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`DEUNA refund error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return { success: true, refundId: data.refund_id || data.id };
  }
}
