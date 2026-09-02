# 🧪 Testing de Fase 3 - Endpoints de Pago

Guía rápida para probar todos los endpoints implementados en Fase 3.

---

## 📋 Pre-requisitos

- ✅ Migraciones aplicadas (Fase 2)
- ✅ Variables de entorno configuradas
- ✅ Servidor corriendo (`npm run dev`)
- ✅ Token de autenticación de Supabase

---

## 1. Obtener Token de Autenticación

```bash
# Opción 1: Desde tu app
# Ir a /wallet y copiar token de localStorage
# localStorage.getItem('supabase-token')

# Opción 2: Login manual via API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu-email@example.com",
    "password": "tu-password"
  }'

# Guardar el access_token
export TOKEN="eyJhbG..."
```

---

## 2. Test: Crear Pago con Deuna (Recarga de Wallet)

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

**Respuesta esperada:**
```json
{
  "success": true,
  "payment": {
    "id": "uuid",
    "paymentId": "deuna-txn-...",
    "provider": "deuna",
    "context": "wallet_recharge",
    "amount": 20,
    "status": "pending",
    "qrCode": "<svg>...</svg>",
    "deeplink": "https://pagar.deuna.app/...",
    "numericCode": "123456",
    "expiresAt": "2024-08-30T...",
    "createdAt": "2024-08-30T..."
  }
}
```

**Verificar en BD:**
```sql
-- En Supabase SQL Editor
SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;
SELECT * FROM deuna_transactions ORDER BY created_at DESC LIMIT 1;
```

---

## 3. Test: Simular Webhook de Deuna

```bash
# Copiar el paymentId del test anterior
export PAYMENT_ID="deuna-txn-..."

curl -X POST http://localhost:3000/api/payments/webhooks/deuna \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"SUCCESS\",
    \"idTransaction\": \"$PAYMENT_ID\",
    \"internalTransactionReference\": \"CHG123456\",
    \"amount\": 20.00,
    \"transferNumber\": \"12345678\",
    \"customerFullName\": \"Test User\",
    \"customerIdentification\": \"1234567890\",
    \"date\": \"8/30/2024, 2:00:00 PM\"
  }" | jq
```

**Respuesta esperada:**
```json
{
  "received": true,
  "status": "processed",
  "paymentId": "uuid"
}
```

**Verificar saldo acreditado:**
```sql
-- Debería ver +$20 en el balance
SELECT * FROM user_balances WHERE user_id = 'tu-user-id';

-- Debería ver la transacción
SELECT * FROM balance_transactions 
WHERE user_id = 'tu-user-id' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Ver logs del servidor:**
```
[Deuna Webhook] Received webhook: { status: 'SUCCESS', ... }
[Deuna Webhook] Event processed: { paymentId: '...', status: 'approved' }
[Deuna Webhook] Processing wallet recharge
[Deuna Webhook] ✅ Wallet recharged: { userId: '...', newBalance: 20 }
[Deuna Webhook] ✅ Webhook processed successfully
```

---

## 4. Test: Consultar Estado de Pago

```bash
curl -X GET http://localhost:3000/api/payments/status/$PAYMENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Respuesta esperada:**
```json
{
  "paymentId": "deuna-txn-...",
  "status": "approved",
  "amount": 20,
  "provider": "deuna",
  "context": "wallet_recharge",
  "paidAt": "2024-08-30T...",
  "customerInfo": {
    "name": "Test User",
    "identification": "1234567890"
  }
}
```

---

## 5. Test: Pago Directo con Deuna

```bash
# Primero, obtener un chargerId válido
curl http://localhost:3000/api/chargers | jq '.[0].id'

export CHARGER_ID="CHARGER001"

# Iniciar proceso de carga con pago
curl -X POST http://localhost:3000/api/charging/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"chargerId\": \"$CHARGER_ID\",
    \"provider\": \"deuna\",
    \"estimatedKwh\": 10
  }" | jq
```

**Respuesta esperada:**
```json
{
  "success": true,
  "authorized": false,
  "waitingForPayment": true,
  "payment": {
    "id": "uuid",
    "paymentId": "deuna-txn-...",
    "provider": "deuna",
    "amount": 5.5,
    "status": "pending",
    "qrCode": "<svg>...</svg>",
    "deeplink": "https://pagar.deuna.app/...",
    "numericCode": "123456",
    "expiresAt": "..."
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

---

## 6. Test: Simular Webhook para Pago Directo

```bash
export DIRECT_PAYMENT_ID="deuna-txn-..."

curl -X POST http://localhost:3000/api/payments/webhooks/deuna \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"SUCCESS\",
    \"idTransaction\": \"$DIRECT_PAYMENT_ID\",
    \"internalTransactionReference\": \"CHG789012\",
    \"amount\": 5.50,
    \"transferNumber\": \"87654321\",
    \"customerFullName\": \"Test User\",
    \"customerIdentification\": \"1234567890\",
    \"date\": \"8/30/2024, 3:00:00 PM\"
  }" | jq
```

**Verificar autorización creada:**
```sql
SELECT * FROM charging_authorizations 
WHERE user_id = 'tu-user-id' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Debería ver:**
```
status: 'authorized'
charger_id: 'CHARGER001'
authorized_amount: 5.5
provider: 'deuna'
```

---

## 7. Test: Iniciar Carga con Autorización

```bash
curl -X POST http://localhost:3000/api/charging/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"chargerId\": \"$CHARGER_ID\"
  }" | jq
```

