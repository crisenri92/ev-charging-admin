# Ejemplos de Uso del Sistema de Pagos

## 📦 Escenarios Completos

### Escenario 1: Usuario recarga wallet con Deuna

```typescript
import { 
  PaymentGateway, 
  PaymentProvider, 
  PaymentContext,
  initializePaymentGateway 
} from '@/lib/payments';

// 1. Inicializar gateway (una vez en la app)
const gateway = initializePaymentGateway();

// 2. Usuario elige monto y método de pago
const amount = 20.00;
const userId = 'user-abc-123';

// 3. Crear solicitud de pago
const paymentRequest = {
  provider: PaymentProvider.DEUNA,
  amount,
  metadata: {
    userId,
    context: PaymentContext.WALLET_RECHARGE,
    description: `Recarga de wallet $${amount}`,
  },
  expirationMinutes: 30,
  callbackUrl: 'https://mi-app.com/wallet?recharge=pending',
};

// 4. Crear pago
const response = await gateway.createPayment(paymentRequest);

if (response.success) {
  // 5. Mostrar QR y link al usuario
  console.log('✅ Pago creado');
  console.log('Payment ID:', response.paymentId);
  console.log('QR Code (SVG):', response.qrCode);
  console.log('Payment Link:', response.deeplink);
  console.log('Numeric Code:', response.numericCode);
  console.log('Expira:', response.expiresAt);
  
  // Guardar en BD local para tracking
  await savePaymentToDatabase({
    paymentId: response.paymentId,
    userId,
    amount,
    provider: PaymentProvider.DEUNA,
    context: PaymentContext.WALLET_RECHARGE,
    status: 'pending',
    metadata: response.metadata,
  });
  
  // Retornar al frontend para mostrar QR
  return {
    qrCode: response.qrCode,
    paymentLink: response.deeplink,
    numericCode: response.numericCode,
    expiresAt: response.expiresAt,
  };
} else {
  console.error('❌ Error:', response.error);
  throw new Error(response.error);
}
```

### Escenario 2: Procesar webhook de Deuna (pago confirmado)

```typescript
// src/app/api/payments/webhooks/deuna/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PaymentGateway, PaymentProvider, PaymentStatus } from '@/lib/payments';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const gateway = PaymentGateway.getInstance();
    
    // 1. Obtener headers y body
    const headers = Object.fromEntries(req.headers);
    const body = await req.json();
    
    console.log('[Deuna Webhook] Received:', body);

    // 2. Procesar webhook (valida y parsea)
    const event = await gateway.handleWebhook(
      PaymentProvider.DEUNA,
      headers,
      body
    );

    console.log('[Deuna Webhook] Event:', event);

    // 3. Buscar pago en nuestra BD
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_id', event.paymentId)
      .single();

    if (!payment) {
      console.error('[Deuna Webhook] Payment not found:', event.paymentId);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // 4. Si ya fue procesado, evitar duplicados
    if (payment.status === 'approved') {
      console.log('[Deuna Webhook] Already processed');
      return NextResponse.json({ received: true, message: 'Already processed' });
    }

    // 5. Procesar según el contexto
    if (payment.context === 'wallet_recharge') {
      // RECARGA DE WALLET
      if (event.status === PaymentStatus.APPROVED) {
        // Obtener saldo actual
        const { data: balanceRow } = await supabase
          .from('user_balances')
          .select('balance')
          .eq('user_id', payment.user_id)
          .single();

        const currentBalance = balanceRow?.balance || 0;
        const newBalance = currentBalance + event.amount;

        // Actualizar saldo
        await supabase.from('user_balances').upsert({
          user_id: payment.user_id,
          balance: newBalance,
          currency: 'USD',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        // Registrar transacción
        await supabase.from('balance_transactions').insert({
          user_id: payment.user_id,
          amount: event.amount,
          type: 'recharge',
          description: `Recarga vía Deuna - $${event.amount}`,
          payment_gateway: 'deuna',
          balance_before: currentBalance,
          balance_after: newBalance,
          gateway_metadata: event.rawPayload,
        });

        // Actualizar estado del pago
        await supabase.from('payments').update({
          status: 'approved',
          paid_at: new Date().toISOString(),
          customer_info: event.rawPayload.customerName,
        }).eq('id', payment.id);

        console.log(`[Deuna Webhook] ✅ $${event.amount} acreditado a ${payment.user_id}`);
      }
    } else if (payment.context === 'direct_charge') {
      // PAGO DIRECTO POR CARGA
      if (event.status === PaymentStatus.APPROVED) {
        // Marcar pago como aprobado
        await supabase.from('payments').update({
          status: 'approved',
          paid_at: new Date().toISOString(),
        }).eq('id', payment.id);

        // Autorizar inicio de carga
        await supabase.from('charging_authorizations').insert({
          user_id: payment.user_id,
          charger_id: payment.metadata.chargerId,
          payment_id: payment.id,
          authorized_at: new Date().toISOString(),
          amount_paid: event.amount,
        });

        console.log(`[Deuna Webhook] ✅ Carga autorizada para ${payment.metadata.chargerId}`);
      }
    }

    return NextResponse.json({ received: true, status: 'processed' });

  } catch (error: any) {
    console.error('[Deuna Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', detail: error.message },
      { status: 500 }
    );
  }
}
```

### Escenario 3: Usuario paga carga directamente con Deuna

