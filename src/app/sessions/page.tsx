'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Session {
  id: string
  charger_id: string | null
  user_id: string | null
  status: string | null
  energy_kwh: number | null
  amount: number | null
  started_at: string | null
  ended_at: string | null
  created_at: string | null
}

function SessionBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Activa',     cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    completed: { label: 'Completada', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    cancelled: { label: 'Cancelada',  cls: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
    error:     { label: 'Error',      cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
  }
  const s = (status ?? 'completed').toLowerCase()
  const m = map[s] ?? map['completed']
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>{m.label}</span>
}

function dur(start: string | null, end: string | null): string {
  if (!start) return '—'
  const ms = new Date(end ?? new Date()).getTime() - new Date(start).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from('charging_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setSessions(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const filtered = sessions.filter(s => {
    if (filter === 'active') return (s.status ?? '').toLowerCase() === 'active'
    if (filter === 'completed') return (s.status ?? '').toLowerCase() === 'completed'
    return true
  })

  const totalEnergy = sessions.reduce((a, s) => a + (s.energy_kwh ?? 0), 0)
  const totalRevenue = sessions.reduce((a, s) => a + (s.amount ?? 0), 0)
  const activeSessions = sessions.filter(s => (s.status ?? '').toLowerCase() === 'active').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Sesiones de Carga</h1>
          <p className="text-sm text-gray-400 mt-0.5">{sessions.length} sesiones totales</p>
        </div>
        <button onClick={fetchSessions} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
          ↻ Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Activas ahora</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {loading ? <span className="inline-block w-8 h-6 bg-gray-700 rounded animate-pulse" /> : activeSessions}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Energía total</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {loading ? <span className="inline-block w-12 h-6 bg-gray-700 rounded animate-pulse" /> : `${totalEnergy.toFixed(1)} kWh`}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Ingresos</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">
            {loading ? <span className="inline-block w-12 h-6 bg-gray-700 rounded animate-pulse" /> : `$${totalRevenue.toFixed(2)}`}
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {(['all', 'active', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
              filter === f ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Completadas'}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-5xl mb-3">⚡</p>
            <p className="font-medium text-gray-400 mb-1">Sin sesiones</p>
            <p className="text-sm">{filter !== 'all' ? 'No hay sesiones con este filtro' : 'Las sesiones aparecerán aquí cuando los usuarios carguen'}</p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Cargador', 'Usuario', 'Estado', 'Duración', 'Energía', 'Monto', 'Inicio'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-white text-sm font-mono">{s.charger_id ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-400 font-mono">
                    {s.user_id ? s.user_id.slice(0, 8) + '...' : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5"><SessionBadge status={s.status} /></td>
                  <td className="px-4 py-3.5 text-sm text-gray-300">{dur(s.started_at, s.ended_at)}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-300">
                    {s.energy_kwh != null ? `${s.energy_kwh.toFixed(3)} kWh` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-emerald-400">
                    {s.amount != null ? `$${s.amount.toFixed(2)}` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">
                    {s.started_at ? new Date(s.started_at).toLocaleString('es-EC', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
