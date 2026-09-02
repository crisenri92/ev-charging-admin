# 🗄️ Database Schema - Payment System

## 📊 Diagrama ER Simplificado

```
┌─────────────────┐
│   auth.users    │
└────────┬────────┘
         │
         ├──────────────────────┐
         │                      │
    ┌────▼────────┐      ┌─────▼──────────────┐
    │  payments   │◄─────│ balance_           │
    │             │      │ transactions       │
    └────┬────────┘      └────────────────────┘
         │
         ├──────────┬──────────────┐
         │          │              │
    ┌────▼─────────┐│    ┌────────▼────────────┐
    │   deuna_     ││    │ charging_           │
    │ transactions ││    │ authorizations      │
    └──────────────┘│    └─────────────────────┘
                    │
         ┌──────────▼────────────┐
         │ charging_sessions     │
         └───────────────────────┘
```

---

## 📋 Tablas Principales

### 1. **payments** (Registro unificado)

Almacena todos los pagos del sistema, independientemente del provider.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK, auto-generado |
| `payment_id` | text | ID externo del pago (único) |
| `internal_reference` | text | Referencia interna única |
| `user_id` | uuid | FK a auth.users |
| `provider` | text | 'deuna' \| 'stripe' \| 'wallet' |
| `context` | text | 'wallet_recharge' \| 'direct_charge' |
| `amount` | decimal(10,2) | Monto del pago |
| `currency` | text | 'USD' |
| `status` | text | 'pending' \| 'processing' \| 'approved' \| 'failed' \| 'expired' \| 'reversed' |
| `description` | text | Descripción del pago |
| `metadata` | jsonb | Metadata flexible (chargerId, etc) |
| `qr_code` | text | QR code (SVG/base64) |
| `deeplink` | text | Link de pago |
| `numeric_code` | text | Código numérico de 6 dígitos |
| `checkout_url` | text | URL de checkout (Stripe) |
| `customer_name` | text | Nombre del pagador |
| `customer_identification` | text | Identificación del pagador |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Última actualización |
| `expires_at` | timestamptz | Cuándo expira |
| `paid_at` | timestamptz | Cuándo se confirmó |

**Índices:**
- `payment_id` (unique)
- `internal_reference` (unique, partial)
- `user_id`
- `status`
- `provider`
- `context`
- Índices compuestos para queries comunes

**RLS:**
- Usuarios ven sus propios pagos
- Service role acceso total

---

### 2. **deuna_transactions** (Específica Deuna)

Información adicional de transacciones Deuna.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `payment_id` | uuid | FK a payments(id) |
| `transaction_id` | text | UUID de Deuna (único) |
| `internal_reference` | text | Referencia interna (único) |
| `transfer_number` | text | Número de transferencia |
| `branch_id` | text | ID de sucursal |
| `pos_id` | text | ID de punto de venta |
| `point_of_sale` | text | Código de caja |
| `raw_webhook_data` | jsonb | Data cruda del webhook |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Índices:**
- `transaction_id` (unique)
- `internal_reference` (unique)
- `transfer_number` (partial)
- `payment_id`

---

### 3. **balance_transactions** (Actualizada)

Historial de movimientos de saldo (ya existía, se agregaron columnas).

**Nuevas columnas:**
- `payment_gateway` - text: 'deuna' | 'stripe' | 'wallet' | 'legacy'
- `payment_id` - uuid: FK a payments(id)
- `gateway_metadata` - jsonb: Metadata del gateway
- `deuna_transaction_id` - text: ID de Deuna
- `deuna_transfer_number` - text: Transfer number de Deuna

---

### 4. **charging_authorizations** (Nueva)

Vincula pagos con autorizaciones de carga.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `user_id` | uuid | FK a auth.users |
| `charger_id` | text | ID del cargador |
| `payment_id` | uuid | FK a payments(id) |
| `charging_session_id` | uuid | FK a charging_sessions (nullable) |
| `amount_paid` | decimal(10,2) | Monto pagado |
| `provider` | text | Provider usado |
| `status` | text | 'authorized' \| 'used' \| 'expired' \| 'cancelled' |
| `authorized_at` | timestamptz | Cuándo se autorizó |
| `used_at` | timestamptz | Cuándo se usó |
| `expires_at` | timestamptz | Cuándo expira |
| `created_at` | timestamptz | |

**Índices:**
- `user_id`
- `charger_id`
- `payment_id`
- `status`
- `charging_session_id` (partial)

---

## 🔄 Flujos de Datos

### Flujo 1: Recarga de Wallet con Deuna

```sql
-- 1. Crear pago
INSERT INTO payments (...) VALUES (...);
INSERT INTO deuna_transactions (...) VALUES (...);

-- 2. Usuario paga (externo)

-- 3. Webhook Deuna
UPDATE payments SET status = 'approved', paid_at = now() WHERE id = ?;
UPDATE deuna_transactions SET transfer_number = ? WHERE transaction_id = ?;

-- 4. Acreditar saldo
UPDATE user_balances SET balance = balance + amount WHERE user_id = ?;
INSERT INTO balance_transactions (...) VALUES (...);
```

### Flujo 2: Pago Directo de Carga con Deuna

