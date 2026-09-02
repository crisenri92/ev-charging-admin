# 🎯 Guía de Use Cases - Sistema de Pagos

Documentación completa de los use cases implementados en el sistema de pagos.

---

## 📋 ¿Qué es un Use Case?

Un **Use Case** encapsula la lógica de negocio compleja de una operación específica. Coordina:
- Validaciones de negocio
- Interacciones con múltiples capas (Gateway, Repository, DB)
- Manejo de errores
- Logs de auditoría
- Transacciones y consistencia

### **Arquitectura**

```
API Endpoint (HTTP)
       ↓
Use Case (Lógica de negocio)
       ↓
   ┌───┴───┐
   ↓       ↓
Gateway  Repository
   ↓       ↓
Provider  Database
```

---

## 🎨 Use Cases Disponibles

### 1. **RechargeWalletUseCase**
Coordina el proceso de recarga de wallet del usuario.

### 2. **DirectPaymentUseCase**
Coordina el pago directo para una sesión de carga.

### 3. **RefundPaymentUseCase**
Procesa devoluciones de pagos aprobados.

### 4. **CheckPaymentStatusUseCase**
Consulta el estado actual de un pago (con polling a provider).

---

## 1️⃣ RechargeWalletUseCase

### **Propósito**
Crear un pago para recargar el wallet del usuario con Deuna o Stripe.

### **Flujo**
```
1. Validar request (userId, provider, amount)
2. Crear pago con PaymentGateway
3. Guardar en base de datos (payments, deuna_transactions)
4. Retornar métodos de pago (QR, deeplink, código)
5. (Webhook acreditará saldo cuando sea confirmado)
```

### **Uso**

```typescript
import { rechargeWalletUseCase } from '@/lib/use-cases';

const result = await rechargeWalletUseCase.run({
  userId: 'user-123',
  provider: PaymentProvider.DEUNA,
  amount: 20.00,
  description: 'Recarga de wallet',  // Opcional
  expirationMinutes: 30,             // Opcional
});

console.log(result);
// {
//   success: true,
//   payment: {
//     id: 'uuid',
//     paymentId: 'deuna-txn-xxx',
//     provider: 'deuna',
//     amount: 20,
//     status: 'pending',
//     qrCode: '<svg>...</svg>',
//     deeplink: 'https://pagar.deuna.app/...',
//     numericCode: '123456',
//     expiresAt: '2024-08-30T...',
//     createdAt: '2024-08-30T...'
//   }
// }
```

### **Request**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `userId` | string | Sí | ID del usuario |
| `provider` | PaymentProvider | Sí | deuna, stripe o wallet |
| `amount` | number | Sí | Monto a recargar (USD) |
| `description` | string | No | Descripción personalizada |
| `expirationMinutes` | number | No | Minutos de expiración |

### **Response**

```typescript
{
  success: boolean;
  payment: {
    id: string;              // ID interno
    paymentId: string;       // ID del provider
    provider: string;
    amount: number;
    status: string;          // pending
    
    qrCode?: string;         // SVG del QR (Deuna)
    deeplink?: string;       // Link de pago (Deuna)
    numericCode?: string;    // Código numérico (Deuna)
    checkoutUrl?: string;    // URL de checkout (Stripe)
    
    expiresAt?: string;
    createdAt: string;
  }
}
```

### **Validaciones**

- ✅ `userId` requerido
- ✅ `provider` requerido y válido
- ✅ `amount` > 0
- ✅ `amount` >= $1.00 (mínimo)
- ✅ `amount` <= $1000.00 (máximo)

### **Errores**

| Code | Status | Descripción |
|------|--------|-------------|
| `MISSING_USER_ID` | 400 | userId no proporcionado |
| `MISSING_PROVIDER` | 400 | provider no proporcionado |
| `INVALID_PROVIDER` | 400 | Provider no válido |
| `INVALID_AMOUNT` | 400 | Amount <= 0 |
| `AMOUNT_TOO_LOW` | 400 | Amount < $1.00 |
| `AMOUNT_TOO_HIGH` | 400 | Amount > $1000.00 |
| `PAYMENT_CREATION_FAILED` | 500 | Error al crear pago |

