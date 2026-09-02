/**
 * POST /api/payments/refund
 * Procesa la devolución de un pago
 */

import { NextRequest, NextResponse } from 'next/server';
import { refundPaymentUseCase, UseCaseError } from '@/lib/use-cases';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticación
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Parsear request body
    const body = await req.json();
    const { paymentId, reason, amount } = body;

    console.log('[Payment Refund] Processing refund', {
      paymentId,
      userId: user.id,
      reason,
      amount,
    });

    // 3. Ejecutar use case
    const result = await refundPaymentUseCase.run({
      userId: user.id,
      paymentId,
      reason,
      amount: amount ? parseFloat(amount) : undefined,
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Payment Refund] Error:', error);

    // Manejar UseCaseError específicamente
    if (error.name === 'UseCaseError') {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor', detail: error.message },
      { status: 500 }
    );
  }
}