```typescript
// Frontend: Usuario escanea QR del cargador
const chargerId = 'CHARGER001';
const chargerName = 'Cargador Norte';
const estimatedAmount = 5.50; // Estimado basado en kWh esperados

// 1. Crear pago directo
const gateway = PaymentGateway.getInstance();

const paymentRequest = {
  provider: PaymentProvider.DEUNA,
  amount: estimatedAmount,
  metadata: {
    userId: currentUser.id,
    context: PaymentContext.DIRECT_CHARGE,
    chargerId,
    chargerName,
    estimatedKwh: 10,
    pricePerKwh: 0.55,
    description: `Carga en ${chargerName}`,
  },
  expirationMinutes: 10, // Más urgente
};

const response = await gateway.createPayment(paymentRequest);

if (response.success) {
  // 2. Mostrar modal con QR al usuario
  showPaymentModal({
    qrCode: response.qrCode,
    paymentLink: response.deeplink,
    numericCode: response.numericCode,
    amount: estimatedAmount,
    chargerName,
    expiresIn: 10,
  });

  // 3. Polling para verificar si pagó
  const pollInterval = setInterval(async () => {
    const status = await gateway.getPaymentStatus(
      PaymentProvider.DEUNA,
      response.paymentId
    );

    if (status.status === PaymentStatus.APPROVED) {
      clearInterval(pollInterval);
      
      // 4. Pago confirmado, iniciar carga
      showSuccess('Pago confirmado! Iniciando carga...');
      
      // 5. Llamar a API para iniciar carga física
      await fetch('/api/charging/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargerId,
          paymentId: response.paymentId,
        }),
      });
      
      navigateTo(`/charging/${chargerId}/active`);
    }
  }, 3000); // Cada 3 segundos

  // Timeout después de 10 minutos
  setTimeout(() => {
    clearInterval(pollInterval);
    showError('El pago expiró. Intenta nuevamente.');
  }, 10 * 60 * 1000);
}
```

### Escenario 4: Usuario paga carga con Wallet

```typescript
// Usuario elige pagar con wallet (saldo prepagado)
const gateway = PaymentGateway.getInstance();

const paymentRequest = {
  provider: PaymentProvider.WALLET,
  amount: 5.50,
  metadata: {
    userId: currentUser.id,
    context: PaymentContext.DIRECT_CHARGE,
    chargerId: 'CHARGER001',
    chargerName: 'Cargador Norte',
    description: 'Carga con wallet',
  },
};

const response = await gateway.createPayment(paymentRequest);

if (response.success) {
  // Wallet es instantáneo, el pago ya está aprobado
  console.log('✅ Pago aprobado con wallet');
  console.log('Saldo restante:', response.metadata?.balanceAfter);
  
  // Iniciar carga inmediatamente
  await fetch('/api/charging/start', {
    method: 'POST',
    body: JSON.stringify({
      chargerId: 'CHARGER001',
      paymentId: response.paymentId,
      provider: 'wallet',
    }),
  });
} else {
  // Saldo insuficiente
  showError(response.error); // "Saldo insuficiente. Disponible: $3.00, Requerido: $5.50"
  
  // Ofrecer recargar
  showRechargeModal();
}
```

### Escenario 5: Consultar estado de un pago

```typescript
// Endpoint para que el frontend haga polling
// GET /api/payments/status/[paymentId]

import { NextRequest, NextResponse } from 'next/server';
import { PaymentGateway, PaymentProvider } from '@/lib/payments';

export async function GET(
  req: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  const gateway = PaymentGateway.getInstance();
  const { paymentId } = params;

  // Buscar en BD para saber qué provider usar
  const { data: payment } = await supabase
    .from('payments')
    .select('provider, internal_reference')
    .eq('payment_id', paymentId)
    .single();

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  try {
    const status = await gateway.getPaymentStatus(
      payment.provider as PaymentProvider,
      payment.internal_reference // Para Deuna usamos internal reference
    );

    return NextResponse.json({
      paymentId,
      status: status.status,
      amount: status.amount,
      paidAt: status.paidAt,
      customerInfo: status.customerInfo,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Escenario 6: Cancelar un pago (devolución)

```typescript
// Solo funciona dentro de 24 horas para Deuna
const gateway = PaymentGateway.getInstance();

const success = await gateway.cancelPayment(
  PaymentProvider.DEUNA,
  'internal-reference-123',
  'Cliente solicitó cancelación'
);

if (success) {
  console.log('✅ Pago cancelado y reembolsado');
  
  // Actualizar BD
  await supabase.from('payments').update({
    status: 'reversed',
    reversed_at: new Date().toISOString(),
  }).eq('internal_reference', 'internal-reference-123');
  
} else {
  console.error('❌ No se pudo cancelar el pago (puede ser > 24 hrs)');
}
```

## 🧪 Testing

### Test de una estrategia

```typescript
import { DeunaPaymentStrategy } from '@/lib/payments/strategies/deuna/deuna.strategy';
import { PaymentContext, PaymentProvider } from '@/lib/payments';

describe('DeunaPaymentStrategy', () => {
  let strategy: DeunaPaymentStrategy;

  beforeEach(() => {
    strategy = new DeunaPaymentStrategy();
    strategy.initialize({
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      pointOfSale: '123',
      baseUrl: 'https://apis-merchant.qa.deunalab.com',
    });
  });

  it('should create a payment successfully', async () => {
    const request = {
      provider: PaymentProvider.DEUNA,
      amount: 10.00,
      metadata: {
        userId: 'test-user',
        context: PaymentContext.WALLET_RECHARGE,
        description: 'Test payment',
      },
    };

    const response = await strategy.createPayment(request);

    expect(response.success).toBe(true);
    expect(response.paymentId).toBeDefined();
    expect(response.qrCode).toBeDefined();
  });

  it('should support wallet recharge context', () => {
    expect(strategy.supportsContext(PaymentContext.WALLET_RECHARGE)).toBe(true);
  });
});
```
