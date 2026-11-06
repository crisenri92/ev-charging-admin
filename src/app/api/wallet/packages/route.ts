// src/app/api/wallet/packages/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_PACKAGES = [
  { id: 'default-30',  name: 'Pack 30 min',  minutes: 30,  price_usd: 3.00  },
  { id: 'default-60',  name: 'Pack 60 min',  minutes: 60,  price_usd: 5.50  },
  { id: 'default-120', name: 'Pack 120 min', minutes: 120, price_usd: 10.00 },
  { id: 'default-240', name: 'Pack 240 min', minutes: 240, price_usd: 18.00 },
]
export async function GET() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data, error } = await supabase.from('minute_packages')
      .select('id, name, minutes, price_usd, description').eq('active', true)
      .order('display_order', { ascending: true })
    if (error || !data || data.length === 0) return NextResponse.json({ packages: DEFAULT_PACKAGES })
    return NextResponse.json({ packages: data })
  } catch {
    return NextResponse.json({ packages: DEFAULT_PACKAGES })
  }
}