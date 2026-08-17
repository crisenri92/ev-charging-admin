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
  const map: Record<string, { label: string; dot: string; cls: string }> = {
    active: { label: 'Activa', dot: 'bg-blue-400 animate-pulse', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    completed: { label: 'Completada', dot: 'bg-emerald-400', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    cancelled: { label: 'Cancelada', dot: 'bg-gray-400', cls: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
    error: { label: 'Error', dot: 'bg-red-400', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
  }
  const s = (status ?? 'completed').toLowerCase()
  const m = map[s] ?? map['completed']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

function dur(start: string | null, end: string | null): string {
  if (!start) return '—'
  const ms = new Date(end ?? new Date()).getTime() - new Date(start).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 0) return '—'
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

  // KPIs actualizen con el filtro activo
  const kpiSource = filter === 'all' ? sessions : filtered
  const totalEnergy = kpiSource.reduce((a, s) => a + (s.energy_kwh ?? 0), 0)
  const totalRevenue = kpiSource.reduce((a, s) => a + (s.amount ?? 0), 0)
  const activeSessions = sessions.filter(s => (s.status ?? '').toLowerCase() === 'active').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Sesiones de Carga</h1>
          <p className="text-sm text-gray-400 mt-0.5">{sessions.length} sesiones totales</p>
        </div>
        <button
          onClick={fetchSessions}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
          </svg>
          Actualizar
        </button>
      </div>

      {/* Mini-KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Activas ahora</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {loading ? <span className="inline-block w-8 h-6 bg-gray-700 rounded animate-pulse" /> : activeSessions}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
            Energía {filter !== 'all' ? `(${filter === 'active' ? 'activas' : 'completadas'})` : 'total'}
          </p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {loading ? <span className="inline-block w-12 h-6 bg-gray-700 rounded animate-pulse" /> : `${totalEnergy.toFixed(1)} kWh`}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
            Ingresos {filter !== 'all' ? `(${filter === 'active' ? 'activas' : 'completadas'})` : 'total'}
          </p>
          <p className="text-2xl font-bold text-purple-400 mt-1">
            {loading ? <span className="inline-block w-12 h-6 bg-gray-700 rounded animate-pulse" /> : `$${totalRevenue.toFixed(2)}`}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
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
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-20">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.268a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
            </svg>
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
                    {s.started_at
                      ? new Date(s.started_at).toLocaleString('es-EC', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'}
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
