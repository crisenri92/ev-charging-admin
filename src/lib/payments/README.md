# Sistema de Pagos - Arquitectura

Sistema modular de pagos con **Strategy Pattern** que permite múltiples proveedores de pago de forma escalable y mantenible.

## 📐 Arquitectura

```
┌─────────────────────────────────────────────┐
│         PaymentGateway (Orchestrator)       │
│  • Registra estrategias                     │
│  • Orquesta pagos                           │
│  • Maneja webhooks                          │
└─────────────────┬───────────────────────────┘
                  │
      ┌───────────┼───────────┐
      ↓           ↓           ↓
┌──────────┐ ┌─────────┐ ┌──────────┐
│  Deuna   │ │ Stripe  │ │  Wallet  │
│ Strategy │ │Strategy │ │ Strategy │
└──────────┘ └─────────┘ └──────────┘
```

## 🎯 Casos de Uso

### 1. Recarga de Wallet
Usuario recarga saldo en su wallet interno usando Deuna o Stripe.

**Providers soportados:**
- ✅ Deuna (QR + Link)
- ✅ Stripe (Checkout)

### 2. Pago Directo por Carga
Usuario paga directamente cada carga con su método preferido.

**Providers soportados:**
- ✅ Deuna (QR + Link + Código)
- ✅ Wallet (saldo prepagado)

## 📦 Estructura de Archivos

```
src/lib/payments/
├── core/
│   ├── payment-types.ts              # Types compartidos
│   ├── payment-strategy.interface.ts # Interface base
│   └── payment-gateway.ts            # Orchestrator
├── strategies/
│   ├── deuna/
│   │   ├── deuna-client.ts          # HTTP client
│   │   └── deuna.strategy.ts        # Implementación
│   ├── stripe/
│   │   └── stripe.strategy.ts       # Implementación
│   └── wallet/
│       └── wallet.strategy.ts       # Implementación
├── index.ts                          # Public API
└── README.md                         # Este archivo
```

## 🚀 Uso

### Inicialización

```typescript
import { initializePaymentGateway } from '@/lib/payments';

// En el arranque de la app (o en un API route)
const gateway = initializePaymentGateway();
```

### Crear un Pago

```typescript
import { 
  PaymentGateway, 
  PaymentProvider, 
  PaymentContext,
  CreatePaymentRequest 
} from '@/lib/payments';

const gateway = PaymentGateway.getInstance();

// Ejemplo 1: Recarga de wallet con Deuna
const rechargeRequest: CreatePaymentRequest = {
  provider: PaymentProvider.DEUNA,
  amount: 20.00,
  metadata: {
    userId: 'user-123',
    context: PaymentContext.WALLET_RECHARGE,
    description: 'Recarga de $20.00',
  },
  expirationMinutes: 30,
};

const response = await gateway.createPayment(rechargeRequest);

if (response.success) {
  console.log('QR Code:', response.qrCode);
  console.log('Payment Link:', response.deeplink);
  console.log('Payment ID:', response.paymentId);
}

// Ejemplo 2: Pago directo de carga con Deuna
const directPaymentRequest: CreatePaymentRequest = {
  provider: PaymentProvider.DEUNA,
  amount: 5.50,
  metadata: {
    userId: 'user-123',
    context: PaymentContext.DIRECT_CHARGE,
    chargerId: 'CHARGER001',
    chargerName: 'Cargador Norte',
    description: 'Carga en Cargador Norte',
  },
  expirationMinutes: 10,
};

const chargeResponse = await gateway.createPayment(directPaymentRequest);
```

### Consultar Estado de Pago

```typescript
const status = await gateway.getPaymentStatus(
  PaymentProvider.DEUNA,
  'payment-id-or-reference'
);

console.log('Status:', status.status); // 'pending' | 'approved' | 'failed'
console.log('Amount:', status.amount);
console.log('Paid at:', status.paidAt);
```

### Procesar Webhook

