import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Session = {
  id: string
  user_id?: string
  charger_id?: string
  status?: string
  duration?: number
  kwh?: number
  cost?: number
  created_at?: string
}

export default async function SessionsPage() {
  const { data: sessions, error } = await supabase
    .from('charging_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return <div className="p-6 text-red-600">Error cargando datos: {error.message}</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Sesiones de Carga</h1>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['ID', 'Usuario', 'Cargador', 'Estado', 'Duración', 'kWh', 'Costo', 'Fecha'].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(sessions as Session[]).map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{s.id.slice(0, 8)}…</td>
                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{s.user_id?.slice(0, 8) ?? '—'}…</td>
                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{s.charger_id?.slice(0, 8) ?? '—'}…</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    s.status === 'completed' ? 'bg-green-100 text-green-800' :
                    s.status === 'active' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>{s.status ?? '—'}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{s.duration != null ? `${s.duration} min` : '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{s.kwh != null ? `${s.kwh} kWh` : '—'}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.cost != null ? `$${s.cost.toFixed(2)}` : '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-400">{s.created_at ? new Date(s.created_at).toLocaleString('es-MX') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions?.length === 0 && (
          <p className="text-center py-10 text-gray-400">No hay sesiones registradas.</p>
        )}
      </div>
    </div>
  )
}
