'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Session {
  id: string
  status: string
  started_at: string
  ended_at: string | null
  energy_kwh: number | null
  cost: number | null
  charger_id: string
  charger_name: string | null
  stop_reason: string | null
}

const statusColor: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  completed: 'bg-blue-500/10 text-blue-400',
  error: 'bg-red-500/10 text-red-400',
}

function duration(s: Session) {
  if (!s.started_at || !s.ended_at) return '—'
  const diff = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000
  return `${Math.round(diff)} min`
}

export default function UserSessionsPage() {
  const { id } = useParams<{ id: string }>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/users/${id}/sessions`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSessions(data)
        else setError(data.error || 'Error cargando sesiones')
      })
      .catch(() => setError('Error de red'))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/users" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Usuarios
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-white">Historial de cargas</h2>
          <p className="text-gray-400 mt-1 text-sm font-mono">{id}</p>
        </div>
      </div>

      {loading && <p className="text-gray-400">Cargando sesiones...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-center py-12">Sin sesiones de carga registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
                  <th className="text-left px-6 py-3">Fecha inicio</th>
                  <th className="text-left px-6 py-3">Cargador</th>
                  <th className="text-left px-6 py-3">Duración</th>
                  <th className="text-left px-6 py-3">kWh</th>
                  <th className="text-left px-6 py-3">Costo</th>
                  <th className="text-left px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-6 py-4 text-gray-300">
                      {new Date(s.started_at).toLocaleString('es-MX', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-6 py-4 text-white">{s.charger_name || s.charger_id}</td>
                    <td className="px-6 py-4 text-gray-300">{duration(s)}</td>
                    <td className="px-6 py-4 text-gray-300">
                      {s.energy_kwh != null ? `${s.energy_kwh.toFixed(3)} kWh` : '—'}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {s.cost != null ? `$${s.cost.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          statusColor[s.status] || 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
