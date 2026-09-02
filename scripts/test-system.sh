#!/bin/bash

# Script de testing automático del sistema de pagos
# Ejecutar: ./scripts/test-system.sh

echo "🧪 Testing Sistema de Pagos Multi-Gateway"
echo "=========================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# URL base
BASE_URL="http://localhost:3000"

echo "📍 URL Base: $BASE_URL"
echo ""

# ============================================
# TEST 1: Servidor corriendo
# ============================================
echo "🔍 Test 1: Verificando que el servidor está corriendo..."
if curl -s -f "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor corriendo${NC}"
else
    echo -e "${RED}❌ Servidor no está corriendo${NC}"
    echo "   Ejecuta: npm run dev"
    exit 1
fi
echo ""

# ============================================
# TEST 2: Test de Base de Datos
# ============================================
echo "🔍 Test 2: Verificando base de datos..."
DB_TEST=$(curl -s "$BASE_URL/api/test-db")
DB_PASSED=$(echo $DB_TEST | grep -o '"allPassed":true' | wc -l)

if [ $DB_PASSED -gt 0 ]; then
    echo -e "${GREEN}✅ Base de datos funcionando${NC}"
    echo "$DB_TEST" | jq '.summary' 2>/dev/null || echo "$DB_TEST"
else
    echo -e "${RED}❌ Problemas con la base de datos${NC}"
    echo "$DB_TEST" | jq '.' 2>/dev/null || echo "$DB_TEST"
    echo ""
    echo "Aplica las migraciones primero (ver QUICK_START_PHASE2.md)"
fi
echo ""

# ============================================
# TEST 3: Test de Use Cases
# ============================================
echo "🔍 Test 3: Verificando use cases..."
UC_TEST=$(curl -s "$BASE_URL/api/test-use-cases")
UC_PASSED=$(echo $UC_TEST | grep -o '"allPassed":true' | wc -l)

if [ $UC_PASSED -gt 0 ]; then
    echo -e "${GREEN}✅ Use cases funcionando correctamente${NC}"
    echo "$UC_TEST" | jq '.summary' 2>/dev/null || echo "$UC_TEST"
else
    echo -e "${RED}❌ Problemas con use cases${NC}"
    echo "$UC_TEST" | jq '.' 2>/dev/null || echo "$UC_TEST"
fi
echo ""

# ============================================
# RESUMEN
# ============================================
echo "=========================================="
echo "📊 RESUMEN"
echo "=========================================="

if [ $DB_PASSED -gt 0 ] && [ $UC_PASSED -gt 0 ]; then
    echo -e "${GREEN}✅ Todos los tests pasaron${NC}"
    echo ""
    echo "🎉 Sistema 100% funcional"
    echo ""
    echo "Próximos pasos:"
    echo "  1. Ver GUIA_TESTING_COMPLETA.md para testing manual"
    echo "  2. Obtener un token de autenticación"
    echo "  3. Probar endpoints con curl"
    echo ""
else
    echo -e "${YELLOW}⚠️  Algunos tests fallaron${NC}"
    echo ""
    echo "Revisa los errores arriba y:"
    echo "  1. Verifica que las migraciones estén aplicadas"
    echo "  2. Verifica que las variables de entorno estén configuradas"
    echo "  3. Revisa los logs del servidor"
    echo ""
fi
