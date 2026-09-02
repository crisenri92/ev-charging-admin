/**
 * GET /api/test-use-cases
 * Endpoint de testing para verificar que los use cases funcionan
 */

import { NextResponse } from 'next/server';
import {
  rechargeWalletUseCase,
  directPaymentUseCase,
  checkPaymentStatusUseCase,
} from '@/lib/use-cases';
import { PaymentProvider } from '@/lib/payments';

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
    },
  };

  // ============================================
  // TEST 1: RechargeWalletUseCase - Validación
  // ============================================
  results.tests.push({
    name: 'RechargeWalletUseCase - Validation',
    test: 'Should reject amount < $1.00',
    status: 'running',
  });

  try {
    await rechargeWalletUseCase.run({
      userId: 'test-user-123',
      provider: PaymentProvider.DEUNA,
      amount: 0.50,
    });
    
    // Si llega aquí, la validación falló
    results.tests[results.tests.length - 1].status = 'failed';
    results.tests[results.tests.length - 1].error = 'Should have thrown validation error';
    results.summary.failed++;
  } catch (error: any) {
    if (error.name === 'UseCaseError' && error.code === 'AMOUNT_TOO_LOW') {
      results.tests[results.tests.length - 1].status = 'passed';
      results.tests[results.tests.length - 1].message = 'Validation working correctly';
      results.summary.passed++;
    } else {
      results.tests[results.tests.length - 1].status = 'failed';
      results.tests[results.tests.length - 1].error = error.message;
      results.summary.failed++;
    }
  }

  results.summary.total++;

  // ============================================
  // TEST 2: RechargeWalletUseCase - Max amount
  // ============================================
  results.tests.push({
    name: 'RechargeWalletUseCase - Validation',
    test: 'Should reject amount > $1000.00',
    status: 'running',
  });

  try {
    await rechargeWalletUseCase.run({
      userId: 'test-user-123',
      provider: PaymentProvider.DEUNA,
      amount: 1500.00,
    });
    
    results.tests[results.tests.length - 1].status = 'failed';
    results.tests[results.tests.length - 1].error = 'Should have thrown validation error';
    results.summary.failed++;
  } catch (error: any) {
    if (error.name === 'UseCaseError' && error.code === 'AMOUNT_TOO_HIGH') {
      results.tests[results.tests.length - 1].status = 'passed';
      results.tests[results.tests.length - 1].message = 'Max validation working correctly';
      results.summary.passed++;
    } else {
      results.tests[results.tests.length - 1].status = 'failed';
      results.tests[results.tests.length - 1].error = error.message;
      results.summary.failed++;
    }
  }

  results.summary.total++;

  // ============================================
  // TEST 3: DirectPaymentUseCase - Missing charger
  // ============================================
  results.tests.push({
    name: 'DirectPaymentUseCase - Validation',
    test: 'Should reject missing chargerId',
    status: 'running',
  });

  try {
    await directPaymentUseCase.run({
      userId: 'test-user-123',
      chargerId: '',
      provider: PaymentProvider.DEUNA,
    });
    
    results.tests[results.tests.length - 1].status = 'failed';
    results.tests[results.tests.length - 1].error = 'Should have thrown validation error';
    results.summary.failed++;
  } catch (error: any) {
    if (error.name === 'UseCaseError' && error.code === 'MISSING_CHARGER_ID') {
      results.tests[results.tests.length - 1].status = 'passed';
      results.tests[results.tests.length - 1].message = 'ChargerId validation working';
      results.summary.passed++;
    } else {
      results.tests[results.tests.length - 1].status = 'failed';
      results.tests[results.tests.length - 1].error = error.message;
      results.summary.failed++;
    }
  }

  results.summary.total++;

  // ============================================
  // TEST 4: CheckPaymentStatusUseCase - Not found
  // ============================================
  results.tests.push({
    name: 'CheckPaymentStatusUseCase - Validation',
    test: 'Should handle payment not found',
    status: 'running',
  });

  try {
    await checkPaymentStatusUseCase.run({
      userId: 'test-user-123',
      paymentId: 'non-existent-payment-id',
    });
    
    results.tests[results.tests.length - 1].status = 'failed';
    results.tests[results.tests.length - 1].error = 'Should have thrown not found error';
    results.summary.failed++;
  } catch (error: any) {
    if (error.name === 'UseCaseError' && error.code === 'PAYMENT_NOT_FOUND') {
      results.tests[results.tests.length - 1].status = 'passed';
      results.tests[results.tests.length - 1].message = 'Not found handling working';
      results.summary.passed++;
    } else {
      results.tests[results.tests.length - 1].status = 'failed';
      results.tests[results.tests.length - 1].error = error.message;
      results.summary.failed++;
    }
  }

  results.summary.total++;

  // ============================================
  // TEST 5: Use Case Instances
  // ============================================
  results.tests.push({
    name: 'Use Case Instances',
    test: 'All use cases are properly exported',
    status: 'running',
  });

  try {
    if (!rechargeWalletUseCase || !directPaymentUseCase || !checkPaymentStatusUseCase) {
      throw new Error('Some use cases are not exported');
    }
    
    results.tests[results.tests.length - 1].status = 'passed';
    results.tests[results.tests.length - 1].message = 'All use cases exported correctly';
    results.summary.passed++;
  } catch (error: any) {
    results.tests[results.tests.length - 1].status = 'failed';
    results.tests[results.tests.length - 1].error = error.message;
    results.summary.failed++;
  }

  results.summary.total++;

  // ============================================
  // SUMMARY
  // ============================================
  results.summary.allPassed = results.summary.failed === 0;
  results.summary.successRate = `${Math.round((results.summary.passed / results.summary.total) * 100)}%`;

  return NextResponse.json(results, { status: 200 });
}
