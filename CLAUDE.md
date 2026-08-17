@AGENTS.md


## Problema conocido: CHARGER_001 duplicado (OCPP)

**Síntoma:** El servidor OCPP crea `CHARGER_001` y `CHARGER001` como dos registros distintos en Supabase.

**Causa:** El servidor OCPP externo usa `chargePointId = "CHARGER_001"` (con guión bajo), pero los registros existentes en Supabase usan `"CHARGER001"` (sin guión bajo).

**No hay API route en este proyecto** que maneje eventos OCPP (boot/heartbeat). El servidor OCPP conecta directamente a Supabase.

**Solución pendiente:** En el servidor OCPP (código externo), normalizar el `chargePointId` antes del upsert:

```ts
const normalizedId = chargePointId.replace(/_/g, '').toUpperCase()
// "CHARGER_001" → "CHARGER001"
```

Si se agrega un endpoint `/api/ocpp/route.ts` en el futuro, aplicar la normalización ahí antes de cualquier operación Supabase.
