'use client'
import { useEffect, useState } from 'react'

interface AuditLog {
  id: string
  action: string
  target_user_id: string | null
  details: Record<string, any> | null
  performed_by: string | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  create_user: '👤 Crear usuario',
  delete_user: '🗑️ Eliminar usuario',
  reset_password: '🔑 Reset contraseña',
  balance_topup: '💰 Recarga saldo',
  charge_deduct: '⚡ Descuento carga',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/audit')
      .then(r => r.json())
      .then(d => { setLogs(d.logs || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registro de auditoría</h1>
        <span className="text-sm text-gray-500">{logs.length} eventos</span>
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Cargando...</div>}

      {!loading && logs.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No hay eventos registrados aún
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Acción</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Detalles</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Por</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {ACTION_LABELS[log.action] || log.action}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs">
                  {log.details ? (
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {JSON.stringify(log.details).slice(0, 80)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{log.performed_by || '—'}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