```typescript
import { PaymentProvider } from '@/lib/payments';

export async function POST(req: Request) {
  const gateway = PaymentGateway.getInstance();
  
  const headers = Object.fromEntries(req.headers);
  const body = await req.json();

  try {
    const event = await gateway.handleWebhook(
      PaymentProvider.DEUNA,
      headers,
      body
    );

    // Procesar el evento según el status
    if (event.status === PaymentStatus.APPROVED) {
      // Acreditar saldo o autorizar carga
      console.log('Payment approved:', event.paymentId);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: 'Invalid webhook' }, { status: 400 });
  }
}
```

### Listar Providers Disponibles

```typescript
// Todos los providers
const all = gateway.getAvailableProviders();
console.log('Available:', all); // ['deuna', 'stripe', 'wallet']

// Solo para un contexto específico
const rechargeProviders = gateway.getAvailableProviders(
  PaymentContext.WALLET_RECHARGE
);
console.log('For recharge:', rechargeProviders); // ['deuna', 'stripe']

const directProviders = gateway.getAvailableProviders(
  PaymentContext.DIRECT_CHARGE
);
console.log('For direct:', directProviders); // ['deuna', 'wallet']
```

### Health Check

```typescript
const health = gateway.getHealthStatus();
console.log(health);
// {
//   deuna: { configured: true, supportedContexts: ['wallet_recharge', 'direct_charge'] },
//   stripe: { configured: true, supportedContexts: ['wallet_recharge'] },
//   wallet: { configured: true, supportedContexts: ['direct_charge'] }
// }
```

## 🔧 Variables de Entorno

```bash
# Deuna
DEUNA_API_KEY=your-api-key
DEUNA_API_SECRET=your-api-secret
DEUNA_POINT_OF_SALE=your-pos-code
DEUNA_BASE_URL=https://apis-merchant.pdn.deunalab.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase (para Wallet)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## ➕ Agregar un Nuevo Provider

1. **Crear la estrategia:**

```typescript
// src/lib/payments/strategies/kushki/kushki.strategy.ts
import { IPaymentStrategy } from '../../core/payment-strategy.interface';

export class KushkiPaymentStrategy implements IPaymentStrategy {
  readonly provider = PaymentProvider.KUSHKI;
  readonly name = 'Kushki';
  readonly supportedContexts = [PaymentContext.WALLET_RECHARGE];

  initialize(config?: Record<string, any>): void {
    // Inicializar cliente Kushki
  }

  isConfigured(): boolean {
    // Verificar configuración
    return true;
  }

  supportsContext(context: PaymentContext): boolean {
    return this.supportedContexts.includes(context);
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    // Implementar creación de pago
  }

  // ... implementar otros métodos requeridos
}
```

2. **Registrar en el gateway:**

```typescript
// src/lib/payments/index.ts
import { KushkiPaymentStrategy } from './strategies/kushki/kushki.strategy';

export function initializePaymentGateway(): PaymentGateway {
  // ... código existente

  // Agregar Kushki
  try {
    const kushkiStrategy = new KushkiPaymentStrategy();
    kushkiStrategy.initialize();
    gateway.registerStrategy(kushkiStrategy);
  } catch (error) {
    console.error('[Payment System] Failed to initialize Kushki:', error);
  }

  return gateway;
}
```

3. **Listo!** El nuevo provider está disponible automáticamente.

## 🎨 Patterns Utilizados

- **Strategy Pattern**: Cada provider es una estrategia intercambiable
- **Singleton Pattern**: El gateway es único en la aplicación
- **Factory Pattern**: El gateway actúa como factory de estrategias
- **Dependency Injection**: Las estrategias reciben configuración al inicializar

## ✅ Ventajas

1. **Escalable**: Agregar providers sin modificar código existente
2. **Separación de responsabilidades**: Cada strategy es independiente
3. **Testeable**: Cada strategy se puede testear aisladamente
4. **Type-safe**: TypeScript garantiza contratos
5. **Flexible**: Un provider puede soportar múltiples contextos
6. **Resiliente**: Si un provider falla, los otros siguen funcionando

## 📝 Próximos Pasos

- [ ] Implementar use cases (RechargeWalletUseCase, DirectPaymentUseCase)
- [ ] Crear API endpoints unificados
- [ ] Implementar frontend components
- [ ] Agregar tests unitarios
- [ ] Agregar logging estructurado
- [ ] Agregar retry logic para webhooks
