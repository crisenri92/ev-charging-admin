'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'

const MapComponent = dynamic(() => import('@/components/ChargerMap'), { ssr: false })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Charger {
  id: string
  name: string | null
  status: string | null
  price_per_kwh: number | null
  latitude: number | null
  longitude: number | null
  last_heartbeat: string | null
}

interface Stats {
  total: number
  available: number
  charging: number
  sessionsToday: number
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    Available: { label: 'Disponible', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
    Charging: { label: 'Cargando', cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
    Faulted: { label: 'Falla', cls: 'bg-red-500/15 text-red-400 border border-red-500/30' },
    Offline: { label: 'Offline', cls: 'bg-gray-500/15 text-gray-400 border border-gray-500/30' },
  }
  const s = status ?? 'Offline'
  const { label, cls } = map[s] ?? map['Offline']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />{label}
    </span>
  )
}

const kpiDefs = [
  {
    label: 'Total Cargadores',
    key: 'total' as const,
    gradient: 'from-blue-600/25 via-blue-600/10 to-blue-600/0',
    border: 'border-blue-500/25',
    text: 'text-blue-300',
    glow: 'shadow-blue-500/10',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.268a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Disponibles',
    key: 'available' as const,
    gradient: 'from-emerald-600/25 via-emerald-600/10 to-emerald-600/0',
    border: 'border-emerald-500/25',
    text: 'text-emerald-300',
    glow: 'shadow-emerald-500/10',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'En Carga',
    key: 'charging' as const,
    gradient: 'from-yellow-600/25 via-yellow-600/10 to-yellow-600/0',
    border: 'border-yellow-500/25',
    text: 'text-yellow-300',
    glow: 'shadow-yellow-500/10',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 116 0h3a.75.75 0 00.75-.75V15z" />
        <path d="M8.25 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zM15.75 6.75a.75.75 0 00-.75.75v11.25c0 .087.015.17.042.248a3 3 0 015.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 00-3.732-10.104 1.837 1.837 0 00-1.47-.725H15.75z" />
        <path d="M19.5 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
      </svg>
    ),
  },
  {
    label: 'Sesiones Hoy',
    key: 'sessionsToday' as const,
    gradient: 'from-purple-600/25 via-purple-600/10 to-purple-600/0',
    border: 'border-purple-500/25',
    text: 'text-purple-300',
    glow: 'shadow-purple-500/10',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375z" clipRule="evenodd" />
      </svg>
    ),
  },
]

export default function Dashboard() {
  const [chargers, setChargers] = useState<Charger[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, available: 0, charging: 0, sessionsToday: 0 })
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchData = useCallback(async () => {
    const [{ data: chargerData }, { count: sessionCount }] = await Promise.all([
      supabase.from('chargers').select('id,name,status,price_per_kwh,latitude,longitude,last_heartbeat').order('created_at'),
      supabase.from('charging_sessions').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().slice(0, 10)),
    ])
    const list = chargerData ?? []
    setChargers(list)
    setStats({
      total: list.length,
      available: list.filter(c => c.status === 'Available').length,
      charging: list.filter(c => c.status === 'Charging').length,
      sessionsToday: sessionCount ?? 0,
    })
    setLastUpdate(new Date().toLocaleTimeString('es-EC'))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30000)
    return () => clearInterval(timer)
  }, [fetchData])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {lastUpdate ? `Actualizado: ${lastUpdate}` : 'Cargando...'}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
          </svg>
          Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
        {kpiDefs.map(k => (
          <div
            key={k.label}
            className={`relative overflow-hidden bg-gradient-to-br ${k.gradient} border ${k.border} rounded-xl p-4 shadow-lg ${k.glow}`}
          >
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{k.label}</p>
            <p className={`text-3xl font-bold mt-1 ${k.text}`}>
              {loading
                ? <span className="inline-block w-8 h-8 bg-gray-700/60 rounded animate-pulse" />
                : stats[k.key]}
            </p>
            <span className={`absolute right-3 top-3 opacity-20 ${k.text}`}>{k.icon}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-400">
            <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.083 3.964-5.129 3.964-8.827a8.25 8.25 0 00-16.5 0c0 3.698 2.02 6.744 3.964 8.827a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.144.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Ubicación de Cargadores
        </h2>
        <MapComponent
          chargers={chargers
            .filter(c => c.latitude != null && c.longitude != null)
            .map(c => ({ id: c.id, name: c.name, status: c.status ?? 'Unknown', location: null, lat: c.latitude!, lng: c.longitude! }))}
        />
      </div>

      {/* Charger Status List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Estado de Cargadores</h2>
          <a href="/chargers" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Ver todos →</a>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : chargers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 mx-auto mb-2 opacity-30">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.268a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
            </svg>
            <p className="text-sm">No hay cargadores registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {chargers.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-white text-sm truncate">{c.name || c.id}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.latitude ? `${c.latitude.toFixed(4)}, ${c.longitude?.toFixed(4)}` : 'Sin coordenadas'}
                    {c.price_per_kwh ? ` · $${c.price_per_kwh}/kWh` : ''}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
