/**
 * GET /api/payments/status/[paymentId]
 * Consulta el estado actual de un pago
 * REFACTORIZADO: Usa CheckPaymentStatusUseCase
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkPaymentStatusUseCase, UseCaseError } from '@/lib/use-cases';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { paymentId: string } }
) {
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

    const { paymentId } = params;

    console.log('[Payment Status] Checking status', { paymentId, userId: user.id });

    // 2. Ejecutar use case
    const result = await checkPaymentStatusUseCase.run({
      userId: user.id,
      paymentId,
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Payment Status] Error:', error);

    // Manejar UseCaseError específicamente
    if (error.name === 'UseCaseError') {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor', detail: error.message },
      { status: 500 }
    );
  }
}
