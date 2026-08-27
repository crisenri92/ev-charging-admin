'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@supabase/supabase-js'

const ChargerMap = dynamic(() => import('@/components/ChargerMap'), { ssr: false })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface DashboardStats {
  total: number
  available: number
  charging: number
  offline: number
  totalKwh: number | null
  monthRevenue: number | null
  hasSessions: boolean
}

const StatCard = ({
  label, value, sub, gradient, border, text, glow, icon
}: {
  label: string; value: string | number; sub?: string
  gradient: string; border: string; text: string; glow: string; icon: React.ReactNode
}) => (
  <div className={`relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-5 shadow-lg ${glow}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${text}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
      </div>
      <div className={`rounded-xl border ${border} bg-black/20 p-2.5 ${text}`}>{icon}</div>
    </div>
  </div>
)

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0, available: 0, charging: 0, offline: 0,
    totalKwh: null, monthRevenue: null, hasSessions: false
  })
  const [loading, setLoading] = useState(true)
  const [mapChargers, setMapChargers] = useState<any[]>([])

  useEffect(() => {
    async function fetchStats() {
      try {
        // Charger counts
        const { data: chargers } = await supabase.from('chargers').select('status')
        const total = chargers?.length ?? 0
        const available = chargers?.filter(c => c.status === 'Available').length ?? 0
        const charging = chargers?.filter(c => c.status === 'Charging').length ?? 0
        const offline = chargers?.filter(c => c.status === 'Offline' || c.status === 'Unavailable').length ?? 0

        // Try sessions table
        let totalKwh: number | null = null
        let monthRevenue: number | null = null
        let hasSessions = false
        try {
          const now = new Date()
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
          const { data: sessions, error } = await supabase
            .from('charging_sessions')
            .select('energy_kwh, cost, started_at')
            .gte('started_at', firstDay)
          if (!error && sessions) {
            hasSessions = true
            totalKwh = sessions.reduce((a, s) => a + (s.energy_kwh ?? 0), 0)
            monthRevenue = sessions.reduce((a, s) => a + (s.cost ?? 0), 0)
          }
        } catch (_) {}

        setStats({ total, available, charging, offline, totalKwh, monthRevenue, hasSessions })
      } finally {
        setLoading(false)
      }
    }
    fetchStats()

    supabase.from('chargers').select('id, name, status, latitude, longitude').then(({ data }) => {
      if (data) {
        setMapChargers(data.filter((c: any) => c.latitude && c.longitude).map((c: any) => ({
          id: c.id, name: c.name, status: c.status ?? 'Offline',
          lat: c.latitude, lng: c.longitude,
        })))
      }
    })
  }, [])

  const cards = [
    {
      label: 'Total Cargadores', value: loading ? '—' : stats.total, key: 'total' as const,
      gradient: 'from-blue-600/25 via-blue-600/10 to-blue-600/0',
      border: 'border-blue-500/25', text: 'text-blue-300', glow: 'shadow-blue-500/10',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.548-4.26L5.47 16.5a.75.75 0 01-.548-1.263l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'Disponibles', value: loading ? '—' : stats.available, key: 'available' as const,
      gradient: 'from-emerald-600/25 via-emerald-600/10 to-emerald-600/0',
      border: 'border-emerald-500/25', text: 'text-emerald-300', glow: 'shadow-emerald-500/10',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'En Carga', value: loading ? '—' : stats.charging, key: 'charging' as const,
      gradient: 'from-yellow-600/25 via-yellow-600/10 to-yellow-600/0',
      border: 'border-yellow-500/25', text: 'text-yellow-300', glow: 'shadow-yellow-500/10',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 116 0h3a.75.75 0 00.75-.75V15z" />
          <path d="M8.25 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zM15.75 6.75a.75.75 0 00-.75.75v11.25c0 .087.015.17.042.248a3 3 0 015.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 00-3.732-10.104 1.837 1.837 0 00-1.47-.725H15.75z" />
          <path d="M19.5 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
        </svg>
      ),
    },
    {
      label: 'Offline', value: loading ? '—' : stats.offline, key: 'offline' as const,
      gradient: 'from-red-600/25 via-red-600/10 to-red-600/0',
      border: 'border-red-500/25', text: 'text-red-300', glow: 'shadow-red-500/10',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">Estado en tiempo real de la red de carga</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(c => (
          <StatCard key={c.key} label={c.label} value={c.value}
            gradient={c.gradient} border={c.border} text={c.text} glow={c.glow} icon={c.icon} />
        ))}
      </div>

      {stats.hasSessions && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <StatCard
            label="kWh entregados (mes)" value={loading ? '—' : `${(stats.totalKwh ?? 0).toFixed(1)} kWh`}
            gradient="from-purple-600/25 via-purple-600/10 to-purple-600/0"
            border="border-purple-500/25" text="text-purple-300" glow="shadow-purple-500/10"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.548-4.26L5.47 16.5a.75.75 0 01-.548-1.263l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
              </svg>
            }
          />
          <StatCard
            label="Ingresos del mes" value={loading ? '—' : `$${(stats.monthRevenue ?? 0).toFixed(2)}`}
            gradient="from-teal-600/25 via-teal-600/10 to-teal-600/0"
            border="border-teal-500/25" text="text-teal-300" glow="shadow-teal-500/10"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 01-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004zM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 01-.921.42z" />
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.836 3.836 0 00-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 01-.921-.421l-.879-.66a.75.75 0 00-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 001.5 0v-.81a4.124 4.124 0 001.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 00-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 00.933-1.175l-.415-.33a3.836 3.836 0 00-1.719-.755V6z" clipRule="evenodd" />
              </svg>
            }
          />
        </div>
      )}

      {mapChargers.length > 0 && (
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Mapa de cargadores en vivo</h2>
          <ChargerMap chargers={mapChargers} />
        </div>
      )}

      <div className="rounded-2xl border border-gray-700/50 bg-gray-900/50 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Estado de la red</h2>
        <div className="space-y-3">
          {[
            { label: 'Disponibles', value: stats.available, total: stats.total, color: 'bg-emerald-500' },
            { label: 'En Carga', value: stats.charging, total: stats.total, color: 'bg-yellow-500' },
            { label: 'Offline', value: stats.offline, total: stats.total, color: 'bg-red-500' },
          ].map(item => (
            <div key={item.label}>
              <div className="mb-1 flex justify-between text-xs text-gray-400">
                <span>{item.label}</span>
                <span>{item.value} / {item.total}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-800">
                <div
                  className={`h-2 rounded-full ${item.color} transition-all duration-700`}
                  style={{ width: item.total > 0 ? `${(item.value / item.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
