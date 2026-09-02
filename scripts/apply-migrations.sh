#!/bin/bash
# ============================================
# Script para aplicar migraciones de pagos
# ============================================

set -e  # Exit on error

echo "🚀 Aplicando migraciones del sistema de pagos..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que existe el archivo .env
if [ ! -f .env ]; then
  echo -e "${RED}❌ No se encontró archivo .env${NC}"
  echo "Copia .env.example a .env y configura las variables"
  exit 1
fi

# Cargar variables de entorno
export $(cat .env | grep -v '^#' | xargs)

# Verificar variables requeridas
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}❌ Faltan variables de entorno de Supabase${NC}"
  echo "Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env"
  exit 1
fi

echo -e "${YELLOW}📍 Supabase URL: $NEXT_PUBLIC_SUPABASE_URL${NC}"
echo ""

# Función para ejecutar SQL en Supabase
execute_sql() {
  local file=$1
  local name=$2
  
  echo -e "${YELLOW}⏳ Aplicando: $name...${NC}"
  
  # Leer archivo SQL
  sql_content=$(cat "$file")
  
  # Ejecutar usando la API REST de Supabase
  response=$(curl -s -X POST \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"sql\": $(echo "$sql_content" | jq -Rs .)}" \
  )
  
  # Verificar errores
  if echo "$response" | grep -q "error"; then
    echo -e "${RED}❌ Error aplicando $name${NC}"
    echo "$response"
    return 1
  fi
  
  echo -e "${GREEN}✅ $name aplicada correctamente${NC}"
  echo ""
}

# Aplicar migraciones en orden
echo "📦 Migraciones a aplicar:"
echo "  1. Sistema de Pagos (004)"
echo "  2. Índices y Optimizaciones (005)"
echo ""

read -p "¿Continuar? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operación cancelada"
  exit 0
fi

echo ""
echo "🔄 Iniciando aplicación de migraciones..."
echo ""

# Migración 004
if [ -f "supabase/migrations/004_payments_system.sql" ]; then
  execute_sql "supabase/migrations/004_payments_system.sql" "004_payments_system"
else
  echo -e "${RED}❌ No se encontró 004_payments_system.sql${NC}"
  exit 1
fi

# Migración 005
if [ -f "supabase/migrations/005_payment_indexes_optimization.sql" ]; then
  execute_sql "supabase/migrations/005_payment_indexes_optimization.sql" "005_payment_indexes_optimization"
else
  echo -e "${RED}❌ No se encontró 005_payment_indexes_optimization.sql${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}🎉 ¡Todas las migraciones se aplicaron correctamente!${NC}"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Verificar las tablas en Supabase Dashboard"
echo "  2. Ejecutar: npm run dev"
echo "  3. Probar el sistema de pagos"
echo ""