---

## 2️⃣ DirectPaymentUseCase

### **Propósito**
Crear un pago para autorizar una sesión de carga directa (sin wallet).

### **Flujo**

```
1. Validar que el cargador existe y está disponible
2. Calcular precio estimado (kWh × precio actual)
3. Crear pago con PaymentGateway
4. Si es Wallet: autorizar inmediatamente
5. Si es Deuna: generar QR y esperar webhook
6. Guardar en BD (payments, charging_authorizations)
```

### **Uso**

```typescript
import { directPaymentUseCase } from '@/lib/use-cases';

const result = await directPaymentUseCase.run({
  userId: 'user-123',
  chargerId: 'CHARGER001',
  provider: PaymentProvider.DEUNA,
  estimatedKwh: 10,  // Opcional, default 10
});

console.log(result);
// {
//   success: true,
//   authorized: false,           // true si es wallet
//   waitingForPayment: true,     // false si es wallet
//   payment: { ... },
//   charger: { id: 'CHARGER001', name: 'Cargador Norte' },
//   pricing: {
//     estimatedKwh: 10,
//     pricePerKwh: 0.55,
//     estimatedAmount: 5.50,
//     pricingRule: 'Tarifa diurna'
//   }
// }
```

### **Request**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `userId` | string | Sí | ID del usuario |
| `chargerId` | string | Sí | ID del cargador |
| `provider` | PaymentProvider | Sí | deuna o wallet |
| `estimatedKwh` | number | No | kWh estimados (default: 10) |

### **Response**

```typescript
{
  success: boolean;
  authorized: boolean;          // true si ya está autorizado (wallet)
  waitingForPayment?: boolean;  // true si requiere pago (deuna)
  
  payment: {
    id: string;
    paymentId: string;
    provider: string;
    amount: number;
    status: string;             // pending o approved
    
    // Solo si waitingForPayment = true:
    qrCode?: string;
    deeplink?: string;
    numericCode?: string;
    expiresAt?: string;
  };
  
  charger: {
    id: string;
    name: string;
  };
  
  pricing: {
    estimatedKwh: number;
    pricePerKwh: number;
    estimatedAmount: number;
    pricingRule: string;
  };
}
```

### **Validaciones**

- ✅ `userId` requerido
- ✅ `chargerId` requerido
- ✅ `provider` requerido y válido
- ✅ Cargador existe
- ✅ Cargador está disponible (status = 'Available')

### **Errores**

| Code | Status | Descripción |
|------|--------|-------------|
| `MISSING_USER_ID` | 400 | userId no proporcionado |
| `MISSING_CHARGER_ID` | 400 | chargerId no proporcionado |
| `INVALID_PROVIDER` | 400 | Provider no válido |
| `CHARGER_NOT_FOUND` | 404 | Cargador no existe |
| `CHARGER_NOT_AVAILABLE` | 400 | Cargador ocupado |
| `PAYMENT_CREATION_FAILED` | 500 | Error al crear pago |

---

## 3️⃣ RefundPaymentUseCase

### **Propósito**
Procesar la devolución de un pago aprobado.

### **Flujo**

```
1. Validar que el pago existe
2. Verificar ownership (user_id)
3. Verificar que el pago está aprobado
4. Verificar que no ha pasado > 30 días
5. Procesar refund en el provider (Deuna/Stripe)
6. Si era recarga: restar del saldo del usuario
7. Si era pago directo: cancelar autorización
8. Actualizar status del pago a 'refunded'
```

### **Uso**

```typescript
import { refundPaymentUseCase } from '@/lib/use-cases';

const result = await refundPaymentUseCase.run({
  userId: 'user-123',
  paymentId: 'payment-uuid',
  reason: 'Usuario solicitó devolución',  // Opcional
  amount: 10.00,                          // Opcional: refund parcial
});

console.log(result);
// {
//   success: true,
//   refund: {
//     paymentId: 'payment-uuid',
//     refundId: 'refund-xxx',
//     amount: 20.00,
//     status: 'refunded',
//     reason: 'Usuario solicitó devolución'
//   },
//   balanceRestored: 45.50,              // Si era recarga
//   authorizationCancelled: true         // Si era pago directo
// }
```

