
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
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-current" />{label}
  </span>
}

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

  const kpis = [
    { label: 'Total Cargadores', value: stats.total, icon: '⚡', color: 'from-blue-600/20 to-blue-600/5', border: 'border-blue-500/20', text: 'text-blue-400' },
    { label: 'Disponibles', value: stats.available, icon: '✓', color: 'from-emerald-600/20 to-emerald-600/5', border: 'border-emerald-500/20', text: 'text-emerald-400' },
    { label: 'En Carga', value: stats.charging, icon: '↯', color: 'from-yellow-600/20 to-yellow-600/5', border: 'border-yellow-500/20', text: 'text-yellow-400' },
    { label: 'Sesiones Hoy', value: stats.sessionsToday, icon: '📋', color: 'from-purple-600/20 to-purple-600/5', border: 'border-purple-500/20', text: 'text-purple-400' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Actualizado: {lastUpdate || '—'}</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
          ↻ Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className={`relative overflow-hidden bg-gradient-to-br ${k.color} border ${k.border} rounded-xl p-4`}>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{k.label}</p>
            <p className={`text-3xl font-bold mt-1 ${k.text}`}>
              {loading ? <span className="inline-block w-8 h-8 bg-gray-700 rounded animate-pulse" /> : k.value}
            </p>
            <span className="absolute right-3 top-3 text-2xl opacity-30">{k.icon}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">📍 Ubicación de Cargadores</h2>
        <MapComponent chargers={chargers.filter(c => c.latitude != null && c.longitude != null).map(c => ({ id: c.id, name: c.name, status: c.status ?? "Unknown", location: null, lat: c.latitude!, lng: c.longitude! }))} />
      </div>

      {/* Charger Status List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Estado de Cargadores</h2>
          <a href="/chargers" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Ver todos →</a>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : chargers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-4xl mb-2">⚡</p>
            <p className="text-sm">No hay cargadores registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {chargers.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors group">
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
