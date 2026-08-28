'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Session {
  id: string
  charger_name: string | null
  charger_id: string
  started_at: string
  ended_at: string | null
  energy_kwh: number | null
  cost: number | null
  status: string
}

export default function HistorialPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/mobile/login'); return }
      const { data } = await supabase
        .from('charging_sessions')
        .select('id, charger_name, charger_id, started_at, ended_at, energy_kwh, cost, status')
        .eq('user_id', session.user.id)
        .order('started_at', { ascending: false })
        .limit(50)
      setSessions(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function duration(start: string, end: string | null) {
    if (!end) return 'En curso'
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const mins = Math.floor(diff / 60000)
    return mins < 60 ? `${mins} min` : `${Math.floor(mins/60)}h ${mins%60}m`
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#111827' }}>
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen text-white pb-24 px-4 pt-6" style={{ background: '#111827' }}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-lg">←</button>
        <h1 className="text-xl font-bold">Historial de cargas</h1>
      </div>

      {sessions.length === 0 && (
        <div className="bg-gray-900 rounded-xl p-8 text-center">
          <p className="text-4xl mb-3">⚡</p>
          <p className="text-gray-500 text-sm">Aún no tienes sesiones de carga</p>
        </div>
      )}

      <div className="space-y-3">
        {sessions.map(s => (
          <div key={s.id} className="bg-gray-900 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white font-semibold text-sm">{s.charger_name || s.charger_id}</p>
                <p className="text-gray-500 text-xs mt-0.5">{formatDate(s.started_at)}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                s.status === 'completed' ? 'bg-green-900/60 text-green-400' :
                s.status === 'active' ? 'bg-yellow-900/60 text-yellow-400' :
                'bg-gray-800 text-gray-400'
              }`}>
                {s.status === 'completed' ? 'Completada' : s.status === 'active' ? 'En curso' : s.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <p className="text-gray-500 text-xs mb-1">Duración</p>
                <p className="text-white text-sm font-medium">{duration(s.started_at, s.ended_at)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <p className="text-gray-500 text-xs mb-1">Energía</p>
                <p className="text-white text-sm font-medium">{s.energy_kwh != null ? `${s.energy_kwh.toFixed(2)} kWh` : '—'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <p className="text-gray-500 text-xs mb-1">Costo</p>
                <p className="text-green-400 text-sm font-bold">{s.cost != null ? `$${s.cost.toFixed(2)}` : '—'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
