/**
 * POST /api/payments/poll
 * Consulta Deuna 5 veces, cada 15 segundos, y acredita si ya está aprobado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pollPaymentUseCase, UseCaseError } from '@/lib/use-cases';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 90;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const paymentId = body.paymentId || body.internalReference;

    if (!paymentId) {
      return NextResponse.json(
        { error: 'paymentId es requerido' },
        { status: 400 }
      );
    }


    const result = await pollPaymentUseCase.run({
      userId: user.id,
      paymentId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Payment Poll] Error:', error);

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
