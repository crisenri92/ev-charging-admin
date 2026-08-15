import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Charger = {
  id: string
  name?: string
  location?: string
  status?: string
  type?: string
  power_kw?: number
  created_at?: string
}

export default async function ChargersPage() {
  const { data: chargers, error } = await supabase
    .from('chargers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="p-6 text-red-600">Error cargando datos: {error.message}</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cargadores</h1>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['ID', 'Nombre', 'Ubicación', 'Estado', 'Tipo', 'Potencia (kW)'].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(chargers as Charger[]).map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{c.id.slice(0, 8)}…</td>
                <td className="px-6 py-4 text-sm text-gray-900">{c.name ?? '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.location ?? '—'}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    c.status === 'available' ? 'bg-green-100 text-green-800' :
                    c.status === 'occupied' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>{c.status ?? '—'}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.type ?? '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.power_kw ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {chargers?.length === 0 && (
          <p className="text-center py-10 text-gray-400">No hay cargadores registrados.</p>
        )}
      </div>
    </div>
  )
}
