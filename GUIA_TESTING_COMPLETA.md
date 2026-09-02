# 🧪 Guía Completa de Testing - Sistema de Pagos

Guía paso a paso para probar todas las funcionalidades del sistema de pagos.

---

## 📋 Pre-requisitos

- ✅ Migraciones aplicadas (Fase 2)
- ✅ Variables de entorno configuradas (`.env`)
- ✅ Servidor corriendo: `npm run dev`

---

## 🚀 Quick Start - Testing Básico

### **Paso 1: Verificar Use Cases**

```bash
# Test automático de use cases
curl http://localhost:3000/api/test-use-cases | jq
```

**Respuesta esperada:**
```json
{
  "timestamp": "2024-08-30T...",
  "tests": [
    {
      "name": "RechargeWalletUseCase - Validation",
      "test": "Should reject amount < $1.00",
      "status": "passed",
      "message": "Validation working correctly"
    },
    ...
  ],
  "summary": {
    "total": 5,
    "passed": 5,
    "failed": 0,
    "allPassed": true,
    "successRate": "100%"
  }
}
```

---

### **Paso 2: Verificar Base de Datos**

```bash
# Test de tablas y funciones
curl http://localhost:3000/api/test-db | jq
```

**Respuesta esperada:**
```json
{
  "summary": {
    "allPassed": true,
    "tablesExist": true,
    "functionsExist": true,
    "repositoryWorks": true
  }
}
```

---

## 📊 Estado del Sistema

Si ambos tests pasaron (✅), tu sistema está funcional:

```
✅ Use cases funcionando
✅ Base de datos configurada
✅ Repository operacional
✅ Validaciones activas

🎉 Sistema listo para usar
```

---

## 🔐 Testing con Autenticación

Para probar endpoints que requieren autenticación, necesitas un token.

### **Opción 1: Obtener Token del Frontend**

```javascript
// En la consola del navegador (en tu app):
localStorage.getItem('sb-access-token')
// o
localStorage.getItem('supabase-token')
```

### **Opción 2: Login via API**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu-email@example.com",
    "password": "tu-password"
  }' | jq '.session.access_token'
```

### **Guardar Token**

```bash
# Guardar en variable de entorno
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🧪 Testing de Use Cases (Manualmente)

### **1. Recarga de Wallet con Deuna**

```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deuna",
    "context": "wallet_recharge",
    "amount": 20.00,
    "description": "Test recarga"
  }' | jq
```

**Debería retornar:**
```json
{
  "success": true,
  "payment": {
    "id": "uuid",
    "paymentId": "deuna-txn-xxx",
    "provider": "deuna",
    "amount": 20,
    "status": "pending",
    "qrCode": "<svg>...</svg>",
    "deeplink": "https://pagar.deuna.app/...",
    "numericCode": "123456",
    "expiresAt": "2024-08-30T..."
  }
}
```

**Logs esperados en consola:**
```
[RechargeWalletUseCase] Starting use case { userId: '...', amount: 20 }
[RechargeWalletUseCase] Creating payment { provider: 'deuna', amount: 20 }
[RechargeWalletUseCase] Payment created with provider { paymentId: '...' }
[RechargeWalletUseCase] Payment saved to database { id: '...' }
[RechargeWalletUseCase] Deuna transaction record created
[RechargeWalletUseCase] ✅ Wallet recharge initiated { paymentId: '...', amount: 20 }
```

---

### **2. Simular Webhook de Deuna**

```bash
# Copiar el paymentId del paso anterior
export PAYMENT_ID="deuna-txn-xxx"

curl -X POST http://localhost:3000/api/payments/webhooks/deuna \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"SUCCESS\",
    \"idTransaction\": \"$PAYMENT_ID\",
    \"internalTransactionReference\": \"CHG$(date +%s)\",
    \"amount\": 20.00,
    \"transferNumber\": \"12345678\",
    \"customerFullName\": \"Usuario Test\",
    \"customerIdentification\": \"1234567890\",
    \"date\": \"$(date +'%m/%d/%Y, %I:%M:%S %p')\"
  }" | jq
```

**Debería retornar:**
```json
{
  "received": true,
  "status": "processed",
  "paymentId": "uuid"
}
```

**Logs esperados:**
```
[Deuna Webhook] Received webhook: { status: 'SUCCESS', ... }
[Deuna Webhook] Event processed: { paymentId: '...', status: 'approved' }
[Deuna Webhook] Processing wallet recharge
[Deuna Webhook] ✅ Wallet recharged: { userId: '...', newBalance: 20 }
[Deuna Webhook] ✅ Webhook processed successfully
```

