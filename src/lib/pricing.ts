import { createClient } from '@supabase/supabase-js'

interface PricingRule {
  id: string
  name: string
  price_per_kwh: number
  start_hour: number
  end_hour: number
  days_of_week: number[]
  active: boolean
  priority: number
}

// Returns the applicable price for a given date (defaults to now)
export async function getCurrentPrice(serviceRoleKey: string, date = new Date()): Promise<{ price: number; ruleName: string }> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: false })

  if (!rules || rules.length === 0) return { price: 0.15, ruleName: 'Tarifa base' }

  // Ecuador is UTC-5; adjust hour
  const hour = (date.getUTCHours() - 5 + 24) % 24
  const dayOfWeek = date.getDay() // 0=Sunday

  // Find highest-priority rule that matches current time
  for (const rule of rules as PricingRule[]) {
    if (!rule.days_of_week.includes(dayOfWeek)) continue

    const { start_hour: s, end_hour: e } = rule
    // Handle overnight rules (e.g. 22:00 -> 06:00)
    const matches = s <= e
      ? hour >= s && hour < e
      : hour >= s || hour < e

    if (matches) return { price: Number(rule.price_per_kwh), ruleName: rule.name }
  }

  // Fallback to lowest-priority (base) rule
  const base = (rules as PricingRule[]).at(-1)!
  return { price: Number(base.price_per_kwh), ruleName: base.name }
}
