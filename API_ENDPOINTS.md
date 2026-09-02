# 📡 API Endpoints - Sistema de Pagos

Documentación completa de todos los endpoints del sistema de pagos.

---

## 🔐 Autenticación

Todos los endpoints requieren autenticación con Bearer token:

```
Authorization: Bearer {supabase_access_token}
```

---

## 📋 Endpoints

### 1. Crear Pago

**POST** `/api/payments/create`

Crea un nuevo pago con cualquier provider (Deuna, Stripe, Wallet).

#### Request Body

```json
{
  "provider": "deuna",           // "deuna" | "stripe" | "wallet"
  "context": "wallet_recharge",  // "wallet_recharge" | "direct_charge"
  "amount": 20.00,               // Monto en USD
  "description": "Recarga de wallet",  // Opcional
  "expirationMinutes": 30,       // Opcional, default según provider
  
  // Solo para direct_charge:
  "chargerId": "CHARGER001",     // Requerido si context = direct_charge
  "chargerName": "Cargador Norte" // Opcional
}
```

#### Response 200 OK

```json
{
  "success": true,
  "payment": {
    "id": "uuid",
    "paymentId": "deuna-txn-123",
    "provider": "deuna",
    "context": "wallet_recharge",
    "amount": 20.00,
    "status": "pending",
    
    // Métodos de pago (según provider)
    "qrCode": "<svg>...</svg>",          // Deuna
    "deeplink": "https://pagar.deuna...", // Deuna
    "numericCode": "123456",              // Deuna
    "checkoutUrl": "https://checkout...", // Stripe
    
    "expiresAt": "2024-08-30T20:30:00Z",
    "createdAt": "2024-08-30T20:00:00Z"
  }
}
```

#### Response 400 Bad Request

```json
{
  "error": "Provider inválido: invalid"
}
```

#### Ejemplo (curl)

```bash
curl -X POST https://your-app.com/api/payments/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deuna",
    "context": "wallet_recharge",
    "amount": 20.00
  }'
```

---

### 2. Webhook Deuna

**POST** `/api/payments/webhooks/deuna`

Procesa webhooks de Deuna cuando un pago es confirmado.

**⚠️ Este endpoint es llamado por Deuna, no por tu frontend.**

#### Request Body (enviado por Deuna)

```json
{
  "status": "SUCCESS",
  "idTransaction": "deuna-uuid",
  "internalTransactionReference": "CHG123456",
  "amount": 20.00,
  "transferNumber": "12345678",
  "customerFullName": "Juan Perez",
  "customerIdentification": "1234567890",
  "date": "8/30/2024, 2:00:00 PM"
}
```

#### Response 200 OK

```json
{
  "received": true,
  "status": "processed",
  "paymentId": "uuid"
}
```

#### Configuración en Deuna

Configurar esta URL en el panel de Deuna:
```
https://your-app.com/api/payments/webhooks/deuna
```

---

### 3. Webhook Stripe

**POST** `/api/payments/webhooks/stripe`

Procesa webhooks de Stripe (refactorizado).

**⚠️ Este endpoint es llamado por Stripe, no por tu frontend.**

#### Configuración en Stripe

1. Dashboard de Stripe → Webhooks
2. Agregar endpoint:
   ```
   https://your-app.com/api/payments/webhooks/stripe
   ```
3. Seleccionar evento: `checkout.session.completed`

---

### 4. Consultar Estado de Pago

**GET** `/api/payments/status/{paymentId}`

Consulta el estado actual de un pago. Útil para polling.

#### URL Parameters

- `paymentId` - ID del pago (payment_id o internal_reference)

#### Response 200 OK

```json
{
  "paymentId": "deuna-txn-123",
  "status": "approved",          // pending | processing | approved | failed | expired
  "amount": 20.00,
  "provider": "deuna",
  "context": "wallet_recharge",
  "paidAt": "2024-08-30T20:05:00Z",
  "customerInfo": {
    "name": "Juan Perez",
    "identification": "1234567890"
  },
  "metadata": {
    "chargerId": "CHARGER001",
    "description": "..."
  }
}
```

