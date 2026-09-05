/**
 * POST /api/payments/create
 * Endpoint unificado para crear pagos con cualquier provider
 * REFACTORIZADO: Usa use cases para lógica de negocio
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/api-helpers';
import { PaymentContext } from '@/lib/payments';
import { rechargeWalletUseCase, directPaymentUseCase, UseCaseError } from '@/lib/use-cases';
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
    const {
      provider,
      context,
      amount,
      chargerId,
      description,
      expirationMinutes,
      estimatedKwh,
    } = body;

    // 3. Validaciones básicas
    if (!provider || !context) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: provider, context' },
        { status: 400 }
      );
    }

    if (!Object.values(PaymentContext).includes(context)) {
      return NextResponse.json(
        { error: `Contexto inválido: ${context}` },
        { status: 400 }
      );
    }

    // 4. Rutear al use case correspondiente

    if (context === PaymentContext.WALLET_RECHARGE) {
      // Usar RechargeWalletUseCase
      const result = await rechargeWalletUseCase.run({
        userId: user.id,
        provider,
        amount: parseFloat(amount),
        description,
        expirationMinutes,
      });

      return NextResponse.json(result);

    } else if (context === PaymentContext.DIRECT_CHARGE) {
      // Usar DirectPaymentUseCase
      const result = await directPaymentUseCase.run({
        userId: user.id,
        chargerId,
        provider,
        estimatedKwh: estimatedKwh || 10,
      });

      return NextResponse.json(result);

    } else {
      return NextResponse.json(
        { error: 'Contexto no soportado' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('[Payment Create] Error:', error);

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
