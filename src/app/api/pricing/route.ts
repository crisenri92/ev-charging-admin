import { NextResponse } from 'next/server'
import { getCurrentPrice } from '@/lib/pricing'

export async function GET() {
  try {
    const result = await getCurrentPrice(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ price: 0.15, ruleName: 'Tarifa base' })
  }
}