#### Ejemplo (JavaScript)

```javascript
// Polling cada 3 segundos
const pollPaymentStatus = async (paymentId) => {
  const interval = setInterval(async () => {
    const response = await fetch(
      `/api/payments/status/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    
    if (data.status === 'approved') {
      clearInterval(interval);
      console.log('¡Pago aprobado!');
      // Continuar con el flujo
    } else if (data.status === 'expired' || data.status === 'failed') {
      clearInterval(interval);
      console.log('Pago fallido');
    }
  }, 3000);
  
  // Timeout después de 10 minutos
  setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
};
```

---

### 5. Iniciar Proceso de Carga con Pago

**POST** `/api/charging/initiate`

Inicia el proceso de carga con pago. Genera QR/Link si es Deuna, o autoriza inmediatamente si es Wallet.

#### Request Body

```json
{
  "chargerId": "CHARGER001",
  "provider": "deuna",          // "deuna" | "wallet"
  "estimatedKwh": 10            // Opcional, default 10
}
```

#### Response 200 OK - Wallet (inmediato)

```json
{
  "success": true,
  "authorized": true,
  "payment": {
    "id": "uuid",
    "paymentId": "uuid",
    "provider": "wallet",
    "amount": 5.50,
    "status": "approved"
  },
  "charger": {
    "id": "CHARGER001",
    "name": "Cargador Norte"
  },
  "pricing": {
    "estimatedKwh": 10,
    "pricePerKwh": 0.55,
    "estimatedAmount": 5.50,
    "pricingRule": "Tarifa diurna"
  }
}
```

#### Response 200 OK - Deuna (requiere pago)

```json
{
  "success": true,
  "authorized": false,
  "waitingForPayment": true,
  "payment": {
    "id": "uuid",
    "paymentId": "deuna-txn-123",
    "provider": "deuna",
    "amount": 5.50,
    "status": "pending",
    
    // Mostrar al usuario
    "qrCode": "<svg>...</svg>",
    "deeplink": "https://pagar.deuna.app/...",
    "numericCode": "123456",
    
    "expiresAt": "2024-08-30T20:10:00Z"
  },
  "charger": {
    "id": "CHARGER001",
    "name": "Cargador Norte"
  },
  "pricing": {
    "estimatedKwh": 10,
    "pricePerKwh": 0.55,
    "estimatedAmount": 5.50,
    "pricingRule": "Tarifa diurna"
  }
}
```

#### Flujo Completo

```javascript
// 1. Usuario escanea QR del cargador
const chargerId = 'CHARGER001';

// 2. Iniciar proceso de carga
const response = await fetch('/api/charging/initiate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    chargerId,
    provider: 'deuna',
    estimatedKwh: 10
  })
});

const data = await response.json();

if (data.authorized) {
  // Wallet: Ya autorizado, puede iniciar carga
  startCharging(chargerId);
} else {
  // Deuna: Mostrar QR y esperar pago
  showPaymentModal(data.payment);
  pollPaymentStatus(data.payment.paymentId);
}
```

---

### 6. Iniciar Sesión de Carga

**POST** `/api/charging/start`

Inicia la sesión física de carga. Valida autorización de pago si existe.

#### Request Body

```json
{
  "chargerId": "CHARGER001"
}
```

#### Response 200 OK

```json
{
  "sessionId": "uuid",
  "chargerName": "Cargador Norte",
  "pricePerKwh": 0.55,
  "pricingRule": "Tarifa diurna",
  "paymentMethod": "deuna",      // "deuna" | "wallet"
  "authorized": true
}
```

#### Response 402 Payment Required

```json
{
  "error": "insufficient_balance",
  "balance": 3.50
}
```

---

## 🔄 Flujos Completos

### Flujo 1: Recarga de Wallet con Deuna

```
1. Usuario selecciona "Recargar $20"
   POST /api/payments/create
   {
     "provider": "deuna",
     "context": "wallet_recharge",
     "amount": 20.00
   }