**Respuesta esperada:**
```json
{
  "sessionId": "uuid",
  "chargerName": "Cargador Norte",
  "pricePerKwh": 0.55,
  "pricingRule": "Tarifa diurna",
  "paymentMethod": "deuna",
  "authorized": true
}
```

**Verificar sesión creada:**
```sql
SELECT * FROM charging_sessions 
WHERE user_id = 'tu-user-id' 
ORDER BY started_at DESC 
LIMIT 1;
```

**Verificar autorización marcada como usada:**
```sql
SELECT * FROM charging_authorizations 
WHERE user_id = 'tu-user-id' 
ORDER BY created_at DESC 
LIMIT 1;

-- status debería ser 'used'
```

---

## 8. Test: Pago con Wallet (Instantáneo)

```bash
curl -X POST http://localhost:3000/api/charging/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"chargerId\": \"$CHARGER_ID\",
    \"provider\": \"wallet\",
    \"estimatedKwh\": 10
  }" | jq
```

**Respuesta esperada (autorizado inmediatamente):**
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

**Sin QR, sin deeplink, autorizado inmediatamente** ✅

---

## 9. Test: Error - Saldo Insuficiente

```bash
# Reducir saldo del usuario a 0
# En Supabase SQL Editor:
UPDATE user_balances 
SET balance = 0 
WHERE user_id = 'tu-user-id';

# Intentar pagar con wallet
curl -X POST http://localhost:3000/api/charging/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"chargerId\": \"$CHARGER_ID\",
    \"provider\": \"wallet\",
    \"estimatedKwh\": 10
  }" | jq
```

**Respuesta esperada:**
```json
{
  "error": "Saldo insuficiente"
}
```

---

## 10. Test: Error - Pago No Encontrado

```bash
curl -X GET http://localhost:3000/api/payments/status/payment-inexistente \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Respuesta esperada:**
```json
{
  "error": "Pago no encontrado"
}
```

---

## ✅ Checklist de Testing

- [ ] ✅ Crear pago con Deuna retorna QR code
- [ ] ✅ Webhook de Deuna procesa correctamente
- [ ] ✅ Saldo se acredita en `user_balances`
- [ ] ✅ Transacción se registra en `balance_transactions`
- [ ] ✅ GET status retorna estado correcto
- [ ] ✅ Pago directo genera QR
- [ ] ✅ Webhook crea autorización de carga
- [ ] ✅ Charging/start valida autorización
- [ ] ✅ Autorización se marca como usada
- [ ] ✅ Pago con wallet autoriza inmediato
- [ ] ✅ Error de saldo insuficiente funciona
- [ ] ✅ Logs aparecen en consola
- [ ] ✅ No hay errores 500

---

## 🔍 Verificación en Base de Datos

### Queries Útiles

```sql
-- Ver últimos pagos
SELECT 
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
  p.status
FROM deuna_transactions dt
JOIN payments p ON p.id = dt.payment_id
ORDER BY dt.created_at DESC
LIMIT 5;

-- Ver autorizaciones de carga
SELECT 
  ca.id,
  ca.charger_id,
  ca.status,
  ca.authorized_amount,
  ca.provider,
  ca.expires_at,
  ca.created_at
FROM charging_authorizations ca
WHERE user_id = 'tu-user-id'
ORDER BY ca.created_at DESC;

-- Ver balance actual y transacciones
SELECT 
  ub.balance,
  ub.updated_at
FROM user_balances ub
WHERE user_id = 'tu-user-id';

SELECT 
  bt.amount,
  bt.type,
  bt.description,
  bt.payment_gateway,
  bt.balance_before,
  bt.balance_after,
  bt.created_at
FROM balance_transactions bt
WHERE user_id = 'tu-user-id'
ORDER BY bt.created_at DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

### Error: "No autenticado"

```bash
# Verificar token
echo $TOKEN

# Si está vacío, obtener nuevo token
# Ver paso 1
```

### Error: "Provider inválido"

```bash
# Verificar que DEUNA_API_KEY está en .env
cat .env | grep DEUNA

# Si falta, agregar:
echo "DEUNA_API_KEY=tu-api-key" >> .env
echo "DEUNA_POINT_OF_SALE=tu-pos-id" >> .env

# Reiniciar servidor
```

### Webhook no procesa

```bash
# Ver logs del servidor
# Buscar errores con:
grep "Error" logs.txt

# Común: payment_id no encontrado
# Solución: Usar el payment_id correcto del paso 2
```

### Saldo no se acredita

```bash
# Verificar webhook llegó
# Ver logs: [Deuna Webhook] ✅ Wallet recharged

# Verificar en BD:
SELECT * FROM balance_transactions 
WHERE payment_id = 'payment-id-aqui';

# Si no existe, el webhook no procesó
# Revisar logs de error
```

---

## 🎉 Testing Completo

Si todos los tests pasaron:
- ✅ **Fase 3 funcional al 100%**
- ✅ **Endpoints probados**
- ✅ **Webhooks procesando**
- ✅ **Base de datos actualizada**

**¡Sistema listo para integración con frontend!** 🚀

---

## 📊 Resumen de Endpoints Testeados

| Endpoint | Método | Status |
|----------|--------|--------|
| `/api/payments/create` | POST | ✅ |
| `/api/payments/webhooks/deuna` | POST | ✅ |
| `/api/payments/status/[id]` | GET | ✅ |
| `/api/charging/initiate` | POST | ✅ |
| `/api/charging/start` | POST | ✅ |

**5/5 endpoints funcionando correctamente** ✅
