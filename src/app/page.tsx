'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Charger {
  id: string
  name: string | null
  status: string
  location: string | null
  power_kw: number | null
}

export default function Dashboard() {
  const [chargers, setChargers] = useState<Charger[]>([])
  const [counts, setCounts] = useState({ total:0, available:0, charging:0, sessions:0 })
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState<Date|null>(null)

  const load = useCallback(async () => {
    const [cr, sr] = await Promise.all([
      supabase.from('chargers').select('*'),
      supabase.from('charging_sessions').select('id').gte('start_time', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    ])
    const data = cr.data || []
    setCounts({
      total: data.length,
      available: data.filter((c: Charger) => c.status?.toLowerCase() === 'available').length,
      charging: data.filter((c: Charger) => c.status?.toLowerCase() === 'charging').length,
      sessions: sr.data?.length || 0,
    })
    setChargers(data)
    setUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('dash').on('postgres_changes',{event:'*',schema:'public',table:'chargers'},load).subscribe()
    const t = setInterval(load, 30000)
    return () => { supabase.removeChannel(ch); clearInterval(t) }
  }, [load])

  const cards = [
    { label:'Total cargadores', value:counts.total, color:'bg-gray-900', icon:'⚡' },
    { label:'Disponibles', value:counts.available, color:'bg-green-600', icon:'✓' },
    { label:'En carga', value:counts.charging, color:'bg-blue-600', icon:'🔋' },
    { label:'Sesiones hoy', value:counts.sessions, color:'bg-purple-600', icon:'📊' },
  ]

  const online = chargers.filter((c: Charger) => c.status?.toLowerCase() !== 'offline')
  const offline2 = chargers.filter((c: Charger) => c.status?.toLowerCase() === 'offline')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
        <p className="text-xs text-gray-400">{updated ? `Actualizado: ${updated.toLocaleTimeString('es-MX')}` : 'Cargando...'}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`${c.color} text-white rounded-xl p-5 shadow`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{c.icon}</span>
              {loading ? <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse"/> : <span className="text-3xl font-bold">{c.value}</span>}
            </div>
            <p className="text-sm text-white/80">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Cargadores en línea</h2>
          <Link href="/chargers" className="text-sm text-blue-600 hover:text-blue-800">Ver todos</Link>
        </div>
        {loading ? <div className="text-center py-8 text-gray-400">Cargando...</div>
        : online.length === 0 ? <div className="text-center py-8 text-gray-400">Sin cargadores en línea</div>
        : (
          <div className="space-y-3">
            {online.map((c: Charger) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${c.status?.toLowerCase()==='charging'?'bg-blue-400':'bg-green-400'}`}/>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${c.status?.toLowerCase()==='charging'?'bg-blue-500':'bg-green-500'}`}/>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.name||c.id}</p>
                    <p className="text-xs text-gray-500">{c.location||'Sin ubicación'}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status?.toLowerCase()==='charging'?'bg-blue-100 text-blue-800':'bg-green-100 text-green-800'}`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && offline2.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Fuera de línea</h2>
          <div className="space-y-2">
            {offline2.map((c: Charger) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-400"/>
                  <p className="text-sm font-medium text-gray-800">{c.name||c.id}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
