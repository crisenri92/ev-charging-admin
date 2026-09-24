/**
 * POST /api/charging/initiate
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFromRequest, supabaseAdmin, apiError, checkRateLimit } from '@/lib/api-helpers'
import { getCurrentPrice } from '@/lib/pricing'
import { getPaymentRepository } from '@/lib/database/payment-repository'
import { initializePaymentGateway } from '@/lib/payments'
// Import types from core directly to avoid transitive dependency failures (e.g. Stripe SDK missing)
import { PaymentContext, PaymentProvider } from '@/lib/payments/core/payment-types'

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuthFromRequest(req)

    if (!checkRateLimit(`initiate:${user.id}`, 5))
      return apiError('Demasiadas solicitudes. Espera un minuto.', 429)

    const supabase = supabaseAdmin()
    const body = await req.json()
    const { chargerId, provider, estimatedKwh = 10 } = body

    if (!chargerId || !provider) {
      return NextResponse.json({ error: 'Faltan campos requeridos: chargerId, provider' }, { status: 400 })
    }

    const { data: charger } = await supabase
      .from('chargers')
      .select('id, name, status')
      .eq('id', chargerId)
      .single()

    if (!charger) {
      return NextResponse.json({ error: 'Cargador no encontrado' }, { status: 404 })
    }

    if (charger.status !== 'Available') {
      return NextResponse.json({ error: `Cargador no disponible (status: ${charger.status})` }, { status: 400 })
    }

    const { price: pricePerKwh, ruleName } = await getCurrentPrice(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const estimatedAmount = parseFloat((estimatedKwh * pricePerKwh).toFixed(2))

    const gateway = initializePaymentGateway()
    const repo = getPaymentRepository()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ev-charging-admin-production.up.railway.app'

    const metadata: any = {
      userId: user.id,
      context: PaymentContext.DIRECT_CHARGE,
      chargerId,
      chargerName: charger.name,
      estimatedKwh,
      pricePerKwh,
      pricingRule: ruleName,
      description: `Carga en ${charger.name} - ~${estimatedKwh} kWh`,
    }

    const paymentResponse = await gateway.createPayment({
      provider,
      amount: estimatedAmount,
      metadata,
      expirationMinutes: provider === PaymentProvider.WALLET ? undefined : 10,
      callbackUrl: `${appUrl}/mobile/charging/${chargerId}?payment=pending`,
    })

    if (!paymentResponse.success) {
      console.error('[Charging Initiate] Payment creation failed:', paymentResponse.error)
      return NextResponse.json({ error: paymentResponse.error || 'Error al crear pago' }, { status: 500 })
    }

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
    })

    if (provider === PaymentProvider.DEUNA) {
      await repo.createDeunaTransaction({
        paymentId: dbPayment.id,
        transactionId: paymentResponse.paymentId,
        internalReference: paymentResponse.metadata?.internalReference || paymentResponse.paymentId,
        pointOfSale: process.env.DEUNA_POINT_OF_SALE,
      })
    }

    if (provider === PaymentProvider.WALLET && paymentResponse.status === 'approved') {
      await repo.createChargingAuthorization(user.id, chargerId, dbPayment.id, estimatedAmount, 'wallet', 30)
      console.log('[Charging Initiate] Wallet authorization created')

      return NextResponse.json({
        success: true,
        authorized: true,
        payment: { id: dbPayment.id, paymentId: paymentResponse.paymentId, provider, amount: estimatedAmount, status: 'approved' },
        charger: { id: charger.id, name: charger.name },
        pricing: { estimatedKwh, pricePerKwh, estimatedAmount, pricingRule: ruleName },
      })
    }

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
        qrCode: paymentResponse.qrCode,
        deeplink: paymentResponse.deeplink,
        numericCode: paymentResponse.numericCode,
        checkoutUrl: paymentResponse.checkoutUrl,
        expiresAt: paymentResponse.expiresAt,
      },
      charger: { id: charger.id, name: charger.name },
      pricing: { estimatedKwh, pricePerKwh, estimatedAmount, pricingRule: ruleName },
    })

  } catch (error: any) {
    // Pass through auth errors (requireAuthFromRequest throws a NextResponse on 401)
    if (error instanceof Response) return error
    console.error('[Charging Initiate] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor', detail: error.message }, { status: 500 })
  }
}
