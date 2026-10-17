'use client'

import { useEffect, useState } from 'react'

interface TransferRequest {
  id: string
  user_id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  receipt_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  ai_confidence: number | null
  ai_reason: string | null
  ai_bank_detected: string | null
  profiles?: { email: string } | null
}

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<TransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  async function loadTransfers() {
    setLoading(true)
    setError(null)
    try {
      const url = filter === 'all' ? '/api/admin/transfer-requests' : `/api/admin/transfer-requests?status=${filter}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Error cargando solicitudes')
      const data = await res.json()
      setTransfers(data.transfer_requests || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTransfers() }, [filter])

  async function handleAction(id: string, action: 'approved' | 'rejected') {
    setActionLoading(id + action)
    try {
      const res = await fetch('/api/admin/transfer-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: action })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al actualizar')
      await loadTransfers()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const confidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null
    const pct = Math.round(confidence * 100)
    const color = confidence >= 0.85 ? 'text-green-600' : confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600'
    return <span className={`text-xs font-medium ${color}`}>{pct}% confianza IA</span>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Transferencia</h1>
          <p className="text-sm text-gray-500 mt-1">Revisa y gestiona comprobantes de recarga</p>
        </div>
        <button onClick={loadTransfers} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
          Actualizar
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${filter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
          >
            {s === 'all' ? 'Todas' : s === 'pending' ? 'Pendientes' : s === 'approved' ? 'Aprobadas' : 'Rechazadas'}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando solicitudes...</div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No hay solicitudes</div>
      ) : (
        <div className="space-y-4">
          {transfers.map(tr => (
            <div key={tr.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {statusBadge(tr.status)}
                    <span className="text-lg font-bold text-gray-900">
                      {tr.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                    </span>
                    {confidenceBadge(tr.ai_confidence)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">Usuario:</span> {tr.profiles?.email || tr.user_id}</p>
                    <p><span className="font-medium">Fecha:</span> {new Date(tr.created_at).toLocaleString('es-MX')}</p>
                    {tr.ai_bank_detected && <p><span className="font-medium">Banco:</span> {tr.ai_bank_detected}</p>}
                    {tr.ai_reason && (
                      <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded">
                        <span className="font-medium">IA:</span> {tr.ai_reason}
                      </p>
                    )}
                    {tr.notes && <p><span className="font-medium">Notas:</span> {tr.notes}</p>}
                  </div>
                </div>
                {tr.receipt_url && (
                  <div className="flex-shrink-0">
                    <button onClick={() => setPreviewImage(tr.receipt_url)} className="block">
                      <img src={tr.receipt_url} alt="Comprobante" className="w-20 h-20 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80" />
                      <p className="text-xs text-blue-600 text-center mt-1">Ver</p>
                    </button>
                  </div>
                )}
              </div>
              {tr.status === 'pending' && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
                  <button
                    onClick={() => handleAction(tr.id, 'approved')}
                    disabled={actionLoading === tr.id + 'approved'}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {actionLoading === tr.id + 'approved' ? 'Aprobando...' : 'Aprobar'}
                  </button>
                  <button
                    onClick={() => handleAction(tr.id, 'rejected')}
                    disabled={actionLoading === tr.id + 'rejected'}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {actionLoading === tr.id + 'rejected' ? 'Rechazando...' : 'Rechazar'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl max-h-screen p-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center text-lg">
              x
            </button>
            <img src={previewImage} alt="Comprobante" className="max-w-full max-h-screen object-contain rounded" />
          </div>
        </div>
      )}
    </div>
  )
}