**Verificar en BD:**
```sql
-- En Supabase SQL Editor
SELECT balance FROM user_balances WHERE user_id = 'tu-user-id';
-- Debería mostrar +$20

SELECT * FROM balance_transactions 
WHERE user_id = 'tu-user-id' 
ORDER BY created_at DESC 
LIMIT 1;
-- Debería mostrar la transacción de recarga
```

---

### **3. Consultar Estado del Pago**

```bash
curl -X GET http://localhost:3000/api/payments/status/$PAYMENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Debería retornar:**
```json
{
  "paymentId": "deuna-txn-xxx",
  "status": "approved",
  "amount": 20,
  "provider": "deuna",
  "context": "wallet_recharge",
  "paidAt": "2024-08-30T...",
  "customerInfo": {
    "name": "Usuario Test",
    "identification": "1234567890"
  }
}
```

**Logs esperados:**
```
[CheckPaymentStatusUseCase] Starting use case { userId: '...', paymentId: '...' }
[CheckPaymentStatusUseCase] Finding payment { paymentId: '...' }
[CheckPaymentStatusUseCase] Payment found { id: '...', status: 'approved', provider: 'deuna' }
[CheckPaymentStatusUseCase] Payment already approved
[CheckPaymentStatusUseCase] ✅ Use case completed
```

---

### **4. Pago Directo con Deuna**

```bash
# Obtener un chargerId válido
curl http://localhost:3000/api/chargers | jq '.[0].id'
export CHARGER_ID="el-id-que-obtuviste"

# Iniciar pago directo
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"provider\": \"deuna\",
    \"context\": \"direct_charge\",
    \"chargerId\": \"$CHARGER_ID\",
    \"estimatedKwh\": 10
  }" | jq
```

**Debería retornar:**
```json
{
  "success": true,
  "authorized": false,
  "waitingForPayment": true,
  "payment": {
    "id": "uuid",
    "paymentId": "deuna-txn-xxx",
    "amount": 5.5,
    "qrCode": "<svg>...</svg>",
    ...
  },
  "charger": {
    "id": "CHARGER001",
    "name": "Cargador Norte"
  },
  "pricing": {
    "estimatedKwh": 10,
    "pricePerKwh": 0.55,
    "estimatedAmount": 5.5,
    "pricingRule": "Tarifa diurna"
  }
}
```

**Logs esperados:**
```
[DirectPaymentUseCase] Starting use case { userId: '...', chargerId: '...' }
[DirectPaymentUseCase] Validating charger { chargerId: '...' }
[DirectPaymentUseCase] Calculating estimated price { estimatedKwh: 10 }
[DirectPaymentUseCase] Price calculated { pricePerKwh: 0.55, estimatedAmount: 5.5 }
[DirectPaymentUseCase] Creating payment { provider: 'deuna', estimatedAmount: 5.5 }
[DirectPaymentUseCase] Payment created { paymentId: '...' }
[DirectPaymentUseCase] Payment saved to database { id: '...' }
[DirectPaymentUseCase] Deuna transaction record created
[DirectPaymentUseCase] ✅ Direct payment initiated, waiting for confirmation
```

---

### **5. Pago Directo con Wallet**

```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"provider\": \"wallet\",
    \"context\": \"direct_charge\",
    \"chargerId\": \"$CHARGER_ID\",
    \"estimatedKwh\": 10
  }" | jq
```

**Debería retornar:**
```json
{
  "success": true,
  "authorized": true,
  "payment": {
    "id": "uuid",
    "paymentId": "uuid",
    "provider": "wallet",
    "amount": 5.5,
    "status": "approved"
  },
  "charger": { ... },
  "pricing": { ... }
}
```

**Nota:** `authorized: true` porque wallet autoriza inmediatamente.

**Logs esperados:**
```
[DirectPaymentUseCase] Starting use case { userId: '...', chargerId: '...' }
...
[DirectPaymentUseCase] Payment created { paymentId: '...' }
[DirectPaymentUseCase] ✅ Wallet payment approved, authorization created
```

---

### **6. Validaciones (Testing de Errores)**

#### **Error: Monto muy bajo**

```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deuna",
    "context": "wallet_recharge",
    "amount": 0.50
  }' | jq
```

**Debería retornar:**
```json
{
  "error": "El monto mínimo de recarga es $1.00",
  "code": "AMOUNT_TOO_LOW"
}
```

#### **Error: Monto muy alto**

```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deuna",
    "context": "wallet_recharge",
    "amount": 1500.00
  }' | jq
```

**Debería retornar:**
```json
{
  "error": "El monto máximo de recarga es $1000.00",
  "code": "AMOUNT_TOO_HIGH"
}
```

#### **Error: Cargador no encontrado**

```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deuna",
    "context": "direct_charge",
    "chargerId": "CHARGER-INEXISTENTE"
  }' | jq