### **Request**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `userId` | string | Sí | ID del usuario |
| `paymentId` | string | Sí | ID del pago (UUID) |
| `reason` | string | No | Motivo de la devolución |
| `amount` | number | No | Monto parcial (default: total) |

### **Response**

```typescript
{
  success: boolean;
  refund: {
    paymentId: string;
    refundId?: string;        // ID del refund en provider
    amount: number;
    status: string;           // refunded
    reason?: string;
  };
  balanceRestored?: number;   // Saldo después del refund
  authorizationCancelled?: boolean;
}
```

### **Validaciones**

- ✅ `userId` requerido
- ✅ `paymentId` requerido
- ✅ `amount` > 0 (si se proporciona)
- ✅ Pago existe
- ✅ Usuario es owner del pago
- ✅ Pago está aprobado (status = 'approved')
- ✅ Pago no tiene más de 30 días
- ✅ Monto de refund <= monto original
- ✅ Usuario tiene saldo suficiente (si era recarga)

### **Errores**

| Code | Status | Descripción |
|------|--------|-------------|
| `MISSING_USER_ID` | 400 | userId no proporcionado |
| `MISSING_PAYMENT_ID` | 400 | paymentId no proporcionado |
| `INVALID_AMOUNT` | 400 | Amount <= 0 |
| `PAYMENT_NOT_FOUND` | 404 | Pago no existe |
| `UNAUTHORIZED` | 403 | No es owner del pago |
| `INVALID_PAYMENT_STATUS` | 400 | Pago no está aprobado |
| `PAYMENT_TOO_OLD` | 400 | Pago tiene > 30 días |
| `REFUND_AMOUNT_TOO_HIGH` | 400 | Refund > monto original |
| `INSUFFICIENT_BALANCE` | 400 | No hay saldo para restar |
| `PROVIDER_REFUND_FAILED` | 500 | Error en provider |

---

## 4️⃣ CheckPaymentStatusUseCase

### **Propósito**
Consultar el estado actual de un pago (con polling a provider si está pendiente).

### **Flujo**

```
1. Buscar pago en base de datos
2. Verificar ownership (user_id)
3. Si status = 'approved': retornar inmediatamente
4. Si status = 'pending' y no expiró:
   a. Consultar al provider
   b. Actualizar status en BD si cambió
5. Si expiró: marcar como 'expired'
6. Retornar estado actual
```

### **Uso**

```typescript
import { checkPaymentStatusUseCase } from '@/lib/use-cases';

const result = await checkPaymentStatusUseCase.run({
  userId: 'user-123',
  paymentId: 'deuna-txn-xxx',  // payment_id o internal_reference
});

console.log(result);
// {
//   paymentId: 'deuna-txn-xxx',
//   status: 'approved',
//   amount: 20.00,
//   provider: 'deuna',
//   context: 'wallet_recharge',
//   paidAt: '2024-08-30T...',
//   customerInfo: {
//     name: 'Juan Perez',
//     identification: '1234567890'
//   },
//   metadata: { ... }
// }
```

### **Request**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `userId` | string | Sí | ID del usuario |
| `paymentId` | string | Sí | payment_id o internal_reference |

### **Response**

```typescript
{
  paymentId: string;
  status: string;           // pending, approved, failed, expired
  amount: number;
  provider: string;
  context: string;
  paidAt?: string;
  expiresAt?: string;
  customerInfo?: {
    name?: string;
    identification?: string;
  };
  metadata?: any;
}
```

### **Validaciones**

- ✅ `userId` requerido
- ✅ `paymentId` requerido
- ✅ Pago existe
- ✅ Usuario es owner del pago

### **Errores**

| Code | Status | Descripción |
|------|--------|-------------|
| `MISSING_USER_ID` | 400 | userId no proporcionado |
| `MISSING_PAYMENT_ID` | 400 | paymentId no proporcionado |
| `PAYMENT_NOT_FOUND` | 404 | Pago no existe |
| `UNAUTHORIZED` | 403 | No es owner del pago |

---

## 🛠️ Uso Avanzado

### **Clase Base: BaseUseCase**

