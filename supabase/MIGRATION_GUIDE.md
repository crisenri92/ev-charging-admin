# 📖 Guía de Migración - Sistema de Pagos

## 🎯 Objetivo

Aplicar las migraciones SQL para crear las tablas y funciones necesarias para el sistema de pagos multi-gateway.

---

## 🚀 Método 1: Supabase Dashboard (Recomendado)

### Paso 1: Acceder a Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú lateral, click en **SQL Editor**

### Paso 2: Aplicar Migración 004

1. Click en **New Query**
2. Copia todo el contenido de `supabase/migrations/004_payments_system.sql`
3. Pega en el editor
4. Click en **Run** (o Ctrl/Cmd + Enter)
5. Espera confirmación: "Success. No rows returned"

### Paso 3: Aplicar Migración 005

1. Click en **New Query** nuevamente
2. Copia todo el contenido de `supabase/migrations/005_payment_indexes_optimization.sql`
3. Pega en el editor
4. Click en **Run**
5. Espera confirmación

### Paso 4: Verificar

Ejecuta este query para verificar que todo se creó correctamente:

```sql
-- Verificar tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'payments', 
  'deuna_transactions', 
  'charging_authorizations'
)
ORDER BY table_name;

-- Debe retornar 3 filas

-- Verificar funciones
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name LIKE '%payment%'
ORDER BY routine_name;

-- Debe retornar varias funciones:
-- - approve_payment
-- - cleanup_expired_payments
-- - create_payment
-- - find_payment
-- - get_payment_stats
```

---

## 🖥️ Método 2: CLI de Supabase (Avanzado)

Si tienes Supabase CLI instalado:

```bash
# Instalar CLI (si no lo tienes)
npm install -g supabase

# Iniciar proyecto
supabase init

# Linkar con tu proyecto
supabase link --project-ref YOUR_PROJECT_ID

# Aplicar migraciones
supabase db push

# O aplicar una por una
supabase db execute --file supabase/migrations/004_payments_system.sql
supabase db execute --file supabase/migrations/005_payment_indexes_optimization.sql
```

---

## 🔍 Verificación Detallada

### 1. Verificar Tablas Creadas

```sql
-- Ver estructura de payments
\d+ public.payments

-- Ver estructura de deuna_transactions
\d+ public.deuna_transactions

-- Ver estructura de charging_authorizations
\d+ public.charging_authorizations
```

### 2. Verificar Índices

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('payments', 'deuna_transactions', 'charging_authorizations')
ORDER BY tablename, indexname;
```

### 3. Verificar RLS (Row Level Security)

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('payments', 'deuna_transactions', 'charging_authorizations')
ORDER BY tablename, policyname;
```

### 4. Verificar Vistas

```sql
SELECT * FROM payments_with_user LIMIT 1;
SELECT * FROM payment_summary_by_provider;
SELECT * FROM deuna_payments_full LIMIT 1;
```

### 5. Test de Funciones

```sql
-- Test cleanup
SELECT cleanup_expired_payments();

-- Test stats (debe retornar JSON)
SELECT get_payment_stats(
  NULL,  -- todos los usuarios
  now() - interval '30 days',
  now()
);

-- Test find payment (debe retornar empty si no hay datos)
SELECT * FROM find_payment('test-id');
```

---

## ❓ Troubleshooting

### Error: "relation already exists"

Si ves este error, significa que la tabla ya existe. Puedes:

**Opción A: Eliminar y recrear**
```sql
DROP TABLE IF EXISTS public.charging_authorizations CASCADE;
DROP TABLE IF EXISTS public.deuna_transactions CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;

-- Luego ejecutar la migración 004 de nuevo
```

**Opción B: Usar IF NOT EXISTS**
Las migraciones ya incluyen `IF NOT EXISTS`, así que este error no debería ocurrir.

### Error: "column already exists"

Para las columnas nuevas en `balance_transactions`:

```sql
-- Verificar qué columnas existen
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'balance_transactions';

-- Si alguna ya existe, la migración la saltará automáticamente
```

### Error: "permission denied"

Asegúrate de estar usando una API key con permisos de **service_role** o la contraseña de Postgres.

En Supabase Dashboard, el SQL Editor ya tiene los permisos necesarios.

### Error: "function does not exist"

Si las funciones no se crean, verifica que estés en el schema `public`:

```sql
SET search_path TO public;

-- Luego ejecuta la migración
```

---

## 🔄 Rollback (Deshacer Migraciones)

Si necesitas deshacer los cambios:

```sql
-- ⚠️ CUIDADO: Esto elimina todos los datos

-- Eliminar tablas (en orden por dependencias)
DROP TABLE IF EXISTS public.charging_authorizations CASCADE;
DROP TABLE IF EXISTS public.deuna_transactions CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;

-- Eliminar funciones
DROP FUNCTION IF EXISTS cleanup_expired_payments() CASCADE;
DROP FUNCTION IF EXISTS get_payment_stats(uuid, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS find_payment(text) CASCADE;
DROP FUNCTION IF EXISTS create_payment(...) CASCADE;
DROP FUNCTION IF EXISTS approve_payment(...) CASCADE;

-- Eliminar vistas
DROP VIEW IF EXISTS payments_with_user CASCADE;
DROP VIEW IF EXISTS payment_summary_by_provider CASCADE;
DROP VIEW IF EXISTS deuna_payments_full CASCADE;

-- Eliminar columnas agregadas a balance_transactions
ALTER TABLE public.balance_transactions 
  DROP COLUMN IF EXISTS payment_gateway,
  DROP COLUMN IF EXISTS payment_id,
  DROP COLUMN IF EXISTS gateway_metadata,
  DROP COLUMN IF EXISTS deuna_transaction_id,
  DROP COLUMN IF EXISTS deuna_transfer_number;
```

---

## ✅ Checklist Post-Migración

- [ ] Tablas `payments`, `deuna_transactions`, `charging_authorizations` existen
- [ ] Columnas nuevas en `balance_transactions` agregadas
- [ ] Índices creados (verificar con pg_indexes)
- [ ] RLS habilitado en todas las tablas
- [ ] Funciones creadas y ejecutables
- [ ] Vistas creadas y consultables
- [ ] Trigger de `updated_at` en payments funciona
- [ ] No hay errores en los logs de Supabase

---

## 📞 Ayuda Adicional

Si tienes problemas:

1. **Revisa los logs de Supabase**:
   - Dashboard → Logs → SQL Logs

2. **Consulta la documentación**:
   - `DATABASE_SCHEMA.md` - Schema completo
   - `004_payments_system.sql` - Comentarios en el código
   - `005_payment_indexes_optimization.sql` - Detalles de optimización

3. **Verifica variables de entorno**:
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

---

## 🎉 ¡Listo!

Una vez completadas las migraciones, puedes:

1. ✅ Usar el `PaymentRepository` en tu código
2. ✅ Crear pagos con Deuna/Stripe/Wallet
3. ✅ Procesar webhooks
4. ✅ Consultar estado de pagos
5. ✅ Generar reportes

**Siguiente paso:** Implementar los API endpoints (Fase 3)
