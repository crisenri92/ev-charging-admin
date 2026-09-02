# ⚡ Testing Rápido - 5 Minutos

Guía ultra-rápida para probar el sistema en 5 minutos.

---

## 🚀 Opción 1: Script Automatizado (Más Rápido)

```bash
# En la raíz del proyecto
./scripts/test-system.sh
```

**Salida esperada:**
```
🧪 Testing Sistema de Pagos Multi-Gateway
==========================================

📍 URL Base: http://localhost:3000

🔍 Test 1: Verificando que el servidor está corriendo...
✅ Servidor corriendo

🔍 Test 2: Verificando base de datos...
✅ Base de datos funcionando
{
  "allPassed": true,
  "tablesExist": true,
  "functionsExist": true,
  "repositoryWorks": true
}

🔍 Test 3: Verificando use cases...
✅ Use cases funcionando correctamente
{
  "total": 5,
  "passed": 5,
  "failed": 0,
  "allPassed": true,
  "successRate": "100%"
}

==========================================
📊 RESUMEN
==========================================
✅ Todos los tests pasaron

🎉 Sistema 100% funcional
```

---

## 🧪 Opción 2: Testing Manual (Paso a Paso)

### **1. Iniciar Servidor**

```bash
npm run dev
```

Debería mostrar:
```
▲ Next.js 16.x
- Local:    http://localhost:3000
```

---

### **2. Test de Base de Datos**

```bash
curl http://localhost:3000/api/test-db | jq
```

✅ **Esperado:** `"allPassed": true`

---

### **3. Test de Use Cases**

```bash
curl http://localhost:3000/api/test-use-cases | jq
```

✅ **Esperado:** `"allPassed": true, "successRate": "100%"`

---

### **4. Ver Logs del Servidor**

En la terminal donde corre `npm run dev`, deberías ver logs como:

```
[RechargeWalletUseCase] Starting use case { ... }
[RechargeWalletUseCase] ✅ Use case completed
```

---

## ✅ Todo Funciona - ¿Y Ahora?

Si ambos tests pasaron, puedes:

### **Opción A: Testing con Autenticación**

Ver: `GUIA_TESTING_COMPLETA.md` (Sección "Testing con Autenticación")

### **Opción B: Ver Documentación Completa**

```bash
# Índice de toda la documentación
cat PAYMENT_SYSTEM_INDEX.md
```

### **Opción C: Empezar a Integrar**

Los endpoints ya están listos para usar desde tu frontend:

```typescript
// Ejemplo: Crear pago
const response = await fetch('/api/payments/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    provider: 'deuna',
    context: 'wallet_recharge',
    amount: 20.00
  })
});

const { payment } = await response.json();
console.log(payment.qrCode); // Mostrar al usuario
```

---

## ❌ Si Algo Falló

### **Error: "Servidor no está corriendo"**

```bash
# Iniciar servidor
npm run dev
```

### **Error: "Tablas no existen"**

```bash
# Aplicar migraciones
# Ver: QUICK_START_PHASE2.md
```

O aplicar manualmente en Supabase Dashboard:
1. Ir a SQL Editor
2. Ejecutar `supabase/migrations/004_payments_system.sql`
3. Ejecutar `supabase/migrations/005_payment_indexes_optimization.sql`

### **Error: "Use cases failed"**

```bash
# Ver detalles del error
curl http://localhost:3000/api/test-use-cases | jq '.tests[] | select(.status == "failed")'
```

---

## 📊 Checklist Rápido

- [ ] ✅ Servidor corriendo (`npm run dev`)
- [ ] ✅ Base de datos: `allPassed: true`
- [ ] ✅ Use cases: `allPassed: true`
- [ ] ✅ Logs visibles en consola

**Si todos ✅ → Sistema funcional** 🎉

---

## 🚀 Siguiente Paso

**Testing Completo:**
```bash
# Ver guía completa
cat GUIA_TESTING_COMPLETA.md
```

**O empezar a usar directamente** (los use cases están listos)

---

⏱️ **Tiempo total:** ~5 minutos
