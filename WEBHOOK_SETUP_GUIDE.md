# 🔔 Guía de Configuración de Webhooks

Guía paso a paso para configurar webhooks de Deuna y Stripe.

---

## ⚠️ Importante

Los webhooks son **esenciales** para que el sistema funcione. Sin ellos, los pagos no se acreditarán automáticamente.

**Los webhooks NO funcionan en `localhost`** porque Deuna/Stripe necesitan acceso público a tu servidor.

---

## 🌐 Requisitos Previos

Necesitas que tu aplicación esté **públicamente accesible**. Opciones:

### Opción 1: Deploy en producción (Recomendado)
```bash
# Ya tienes Railway configurado
railway up
```
URL resultante: `https://ev-charging-admin-production.up.railway.app`

### Opción 2: Tunnel local (Para desarrollo)
```bash
# Con ngrok
ngrok http 3000

# Con Railway CLI
railway run npm run dev
railway open
```

### Opción 3: Cloudflare Tunnel
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 🇪🇨 Configurar Webhook de Deuna

### 1. Acceder al Panel de Deuna

1. Ir a [https://portal.deuna.com](https://portal.deuna.com)
2. Iniciar sesión con tu cuenta
3. Navegar a **Configuración** → **Webhooks**

### 2. Crear Nuevo Webhook

**URL del Webhook:**
```
https://tu-app.com/api/payments/webhooks/deuna
```

**Ejemplo:**
```
https://ev-charging-admin-production.up.railway.app/api/payments/webhooks/deuna
```

**Método:** `POST`

**Eventos a suscribirse:**
- ✅ `payment.success`
- ✅ `payment.failed`
- ✅ `payment.pending`

### 3. Configurar Headers (Opcional)

Si Deuna soporta autenticación de webhook:

```
X-Webhook-Secret: tu-secreto-aqui
```

Luego actualiza `.env`:
```bash
DEUNA_WEBHOOK_SECRET=tu-secreto-aqui
```

### 4. Probar Webhook

Usar el botón "Test Webhook" en el panel de Deuna.

**Payload de prueba:**
```json
{
  "status": "SUCCESS",
  "idTransaction": "test-uuid-123",
  "internalTransactionReference": "CHG123456",
  "amount": 1.00,
  "transferNumber": "12345678",
  "customerFullName": "Test User",
  "customerIdentification": "0000000000",
  "date": "8/30/2024, 2:00:00 PM"
}
```

**Respuesta esperada:**
```json
{
  "received": true,
  "status": "processed",
  "paymentId": "uuid"
}
```

### 5. Verificar Logs

```bash
# En tu servidor
railway logs

# Buscar:
[Deuna Webhook] Received webhook: ...
[Deuna Webhook] ✅ Webhook processed successfully
```

---

## 💳 Configurar Webhook de Stripe

### 1. Acceder al Dashboard de Stripe

1. Ir a [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Iniciar sesión
3. Navegar a **Developers** → **Webhooks**

### 2. Agregar Endpoint

Clic en **"Add endpoint"**

**URL del Endpoint:**
```
https://tu-app.com/api/payments/webhooks/stripe
```

**Ejemplo:**
```
https://ev-charging-admin-production.up.railway.app/api/payments/webhooks/stripe
```

### 3. Seleccionar Eventos

Seleccionar SOLO este evento:
- ✅ `checkout.session.completed`

(Puedes agregar más eventos después si los necesitas)

### 4. Copiar Signing Secret

Después de crear el webhook, Stripe te mostrará el **Signing Secret**:

```
whsec_...
```

**⚠️ Importante:** Copiarlo y agregarlo a `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_tu_secreto_aqui
```

**Reiniciar la aplicación** después de actualizar el `.env`.

### 5. Probar Webhook

Stripe tiene una función "Send test webhook":

1. En el webhook recién creado, clic en **"Send test webhook"**
2. Seleccionar evento: `checkout.session.completed`
3. Usar el payload de ejemplo de Stripe
4. Clic en **"Send test webhook"**

**Respuesta esperada:**
```json
{
  "received": true,
  "status": "processed",
  "paymentId": "uuid"
}
```

### 6. Verificar Logs

```bash
railway logs

# Buscar:
[Stripe Webhook] Received webhook
[Stripe Webhook] Event processed: ...
[Stripe Webhook] ✅ Webhook processed successfully
```

---

## 🧪 Testing Local (Desarrollo)

### Con Stripe CLI

Stripe ofrece un CLI para testing local:

```bash
# Instalar
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks a localhost
stripe listen --forward-to localhost:3000/api/payments/webhooks/stripe

# Obtendrás un webhook secret temporal:
# whsec_...
# Agregarlo a tu .env
```

Ahora puedes crear pagos en Stripe y recibirás los webhooks en tu localhost.

### Con Deuna

Deuna no tiene CLI, necesitas usar ngrok/cloudflare:

```bash
# Con ngrok
ngrok http 3000

# Copiar la URL pública (ej: https://abc123.ngrok.io)
# Configurar en Deuna:
https://abc123.ngrok.io/api/payments/webhooks/deuna
```

**⚠️ Nota:** ngrok gratis genera URLs aleatorias cada vez. Considera ngrok pro o cloudflare tunnel para URL fija.

---

## 🔍 Verificar que Funciona

### Test Completo End-to-End

```bash
# 1. Crear pago de prueba (desde Postman o frontend)
curl -X POST https://tu-app.com/api/payments/create \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deuna",
    "context": "wallet_recharge",
    "amount": 1.00
  }'

# 2. Copiar el paymentId de la respuesta

# 3. Simular webhook manualmente (solo para testing)
curl -X POST https://tu-app.com/api/payments/webhooks/deuna \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SUCCESS",
    "idTransaction": "PAYMENT_ID_AQUI",
    "internalTransactionReference": "CHG123456",
    "amount": 1.00,
    "transferNumber": "12345",
    "customerFullName": "Test User",
    "customerIdentification": "1234567890",
    "date": "8/30/2024, 2:00:00 PM"
  }'

# 4. Verificar que el saldo fue acreditado
# Consultar en Supabase:
# SELECT * FROM user_balances WHERE user_id = 'tu-user-id';
# SELECT * FROM balance_transactions ORDER BY created_at DESC LIMIT 5;
```

---

## 🚨 Troubleshooting

### ❌ Webhook no llega

**Posibles causas:**
1. URL incorrecta en Deuna/Stripe
2. Servidor caído o no accesible
3. Firewall bloqueando requests
4. URL es localhost (no funciona)

**Solución:**
```bash
# Verificar que el servidor está corriendo
curl https://tu-app.com/api/test-db

# Si responde, el servidor está bien
# Si no, verificar logs:
railway logs
```

### ❌ Error "Invalid webhook signature" (Stripe)

**Causa:** `STRIPE_WEBHOOK_SECRET` incorrecto o no configurado

**Solución:**
```bash
# Verificar en .env
cat .env | grep STRIPE_WEBHOOK_SECRET

# Debe ser: whsec_...
# Si no existe o es diferente, copiar el correcto del dashboard de Stripe
# Reiniciar servidor después de actualizar
```

### ❌ Webhook llega pero no procesa

**Verificar logs:**
```bash
railway logs | grep "Webhook"

# Buscar errores:
[Deuna Webhook] Error: ...
```

**Causas comunes:**
- Campos faltantes en el payload
- `paymentId` no encontrado en BD
- Error al actualizar `user_balances`

**Solución:**
```bash
# Verificar que el pago existe
SELECT * FROM payments WHERE payment_id = 'xxx';

# Verificar user_balances
SELECT * FROM user_balances WHERE user_id = 'xxx';
```

### ❌ Pago se acredita dos veces

**Causa:** Webhook duplicado (Deuna/Stripe reintentan)

**Solución:** Ya está manejado en el código
```typescript
// Verificar si ya fue procesado
if (payment.status === 'approved') {
  return NextResponse.json({ received: true, message: 'Already processed' });
}
```

Si sigue pasando, revisar:
```sql
SELECT * FROM balance_transactions 
WHERE payment_id = 'xxx' 
ORDER BY created_at;

-- Si hay 2+ registros con mismo payment_id, hay un bug
```

---

## 📊 Monitoreo de Webhooks

### Logs en Producción

```bash
# Ver logs en tiempo real
railway logs --follow

# Filtrar solo webhooks
railway logs | grep Webhook

# Ver últimos 100 logs
railway logs --tail 100
```

### Dashboard de Stripe

Stripe Dashboard → Webhooks → [Tu endpoint] → "Recent deliveries"

Verás:
- ✅ Webhooks exitosos (200)
- ❌ Webhooks fallidos (4xx, 5xx)
- ⏱ Tiempo de respuesta
- 🔄 Reintentos

### Dashboard de Deuna

Deuna Portal → Webhooks → Logs

Verás historial de webhooks enviados y respuestas.

---

## 🔐 Seguridad

### Validar Origen del Webhook

**Stripe:** Ya implementado con firma HMAC
```typescript
// Valida automáticamente en el código
await gateway.handleWebhook(PaymentProvider.STRIPE, headers, body);
```

**Deuna:** Recomendado agregar validación
```typescript
// Si Deuna proporciona secret
const webhookSecret = req.headers.get('x-webhook-secret');
if (webhookSecret !== process.env.DEUNA_WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### IPs Permitidas (Firewall)

Si usas firewall, permitir IPs de:
- **Stripe:** [Lista oficial](https://stripe.com/docs/ips)
- **Deuna:** Consultar con soporte de Deuna

### Rate Limiting

Opcional: Limitar requests al endpoint de webhook

```typescript
// middleware.ts
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 req/min
});

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.includes('/webhooks/')) {
    const { success } = await ratelimit.limit(req.ip ?? 'anonymous');
    if (!success) {
      return new Response('Too many requests', { status: 429 });
    }
  }
}
```

---

## ✅ Checklist Final

Antes de ir a producción:

- [ ] Webhook de Deuna configurado con URL correcta
- [ ] Webhook de Stripe configurado con URL correcta
- [ ] `STRIPE_WEBHOOK_SECRET` en `.env`
- [ ] Webhook de Deuna probado (test webhook)
- [ ] Webhook de Stripe probado (test webhook)
- [ ] Logs verificados (webhooks llegan)
- [ ] Saldo se acredita correctamente
- [ ] No hay errores 500 en logs
- [ ] Dashboard de Stripe muestra webhooks exitosos
- [ ] Dashboard de Deuna muestra webhooks exitosos

---

## 🎉 ¡Listo!

Con los webhooks configurados, tu sistema está completo y funcional.

**Flujo completo funcionando:**
```
Usuario paga → Deuna/Stripe → Webhook → Tu servidor → Saldo acreditado ✅
```

Si tienes problemas, revisa la sección de **Troubleshooting** o los logs de tu servidor.
