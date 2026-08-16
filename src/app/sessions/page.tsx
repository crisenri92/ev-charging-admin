'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Session {
  id: string
  charger_id: string
  user_id: string | null
  status: string
  energy_kwh: number | null
  duration: number | null
  cost: number | null
  created_at: string
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCharger, setFilterCharger] = useState('')

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('charging_sessions').select('*').order('created_at', { ascending: false })
    if (filterCharger) query = query.ilike('charger_id', '%' + filterCharger + '%')
    const { data } = await query
    setSessions(data || [])
    setLoading(false)
  }, [filterCharger])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const exportCSV = () => {
    const headers = ['ID','Cargador','Estado','Duracion (min)','kWh','Costo','Fecha']
    const rows = sessions.map(s => [
      s.id,
      s.charger_id,
      s.status,
      s.duration ?? '',
      s.energy_kwh ?? '',
      s.cost != null ? '$' + s.cost.toFixed(2) : '',
      s.created_at ? new Date(s.created_at).toLocaleString('es-EC') : ''
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sesiones_' + new Date().toISOString().slice(0,10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Sesiones de Carga</h1>
        <button onClick={exportCSV} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
          Exportar CSV
        </button>
      </div>
      <div className="flex gap-3 mb-4">
        <input
          value={filterCharger}
          onChange={e => setFilterCharger(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchSessions()}
          placeholder="Filtrar por cargador..."
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm flex-1"
        />
        <button onClick={fetchSessions} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600">
          Buscar
        </button>
      </div>
      {loading ? (
        <p className="text-center text-gray-400 py-10">Cargando...</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-800">
              <tr>
                {['ID', 'Usuario', 'Cargador', 'Estado', 'Duracion', 'kWh', 'Costo', 'Fecha'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-gray-800">
                  <td className="px-6 py-4 text-xs text-gray-500 font-mono">{s.id.slice(0,8)}...</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{s.user_id ? s.user_id.slice(0,8) + '...' : '—'}</td>
                  <td className="px-6 py-4 text-sm text-white font-medium">{s.charger_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{s.status}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{s.duration != null ? s.duration + ' min' : '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{s.energy_kwh != null ? s.energy_kwh + ' kWh' : '—'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-green-400">{s.cost != null ? '$' + s.cost.toFixed(2) : '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{s.created_at ? new Date(s.created_at).toLocaleString('es-EC') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.length === 0 && (
            <p className="text-center py-10 text-gray-400">No hay sesiones registradas.</p>
          )}
        </div>
      )}
    </div>
  )
}
