'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const ChargerMap = dynamic(() => import('@/components/ChargerMap'), { ssr: false })

interface Charger {
  id: string
  name: string | null
  status: string
  address: string | null
  power_kw: number | null
  latitude: number | null
  longitude: number | null
}

// Known coordinates for chargers (fallback if no lat/lon in DB)
const KNOWN_COORDS: Record<string, [number, number]> = {
  'CHARGER001': [-0.2295, -78.5243],  // Quito, Ecuador - update with real coords
}

const DEFAULT_COORDS: [number, number] = [-0.2295, -78.5243]

export default function Dashboard() {
  const [chargers, setChargers] = useState<Charger[]>([])
  const [counts, setCounts] = useState({ total: 0, available: 0, charging: 0, sessions: 0 })
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    const [cr, sr] = await Promise.all([
      supabase.from('chargers').select('*'),
      supabase.from('charging_sessions').select('id').gte(
        'start_time',
        new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      ),
    ])
    const data: Charger[] = cr.data || []
    setCounts({
      total: data.length,
      available: data.filter((c) => c.status?.toLowerCase() === 'available').length,
      charging: data.filter((c) => c.status?.toLowerCase() === 'charging').length,
      sessions: sr.data?.length || 0,
    })
    setChargers(data)
    setUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chargers' }, load)
      .subscribe()
    const t = setInterval(load, 30000)
    return () => { supabase.removeChannel(ch); clearInterval(t) }
  }, [load])

  const mapChargers = chargers.map((c) => {
    const coords = (c.latitude && c.longitude)
      ? [c.latitude, c.longitude] as [number, number]
      : KNOWN_COORDS[c.id] || DEFAULT_COORDS
    return { ...c, lat: coords[0], lng: coords[1] }
  })

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const stats = [
    { label: 'Total Cargadores', value: counts.total, color: 'bg-blue-500', icon: '⚡' },
    { label: 'Disponibles', value: counts.available, color: 'bg-green-500', icon: '✅' },
    { label: 'En Carga', value: counts.charging, color: 'bg-yellow-500', icon: '🔋' },
    { label: 'Sesiones Hoy', value: counts.sessions, color: 'bg-purple-500', icon: '📅' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          {updated && (
            <p className="text-gray-400 text-sm mt-1">
              Actualizado: {updated.toLocaleTimeString('es-EC')}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-2 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-gray-800 rounded-xl p-5 flex items-center gap-4">
                <div className={`${s.color} rounded-full w-12 h-12 flex items-center justify-center text-xl shrink-0`}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{s.label}</p>
                  <p className="text-white text-2xl font-bold">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Map */}
          <div className="bg-gray-800 rounded-xl p-4 mb-8">
            <h2 className="text-white font-semibold mb-3">🗺️ Ubicación de Cargadores</h2>
            <ChargerMap chargers={mapChargers} />
          </div>

          {/* Charger list */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-white font-semibold mb-3">Estado de Cargadores</h2>
            <div className="space-y-2">
              {chargers.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay cargadores registrados.</p>
              ) : chargers.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white font-medium">{c.name || c.id}</p>
                    <p className="text-gray-400 text-xs">{c.address || 'Sin ubicación'} &bull; {c.power_kw ? `${c.power_kw} kW` : 'N/A'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    c.status?.toLowerCase() === 'available' ? 'bg-green-900 text-green-300'
                    : c.status?.toLowerCase() === 'charging' ? 'bg-blue-900 text-blue-300'
                    : 'bg-gray-600 text-gray-300'
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right">
              <Link href="/chargers" className="text-blue-400 hover:text-blue-300 text-sm">Ver todos los cargadores →</Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