2. Frontend muestra QR de response.payment.qrCode

3. Usuario paga con app Deuna

4. Deuna envía webhook a /api/payments/webhooks/deuna

5. Backend acredita saldo automáticamente

6. (Opcional) Frontend hace polling a /api/payments/status/{id}
   hasta recibir status: "approved"
```

### Flujo 2: Pago Directo de Carga con Deuna

```
1. Usuario escanea QR del cargador
   POST /api/charging/initiate
   {
     "chargerId": "CHARGER001",
     "provider": "deuna"
   }

2. Frontend muestra QR de pago

3. Usuario paga con app Deuna

4. Deuna envía webhook → autorización creada

5. Frontend detecta pago aprobado (polling)

6. POST /api/charging/start
   {
     "chargerId": "CHARGER001"
   }

7. Sesión de carga iniciada
```

### Flujo 3: Pago con Wallet

```
1. Usuario escanea QR del cargador
   POST /api/charging/initiate
   {
     "chargerId": "CHARGER001",
     "provider": "wallet"
   }

2. Response con authorized: true (inmediato)

3. POST /api/charging/start
   {
     "chargerId": "CHARGER001"
   }

4. Sesión iniciada, saldo se descuenta al finalizar
```

---

## 🧪 Testing

### Test Endpoint de Pagos

```bash
# Crear pago de prueba
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deuna",
    "context": "wallet_recharge",
    "amount": 1.00
  }'
```

### Simular Webhook de Deuna

```bash
curl -X POST http://localhost:3000/api/payments/webhooks/deuna \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SUCCESS",
    "idTransaction": "test-txn-id",
    "internalTransactionReference": "CHG123456",
    "amount": 1.00,
    "transferNumber": "12345",
    "customerFullName": "Test User",
    "customerIdentification": "1234567890",
    "date": "8/30/2024, 2:00:00 PM"
  }'
```

---

## 🔒 Seguridad

### Rate Limiting

Se recomienda implementar rate limiting:

```typescript
// Ejemplo con rate-limiter
import rateLimit from 'express-rate-limit';

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 requests por ventana
  message: 'Demasiadas solicitudes, intenta más tarde'
});
```

### Webhook Validation

- **Deuna**: Valida campos requeridos (implementado)
- **Stripe**: Valida firma HMAC (implementado)

### CORS

Configurar CORS para webhooks:

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/payments/webhooks/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST' }
        ]
      }
    ];
  }
};
```

---

## 📊 Logs y Monitoreo

Todos los endpoints logean:
- ✅ Request recibido
- ✅ Validaciones
- ✅ Operaciones de BD
- ✅ Errores con stack trace
- ✅ Resultado final

Ejemplo de logs:

```
[Payment Create] Creating payment { provider: 'deuna', amount: 20 }
[Payment Create] ✅ Payment created successfully: { id: '...', paymentId: '...' }
[Deuna Webhook] Received webhook: { status: 'SUCCESS', ... }
[Deuna Webhook] ✅ Wallet recharged: { userId: '...', amount: 20, newBalance: 45 }
```

---

## 🐛 Troubleshooting

### Error: "Payment not found"
- Verificar que el pago existe en BD
- Verificar que el paymentId es correcto

### Error: "Invalid webhook signature"
- Verificar STRIPE_WEBHOOK_SECRET
- Verificar que el body es raw (no parseado)

### Error: "Cargador no disponible"
- Verificar que el status del cargador es "Available"
- Verificar que el chargerId es correcto

### Pago no se acredita
- Revisar logs del webhook
- Verificar que el webhook está configurado en Deuna/Stripe
- Hacer query manual en BD para ver el estado del pago
