import { NextResponse } from 'next/server'

// Endpoint de testing deshabilitado en producción
export async function GET() {
  return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
}