```

**Debería retornar:**
```json
{
  "error": "Cargador no encontrado",
  "code": "CHARGER_NOT_FOUND"
}
```

---

## 📊 Checklist de Testing

### **Use Cases**
- [ ] ✅ RechargeWalletUseCase valida amount < $1
- [ ] ✅ RechargeWalletUseCase valida amount > $1000
- [ ] ✅ RechargeWalletUseCase crea pago con Deuna
- [ ] ✅ DirectPaymentUseCase valida chargerId
- [ ] ✅ DirectPaymentUseCase calcula precio dinámico
- [ ] ✅ DirectPaymentUseCase autoriza con wallet inmediato
- [ ] ✅ CheckPaymentStatusUseCase encuentra pago
- [ ] ✅ CheckPaymentStatusUseCase maneja not found

### **Webhooks**
- [ ] ✅ Webhook de Deuna procesa correctamente
- [ ] ✅ Saldo se acredita en user_balances
- [ ] ✅ Transacción se registra en balance_transactions
- [ ] ✅ Autorización se crea en charging_authorizations

### **Endpoints**
- [ ] ✅ POST /api/payments/create con Deuna
- [ ] ✅ POST /api/payments/create con Wallet
- [ ] ✅ POST /api/payments/webhooks/deuna
- [ ] ✅ GET /api/payments/status/[id]
- [ ] ✅ GET /api/test-use-cases
- [ ] ✅ GET /api/test-db

### **Logs**
- [ ] ✅ Use cases logean inicio
- [ ] ✅ Use cases logean pasos intermedios
- [ ] ✅ Use cases logean éxito con ✅
- [ ] ✅ Errores se logean con ❌

---

## 🔍 Verificación en Base de Datos

### **Queries Útiles**

```sql
-- Ver últimos pagos
SELECT 
  p.id,
  p.payment_id,
  p.provider,
  p.context,
  p.amount,
  p.status,
  p.created_at
FROM payments p
ORDER BY p.created_at DESC
LIMIT 5;

-- Ver transacciones Deuna
SELECT 
  dt.transaction_id,
  dt.internal_reference,
  dt.transfer_number,
  p.amount,
  p.status,
  p.created_at
FROM deuna_transactions dt
JOIN payments p ON p.id = dt.payment_id
ORDER BY dt.created_at DESC
LIMIT 5;

-- Ver autorizaciones de carga
SELECT 
  ca.id,
  ca.user_id,
  ca.charger_id,
  ca.status,
  ca.authorized_amount,
  ca.provider,
  ca.expires_at,
  ca.created_at
FROM charging_authorizations ca
ORDER BY ca.created_at DESC
LIMIT 5;

-- Ver balance actual
SELECT 
  ub.user_id,
  ub.balance,
  ub.updated_at
FROM user_balances ub;

-- Ver últimas transacciones de balance
SELECT 
  bt.amount,
  bt.type,
  bt.description,
  bt.payment_gateway,
  bt.balance_before,
  bt.balance_after,
  bt.created_at
FROM balance_transactions bt
ORDER BY bt.created_at DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

### **Error: "Use case not found"**

```bash
# Verificar que use cases están exportados
curl http://localhost:3000/api/test-use-cases | jq '.tests[] | select(.name == "Use Case Instances")'
```

### **Error: "No autenticado"**

```bash
# Verificar token
echo $TOKEN

# Si está vacío, obtener nuevo token (ver sección de autenticación)
```

### **Error: Logs no aparecen**

```bash
# Ver logs del servidor en tiempo real
# En la terminal donde corre npm run dev
# Los logs deberían aparecer automáticamente
```

### **Webhook no procesa**

```bash
# Verificar que el paymentId es correcto
# Verificar logs del servidor
# Verificar que el body del webhook es correcto
```

---

## ✅ Testing Exitoso

Si todos los tests pasaron:

```
✅ Use cases: 5/5 tests pasados
✅ Base de datos: Configurada correctamente
✅ Webhooks: Procesando correctamente
✅ Validaciones: Funcionando
✅ Logs: Consistentes

🎉 Sistema 100% funcional
```

---

## 🚀 Próximos Pasos

### **Opción 1: Testing en Producción**

1. Deploy a Railway/Vercel
2. Configurar webhooks de Deuna/Stripe con URL pública
3. Probar con pagos reales

### **Opción 2: Integrar con Frontend**

1. Usar los endpoints desde tu frontend
2. Mostrar QR codes
3. Implementar polling de estado
4. Manejar respuestas de éxito/error

### **Opción 3: Continuar con Fase 5**

Implementar components de React:
- PaymentMethodSelector
- QRPaymentModal
- WalletRechargeForm
- ChargingPaymentFlow

---

¡Happy Testing! 🧪✨
