# 🚀 Quick Start - Fase 2

## ✅ Fase 2 Completada

Ya se implementó toda la base de datos para el sistema de pagos. Ahora solo falta aplicar las migraciones.

---

## 📋 Pasos Rápidos (5 minutos)

### 1️⃣ Aplicar Migraciones en Supabase

#### Opción A: Dashboard (Más fácil)

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Click en **SQL Editor** (menú lateral)
4. Click en **New Query**

5. **Primera migración:**
   - Abre: `supabase/migrations/004_payments_system.sql`
   - Copia TODO el contenido
   - Pega en el editor
   - Click en **Run** (o Ctrl+Enter)
   - Espera: "Success. No rows returned"

6. **Segunda migración:**
   - Click en **New Query** nuevamente
   - Abre: `supabase/migrations/005_payment_indexes_optimization.sql`
   - Copia TODO el contenido
   - Pega en el editor
   - Click en **Run**
   - Espera: "Success"

---

### 2️⃣ Verificar que Funcionó

En el mismo SQL Editor, ejecuta:

```sql
-- Debe retornar 3 tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('payments', 'deuna_transactions', 'charging_authorizations');
```

Si retorna 3 filas: **✅ ¡Éxito!**

---

### 3️⃣ (Opcional) Test desde el Código

```bash
# En tu proyecto
npm run dev
```

Luego visita: `http://localhost:3000/api/test-db`

Deberías ver un JSON con:
```json
{
  "summary": {
    "allPassed": true,
    "totalTests": 5,
    "passedTests": 5
  }
}
```

---

## 🎯 ¿Qué se Creó?

### ✅ 4 Tablas
- `payments` - Todos los pagos
- `deuna_transactions` - Info de Deuna
- `charging_authorizations` - Autorizaciones de carga
- `balance_transactions` - Actualizada con nuevas columnas

### ✅ 5 Funciones SQL
- `cleanup_expired_payments()`
- `get_payment_stats(...)`
- `find_payment(...)`
- `create_payment(...)`
- `approve_payment(...)`

### ✅ 3 Vistas
- `payments_with_user`
- `payment_summary_by_provider`
- `deuna_payments_full`

### ✅ 15+ Índices Optimizados

### ✅ PaymentRepository en TypeScript
Listo para usar en tu código.

---

## 📝 Uso Inmediato

Ya puedes empezar a usar el sistema:

```typescript
import { getPaymentRepository } from '@/lib/database/payment-repository';
import { PaymentProvider, PaymentContext } from '@/lib/payments';

const repo = getPaymentRepository();

// Crear un pago
const payment = await repo.createPayment({
  paymentId: 'deuna-123',
  internalReference: 'CHG001',
  userId: user.id,
  provider: PaymentProvider.DEUNA,
  context: PaymentContext.WALLET_RECHARGE,
  amount: 20.00,
  description: 'Recarga',
});

// Buscar un pago
const found = await repo.findByPaymentId('deuna-123');

// Actualizar estado
await repo.updatePaymentStatus(
  payment.id,
  PaymentStatus.APPROVED
);
```

---

## ❓ Si Algo Falla

### Error: "relation already exists"
Ya existe la tabla. Puedes:
- Ignorarlo (la migración usa `IF NOT EXISTS`)
- O ejecutar el rollback en `MIGRATION_GUIDE.md`

### Error: "permission denied"
Asegúrate de estar en el SQL Editor de Supabase Dashboard (ya tiene permisos).

### Otros errores
Ver: `supabase/MIGRATION_GUIDE.md` - Sección Troubleshooting

---

## 📚 Documentación Completa

- **`PHASE_2_SUMMARY.md`** - Resumen de todo lo implementado
- **`supabase/DATABASE_SCHEMA.md`** - Schema completo
- **`supabase/MIGRATION_GUIDE.md`** - Guía paso a paso
- **`src/lib/database/payment-repository.ts`** - API de repositorio

---

## 🚀 Siguiente Paso

**Fase 3: API Endpoints**

Una vez aplicadas las migraciones, puedes continuar con:
- Crear endpoints unificados de pagos
- Implementar webhooks de Deuna
- Integrar con el frontend

---

## ✅ Checklist

- [ ] Migración 004 aplicada
- [ ] Migración 005 aplicada
- [ ] 3 tablas verificadas
- [ ] Test endpoint retorna `allPassed: true`
- [ ] Listo para Fase 3

**¿Todo listo?** ¡Continuemos con la Fase 3! 🎉
