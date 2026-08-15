import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const [chargersRes, sessionsRes, usersRes, revenueRes] = await Promise.all([
    supabase.from('chargers').select('*', { count: 'exact', head: true }),
    supabase.from('charging_sessions').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('charging_sessions').select('cost').gte('created_at', firstOfMonth),
  ])

  const revenue = (revenueRes.data ?? []).reduce((sum: number, s: { cost: number }) => sum + (s.cost ?? 0), 0)

  return {
    chargers: chargersRes.count ?? 0,
    sessionsToday: sessionsRes.count ?? 0,
    users: usersRes.count ?? 0,
    revenueMonth: revenue,
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const cards = [
    { label: 'Cargadores', value: stats.chargers, color: 'bg-blue-500' },
    { label: 'Sesiones hoy', value: stats.sessionsToday, color: 'bg-green-500' },
    { label: 'Usuarios', value: stats.users, color: 'bg-purple-500' },
    { label: 'Revenue mes', value: `$${stats.revenueMonth.toFixed(2)}`, color: 'bg-yellow-500' },
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
            <div className={`${card.color} rounded-full w-12 h-12 flex items-center justify-center text-white font-bold text-lg`}>
              {typeof card.value === 'number' ? card.value : card.value[0]}
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