Todos los use cases heredan de `BaseUseCase<TRequest, TResponse>`:

```typescript
abstract class BaseUseCase<TRequest, TResponse> {
  protected abstract readonly name: string;
  
  // Template method
  async run(request: TRequest): Promise<TResponse> {
    // 1. Log inicio
    // 2. Validar
    // 3. Ejecutar
    // 4. Log success/error
    // 5. Retornar
  }
  
  // Override en subclases
  protected abstract execute(request: TRequest): Promise<TResponse>;
  protected async validate(request: TRequest): Promise<void> {}
}
```

### **Manejo de Errores**

Los use cases lanzan `UseCaseError`:

```typescript
class UseCaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly details?: any
  ) { ... }
}
```

### **Ejemplo en API Endpoint**

```typescript
export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { user } = await authenticate(req);
    
    // Parsear body
    const body = await req.json();
    
    // Ejecutar use case
    const result = await rechargeWalletUseCase.run({
      userId: user.id,
      ...body,
    });
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    // Manejar UseCaseError
    if (error.name === 'UseCaseError') {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    
    // Otros errores
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}
```

---

## 📊 Testing

### **Unit Testing**

```typescript
import { rechargeWalletUseCase } from '@/lib/use-cases';

describe('RechargeWalletUseCase', () => {
  it('should create payment successfully', async () => {
    const result = await rechargeWalletUseCase.run({
      userId: 'user-123',
      provider: 'deuna',
      amount: 20.00,
    });
    
    expect(result.success).toBe(true);
    expect(result.payment.amount).toBe(20);
  });
  
  it('should reject invalid amount', async () => {
    await expect(
      rechargeWalletUseCase.run({
        userId: 'user-123',
        provider: 'deuna',
        amount: 0,
      })
    ).rejects.toThrow('amount debe ser mayor a 0');
  });
});
```

---

## 🎯 Ventajas de Use Cases

### **✅ Separación de Concerns**
- Lógica de negocio aislada de HTTP/API
- Fácil de testear sin servidor

### **✅ Reutilización**
- Un use case puede ser llamado desde múltiples endpoints
- Ejemplo: crear pago desde API y desde CLI

### **✅ Validaciones Centralizadas**
- Todas las validaciones de negocio en un solo lugar
- No se repite lógica

### **✅ Logs Consistentes**
- Todos los use cases logean de forma uniforme
- Fácil auditoría

### **✅ Testing**
- Unit tests sin setup de servidor
- Fácil mockear dependencias

---

## 🔄 Flujo Completo con Use Case

```
1. Frontend hace request
   ↓
2. API Endpoint autentica
   ↓
3. Endpoint llama use case
   ↓
4. Use case:
   - Valida
   - Llama Gateway/Repository
   - Actualiza BD
   - Logs
   ↓
5. Use case retorna resultado
   ↓
6. Endpoint retorna JSON
   ↓
7. Frontend procesa respuesta
```

---

## 📚 Ejemplos Completos

### **Ejemplo 1: Recarga Simple**

```typescript
// En tu endpoint
const result = await rechargeWalletUseCase.run({
  userId: user.id,
  provider: PaymentProvider.DEUNA,
  amount: 50.00,
});

// Retornar QR al frontend
return NextResponse.json(result);
```

### **Ejemplo 2: Pago Directo**

```typescript
// En tu endpoint
const result = await directPaymentUseCase.run({
  userId: user.id,
  chargerId: 'CHARGER001',
  provider: PaymentProvider.WALLET,
  estimatedKwh: 15,
});

if (result.authorized) {
  // Wallet: Ya puede iniciar carga
  return NextResponse.json({ authorized: true });
} else {
  // Deuna: Mostrar QR
  return NextResponse.json({ qrCode: result.payment.qrCode });
}
```

### **Ejemplo 3: Refund**

```typescript
// En tu endpoint admin
const result = await refundPaymentUseCase.run({
  userId: user.id,
  paymentId: 'payment-uuid',
  reason: 'Error en el servicio',
});

return NextResponse.json({
  message: `Refund de $${result.refund.amount} procesado`,
});
```

---

¡Los use cases hacen que tu código sea limpio, testeable y mantenible! 🎉
