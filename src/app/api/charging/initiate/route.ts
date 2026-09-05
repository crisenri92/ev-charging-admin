/**
 * POST /api/charging/initiate
 * Inicia el proceso de carga con pago
 * 1. Usuario selecciona método de pago
 * 2. Si es Deuna/Stripe: Genera QR/Link de pago
 * 3. Si es Wallet: Valida saldo y crea autorización inmediata
 */

import { NextRequest } from 'next/server'
import { requireAuth, supabaseAdmin, apiError } from '@/lib/api-helpers'
import { getCurrentPrice } from '@/lib/pricing'
import { getPaymentRepository } from '@/lib/database/payment-repository'
import { getPaymentsLib } from '@/lib/payments'

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticación
    const authHeader = req.headers.get('authorization');
      const { user } = await requireAuth()
      const supabase = supabaseAdmin()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Parsear request
    const body = await req.json();
    const {
      chargerId,
      provider,
      estimatedKwh = 10, // Estimación por defecto
    } = body;

    if (!chargerId || !provider) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: chargerId, provider' },
        { status: 400 }
      );
    }

    // 3. Obtener info del cargador
    const { data: charger } = await supabase
      .from('chargers')
      .select('id, name, status')
      .eq('id', chargerId)
      .single();

    if (!charger) {
      return NextResponse.json(
        { error: 'Cargador no encontrado' },
        { status: 404 }
      );
    }

    if (charger.status !== 'Available') {
      return NextResponse.json(
        { error: `Cargador no disponible (status: ${charger.status})` },
        { status: 400 }
      );
    }

    // 4. Calcular precio estimado
    const { price: pricePerKwh, ruleName } = await getCurrentPrice(
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const estimatedAmount = parseFloat((estimatedKwh * pricePerKwh).toFixed(2));

    console.log('[Charging Initiate] Initiating charge:', {
      chargerId,
      provider,
      estimatedKwh,
      pricePerKwh,
      estimatedAmount,
    });

    // 5. Crear pago
    const gateway = initializePaymentGateway();
    const repo = getPaymentRepository();

    const metadata: any = {
      userId: user.id,
      context: PaymentContext.DIRECT_CHARGE,
      chargerId,
      chargerName: charger.name,
      estimatedKwh,
      pricePerKwh,
      pricingRule: ruleName,
      description: `Carga en ${charger.name} - ~${estimatedKwh} kWh`,
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
      'https://ev-charging-admin-production.up.railway.app';

    const paymentResponse = await gateway.createPayment({
      provider,
      amount: estimatedAmount,
      metadata,
      expirationMinutes: provider === PaymentProvider.WALLET ? undefined : 10, // 10 min para Deuna
      callbackUrl: `${appUrl}/mobile/charging/${chargerId}?payment=pending`,
    });

    if (!paymentResponse.success) {
      console.error('[Charging Initiate] Payment creation failed:', paymentResponse.error);
      return NextResponse.json(
        { error: paymentResponse.error || 'Error al crear pago' },
        { status: 500 }
      );
    }

    // 6. Guardar en BD
    const dbPayment = await repo.createPayment({
      paymentId: paymentResponse.paymentId,
      internalReference: paymentResponse.metadata?.internalReference || paymentResponse.paymentId,
      userId: user.id,
      provider,
      context: PaymentContext.DIRECT_CHARGE,
      amount: estimatedAmount,
      description: metadata.description,
      metadata: paymentResponse.metadata,
      qrCode: paymentResponse.qrCode,
      deeplink: paymentResponse.deeplink,
      numericCode: paymentResponse.numericCode,
      checkoutUrl: paymentResponse.checkoutUrl,
      expiresAt: paymentResponse.expiresAt,
    });

    // 7. Si es Deuna, crear registro específico
    if (provider === PaymentProvider.DEUNA) {
      await repo.createDeunaTransaction({
        paymentId: dbPayment.id,
        transactionId: paymentResponse.paymentId,
        internalReference: paymentResponse.metadata?.internalReference || paymentResponse.paymentId,
        pointOfSale: process.env.DEUNA_POINT_OF_SALE,
      });
    }

    // 8. Si es Wallet, crear autorización inmediata
    if (provider === PaymentProvider.WALLET && paymentResponse.status === 'approved') {
      await repo.createChargingAuthorization(
        user.id,
        chargerId,
        dbPayment.id,
        estimatedAmount,
        'wallet',
        30 // 30 minutos de validez
      );

      console.log('[Charging Initiate] ✅ Wallet authorization created immediately');

      return NextResponse.json({
        success: true,
        authorized: true,
        payment: {
          id: dbPayment.id,
          paymentId: paymentResponse.paymentId,
          provider,
          amount: estimatedAmount,
          status: 'approved',
        },
        charger: {
          id: charger.id,
          name: charger.name,
        },
        pricing: {
          estimatedKwh,
          pricePerKwh,
          estimatedAmount,
          pricingRule: ruleName,
        },
      });
    }

    // 9. Para Deuna/Stripe, retornar métodos de pago
    console.log('[Charging Initiate] ✅ Payment created, waiting for confirmation');

    return NextResponse.json({
      success: true,
      authorized: false,
      waitingForPayment: true,
      payment: {
        id: dbPayment.id,
        paymentId: paymentResponse.paymentId,
        provider,
        amount: estimatedAmount,
        status: paymentResponse.status,
        
        // Métodos de pago
        qrCode: paymentResponse.qrCode,
        deeplink: paymentResponse.deeplink,
        numericCode: paymentResponse.numericCode,
        checkoutUrl: paymentResponse.checkoutUrl,
        
        expiresAt: paymentResponse.expiresAt,
      },
      charger: {
        id: charger.id,
        name: charger.name,
      },
      pricing: {
        estimatedKwh,
        pricePerKwh,
        estimatedAmount,
        pricingRule: ruleName,
      },
    });

  } catch (error: any) {
    console.error('[Charging Initiate] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', detail: error.message },
      { status: 500 }
    );
  }
}