```sql
-- 1. Crear pago
INSERT INTO payments (...) VALUES (...);
INSERT INTO deuna_transactions (...) VALUES (...);

-- 2. Usuario paga (externo)

-- 3. Webhook Deuna
UPDATE payments SET status = 'approved', paid_at = now() WHERE id = ?;

-- 4. Crear autorización
INSERT INTO charging_authorizations (...) VALUES (...);

-- 5. Iniciar carga
INSERT INTO charging_sessions (...) VALUES (...);
UPDATE charging_authorizations SET status = 'used', charging_session_id = ? WHERE id = ?;
```

---

## 🔍 Vistas Útiles

### `payments_with_user`

Pagos con información del usuario.

```sql
SELECT * FROM payments_with_user WHERE user_id = 'xxx';
```

### `payment_summary_by_provider`

Resumen estadístico por provider.

```sql
SELECT * FROM payment_summary_by_provider;
```

### `deuna_payments_full`

Pagos Deuna con todos los detalles.

```sql
SELECT * FROM deuna_payments_full WHERE status = 'approved';
```

---

## ⚙️ Funciones Útiles

### `cleanup_expired_payments()`

Marca como expirados los pagos pendientes que pasaron su tiempo.

```sql
SELECT cleanup_expired_payments();
```

### `get_payment_stats(user_id, start_date, end_date)`

Obtiene estadísticas de pagos.

```sql
SELECT get_payment_stats(
  'user-uuid',
  '2024-01-01'::timestamptz,
  '2024-12-31'::timestamptz
);
```

### `find_payment(identifier)`

Busca un pago por cualquier identificador.

```sql
SELECT * FROM find_payment('DEUNA-TXN-123');
SELECT * FROM find_payment('CHG123456');
```

### `create_payment(...)`

Helper para crear pagos desde SQL.

```sql
SELECT create_payment(
  'payment-external-id',
  'CHG123456',
  'user-uuid',
  'deuna',
  'direct_charge',
  10.50,
  'Pago de carga'
);
```

### `approve_payment(payment_id, ...)`

Aprueba un pago y ejecuta las acciones correspondientes.

```sql
SELECT approve_payment(
  'payment-uuid',
  'Juan Perez',
  '1234567890',
  '{"transferNumber": "12345"}'::jsonb
);
```

---

## 🔐 Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:

- **payments**: Usuarios ven solo sus pagos
- **deuna_transactions**: Solo service_role
- **charging_authorizations**: Usuarios ven solo sus autorizaciones
- **balance_transactions**: Ya tenía RLS

---

## 📈 Índices y Optimizaciones

### Índices compuestos principales:

```sql
-- Búsquedas comunes optimizadas
idx_payments_user_status_created
idx_payments_provider_context_status
idx_payments_user_recent

-- Reportes
idx_payments_approved_date
idx_payments_amount_range

-- Índices parciales
idx_payments_active (solo activos)
idx_payments_deuna_qr (solo con QR)
idx_charging_auth_active (solo autorizadas)
```

---

## 🚀 Aplicar Migraciones

### En Supabase Dashboard:

1. Ir a **SQL Editor**
2. Copiar contenido de `004_payments_system.sql`
3. Ejecutar
4. Copiar contenido de `005_payment_indexes_optimization.sql`
5. Ejecutar

### Verificar:

```sql
-- Ver tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('payments', 'deuna_transactions', 'charging_authorizations');

-- Ver índices
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('payments', 'deuna_transactions');

-- Ver funciones
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name LIKE '%payment%';
```

---

## 📊 Consultas Útiles

### Pagos pendientes de expirar en 5 minutos

```sql
SELECT * FROM payments
WHERE status = 'pending'
AND expires_at <= now() + interval '5 minutes'
AND expires_at > now();
```

### Últimos 10 pagos aprobados

```sql
SELECT 
  p.*,
  u.email as user_email
FROM payments p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.status = 'approved'
ORDER BY p.paid_at DESC
LIMIT 10;
```

### Pagos por provider (últimos 30 días)

```sql
SELECT 
  provider,
  context,
  COUNT(*) as total,
  SUM(amount) FILTER (WHERE status = 'approved') as approved_amount,
  AVG(amount) FILTER (WHERE status = 'approved') as avg_amount
FROM payments
WHERE created_at >= now() - interval '30 days'
GROUP BY provider, context;
```

### Autorizaciones activas por cargador

```sql
SELECT 
  charger_id,
  COUNT(*) as active_authorizations,
  SUM(amount_paid) as total_authorized
FROM charging_authorizations
WHERE status = 'authorized'
AND expires_at > now()
GROUP BY charger_id;
```

---

## 🔧 Mantenimiento

### Limpiar pagos expirados (diario)

```sql
SELECT cleanup_expired_payments();
```

### Vacuum periódico

```sql
VACUUM ANALYZE payments;
VACUUM ANALYZE deuna_transactions;
VACUUM ANALYZE charging_authorizations;
```

---

## 📝 Notas Importantes

1. **Timestamps en UTC**: Todos los timestamps están en UTC
2. **Moneda**: Por ahora solo USD, pero el campo está preparado
3. **Metadata**: Usa JSONB para flexibilidad, pero documenta estructura
4. **RLS**: Siempre usar service_role key en backend
5. **Índices**: Revisa query plans si hay lentitud

---

## 🆕 Próximas Mejoras

- [ ] Tabla de eventos de audit trail
- [ ] Tabla de webhooks recibidos (para retry)
- [ ] Tabla de configuración de providers
- [ ] Soporte para múltiples monedas
- [ ] Historial de cambios de estado
