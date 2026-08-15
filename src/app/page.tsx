'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Charger {
  id: string
  name: string | null
  location: string | null
  status: 'available' | 'charging' | 'offline'
  type: string | null
  power_kw: number | null
}

interface KPIs {
  total: number
  available: number
  charging: number
  sessionsToday: number
}

export default function Dashboard() {
  const [chargers, setChargers] = useState<Charger[]>([])
  const [kpis, setKpis] = useState<KPIs>({ total: 0, available: 0, charging: 0, sessionsToday: 0 })
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    const [chargersRes, sessionsRes] = await Promise.all([
      supabase.from('chargers').select('*'),
      supabase.from('charging_sessions').select('id').gte('start_time', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    ])

    const data = chargersRes.data || []
    setChargers(data)
    setKpis({
      total: data.length,
      available: data.filter(c => c.status === 'available').length,
      charging: data.filter(c => c.status === 'charging').length,
      sessionsToday: sessionsRes.data?.length || 0,
    })
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chargers' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'charging_sessions' }, fetchData)
      .subscribe()

    const interval = setInterval(fetchData, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchData])

  const kpiCards = [
    { label: 'Total cargadores', value: kpis.total, color: 'bg-gray-900', icon: '⚡' },
    { label: 'Disponibles', value: kpis.available, color: 'bg-green-600', icon: '✓' },
    { label: 'En carga', value: kpis.charging, color: 'bg-blue-600', icon: '🔋' },
    { label: 'Sesiones hoy', value: kpis.sessionsToday, color: 'bg-purple-600', icon: '📊' },
  ]

  const onlineChargers = chargers.filter(c => c.status !== 'offline')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
        <div className="text-xs text-gray-400">
          {lastUpdated ? `Actualizado: ${lastUpdated.toLocaleTimeString('es-MX')}` : 'Cargando...'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className={`${card.color} text-white rounded-xl p-5 shadow`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              {loading ? (
                <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse" />
              ) : (
                <span className="text-3xl font-bold">{card.value}</span>
              )}
            </div>
            <p className="text-sm text-white/80">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Online Chargers */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Cargadores en línea</h2>
          <Link href="/chargers" className="text-sm text-blue-600 hover:text-blue-800">Ver todos →</Link>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando...</div>
        ) : onlineChargers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Sin cargadores en línea</div>
        ) : (
          <div className="space-y-3">
            {onlineChargers.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${c.status === 'charging' ? 'bg-blue-400' : 'bg-green-400'}`} />
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${c.status === 'charging' ? 'bg-blue-500' : 'bg-green-500'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.name || c.id}</p>
                    <p className="text-xs text-gray-500">{c.location || 'Sin ubicación'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'charging' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {c.status}
                  </span>
                  {c.power_kw && <p className="text-xs text-gray-500 mt-1">{c.power_kw} kW</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Offline Chargers (if any) */}
      {!loading && chargers.filter(c => c.status === 'offline').length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Cargadores fuera de línea</h2>
          <div className="space-y-2">
            {chargers.filter(c => c.status === 'offline').map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.name || c.id}</p>
                    <p className="text-xs text-gray-500">{c.location || 'Sin ubicación'}</p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">offline</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
