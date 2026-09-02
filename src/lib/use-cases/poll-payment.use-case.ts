/**
 * PollPaymentUseCase
 * Consulta el estado en Deuna 5 veces, cada 15 segundos.
 * Si el pago pasa a approved, acredita wallet o crea autorización.
 */

import { BaseUseCase, UseCaseError } from './base-use-case';
import {
  initializePaymentGateway,
  PaymentProvider,
  PaymentStatus,
} from '@/lib/payments';
import { applyApprovedPayment } from '@/lib/payments/apply-approved-payment';
import { getPaymentRepository, PaymentRecord } from '@/lib/database/payment-repository';

export const POLL_ATTEMPTS = 5;
export const POLL_INTERVAL_MS = 15000;

export interface PollPaymentRequest {
  userId: string;
  paymentId: string;
}

export interface PollAttempt {
  attempt: number;
  status: string;
  at: string;
}

export interface PollPaymentResponse {
  paymentId: string;
  status: string;
  amount: number;
  attempts: PollAttempt[];
  applied: boolean;
  alreadyProcessed: boolean;
  newBalance?: number;
  customerInfo?: {
    name?: string;
    identification?: string;
  };
  metadata?: Record<string, any>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminal(status: string): boolean {
  return (
    status === PaymentStatus.APPROVED ||
    status === PaymentStatus.FAILED ||
    status === PaymentStatus.EXPIRED ||
    status === PaymentStatus.REVERSED
  );
}

export class PollPaymentUseCase extends BaseUseCase<
  PollPaymentRequest,
  PollPaymentResponse
> {
  protected readonly name = 'PollPaymentUseCase';

  protected async validate(request: PollPaymentRequest): Promise<void> {
    if (!request.userId) {
      throw new UseCaseError('userId es requerido', 'MISSING_USER_ID', 400);
    }
    if (!request.paymentId) {
      throw new UseCaseError('paymentId es requerido', 'MISSING_PAYMENT_ID', 400);
    }
  }

  async execute(request: PollPaymentRequest): Promise<PollPaymentResponse> {
    const { userId, paymentId } = request;
    const repo = getPaymentRepository();

    const payment = await this.findLocalPayment(paymentId);

    if (payment && payment.user_id !== userId) {
      throw new UseCaseError(
        'No autorizado para consultar este pago',
        'UNAUTHORIZED',
        403
      );
    }

    if (payment?.status === PaymentStatus.APPROVED) {
      this.log('Payment already approved locally');
      return {
        paymentId: payment.payment_id,
        status: PaymentStatus.APPROVED,
        amount: parseFloat(payment.amount.toString()),
        attempts: [],
        applied: false,
        alreadyProcessed: true,
        customerInfo: {
          name: payment.customer_name || undefined,
          identification: payment.customer_identification || undefined,
        },
      };
    }

    const gateway = initializePaymentGateway();
    const deunaReference =
      payment?.internal_reference || payment?.payment_id || paymentId;

    const attempts: PollAttempt[] = [];
    let lastStatus = payment?.status || PaymentStatus.PENDING;
    let lastProviderStatus: Awaited<
      ReturnType<typeof gateway.getPaymentStatus>
    > | null = null;

    for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
      this.log(`Deuna poll ${attempt}/${POLL_ATTEMPTS}`, { deunaReference });

      try {
        lastProviderStatus = await gateway.getPaymentStatus(
          PaymentProvider.DEUNA,
          deunaReference
        );
        lastStatus = lastProviderStatus.status;
      } catch (error: any) {
        this.logError(`Poll attempt ${attempt} failed`, error);
        lastStatus = PaymentStatus.PENDING;
      }

      attempts.push({
        attempt,
        status: lastStatus,
        at: new Date().toISOString(),
      });

      if (isTerminal(lastStatus)) {
        this.log('Terminal status, stopping poll', { lastStatus, attempt });
        break;
      }

      if (attempt < POLL_ATTEMPTS) {
        await sleep(POLL_INTERVAL_MS);
      }
    }

    let applied = false;
    let alreadyProcessed = false;
    let newBalance: number | undefined;

    if (lastStatus === PaymentStatus.APPROVED && payment) {
      const result = await applyApprovedPayment(payment, {
        transferNumber: lastProviderStatus?.metadata?.transferNumber,
        customerName: lastProviderStatus?.customerInfo?.name,
        customerIdentification: lastProviderStatus?.customerInfo?.identification,
        paidAt: lastProviderStatus?.paidAt,
        providerPayload: lastProviderStatus?.metadata,
      });

      applied = !result.alreadyProcessed;
      alreadyProcessed = result.alreadyProcessed;
      newBalance = result.newBalance;
    } else if (payment && lastStatus !== payment.status) {
      await repo.updatePaymentStatus(payment.id, lastStatus as PaymentStatus);
    }

    return {
      paymentId: lastProviderStatus?.paymentId || payment?.payment_id || paymentId,
      status: lastStatus,
      amount:
        lastProviderStatus?.amount ??
        (payment ? parseFloat(payment.amount.toString()) : 0),
      attempts,
      applied,
      alreadyProcessed,
      newBalance,
      customerInfo: lastProviderStatus?.customerInfo,
      metadata: lastProviderStatus?.metadata,
    };
  }

  private async findLocalPayment(paymentId: string): Promise<PaymentRecord | null> {
    const repo = getPaymentRepository();
    return (
      (await repo.findByPaymentId(paymentId)) ||
      (await repo.findByInternalReference(paymentId)) ||
      (await repo.findById(paymentId))
    );
  }
}

export const pollPaymentUseCase = new PollPaymentUseCase();
