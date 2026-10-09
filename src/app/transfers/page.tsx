'use client'

import { useState, useEffect, useCallback } from 'react'

interface TransferRequest {
  id: string
  amount: number
  currency: string
  reference_number: string | null
  receipt_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
  user: {
    id: string
    email: string
  } | null
}

interface ApiResponse {
  transfer_requests: TransferRequest[]
  total: number
  page: number
  pages: number
}

type TabStatus = 'pending' | 'approved' | 'rejected'

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState<TabStatus>('pending')
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pendingCount, setPendingCount] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Modal state
  const [approveModal, setApproveModal] = useState<TransferRequest | null>(null)
  const [rejectModal, setRejectModal] = useState<TransferRequest | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchRequests = useCallback(async (status: TabStatus, pageNum: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/transfer-requests?status=${status}&page=${pageNum}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data: ApiResponse = await res.json()
      setRequests(data.transfer_requests || [])
      setTotalPages(data.pages || 1)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/transfer-requests?status=pending&page=1')
      if (res.ok) {
        const data: ApiResponse = await res.json()
        setPendingCount(data.total || 0)
      }
    } catch (e) { /* silent */ }
  }, [])

  useEffect(() => {
    fetchRequests(activeTab, page)
    fetchPendingCount()
  }, [activeTab, page, fetchRequests, fetchPendingCount])

  // Auto-refresh pendientes cada 30s
  useEffect(() => {
    if (activeTab !== 'pending') return
    const interval = setInterval(() => {
      fetchRequests('pending', page)
      fetchPendingCount()
    }, 30000)
    return () => clearInterval(interval)
  }, [activeTab, page, fetchRequests, fetchPendingCount])

  const handleApprove = async () => {
    if (!approveModal) return
    setActionLoading(approveModal.id)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/transfer-requests/${approveModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al aprobar')
      }
      setApproveModal(null)
      await fetchRequests(activeTab, page)
      await fetchPendingCount()
    } catch (e: any) {
      setActionError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!rejectModal) return
    if (!rejectNotes.trim()) {
      setActionError('El motivo de rechazo es requerido')
      return
    }
    setActionLoading(rejectModal.id)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/transfer-requests/${rejectModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', admin_notes: rejectNotes.trim() })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al rechazar')
      }
      setRejectModal(null)
      setRejectNotes('')
      await fetchRequests(activeTab, page)
      await fetchPendingCount()
    } catch (e: any) {
      setActionError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transferencias Bancarias</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de solicitudes de recarga por transferencia</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {(['pending', 'approved', 'rejected'] as TabStatus[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1) }}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'pending' ? 'Pendientes' : tab === 'approved' ? 'Aprobadas' : 'Rechazadas'}
              {tab === 'pending' && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No hay solicitudes {activeTab === 'pending' ? 'pendientes' : activeTab === 'approved' ? 'aprobadas' : 'rechazadas'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Usuario', 'Monto', 'Referencia', 'Comprobante', 'Fecha', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{req.user?.email || '—'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ${req.amount.toFixed(2)} {req.currency}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                      {req.reference_number || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {req.receipt_url ? (
                        <a href={req.receipt_url} target="_blank" rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline">
                          Ver comprobante
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(req.created_at)}</td>
                    <td className="px-6 py-4">{statusBadge(req.status)}</td>
                    <td className="px-6 py-4 text-sm">
                      {req.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setApproveModal(req); setActionError(null) }}
                            disabled={!!actionLoading}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => { setRejectModal(req); setRejectNotes(''); setActionError(null) }}
                            disabled={!!actionLoading}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {req.reviewed_at ? formatDate(req.reviewed_at) : '—'}
                          {req.admin_notes && <span className="block text-gray-500 mt-0.5 max-w-[200px] truncate" title={req.admin_notes}>{req.admin_notes}</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50">Anterior</button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50">Siguiente</button>
        </div>
      )}

      {/* Modal Aprobar */}
      {approveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirmar aprobación</h2>
            <p className="text-gray-600 mb-4">
              ¿Aprobar transferencia de <strong>${approveModal.amount.toFixed(2)} {approveModal.currency}</strong> para <strong>{approveModal.user?.email}</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-6">Esto acreditará el saldo en la billetera del usuario de forma inmediata.</p>
            {actionError && <p className="text-red-600 text-sm mb-4">{actionError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setApproveModal(null)}
                className="px-4 py-2 text-sm text-gray-700 border rounded hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleApprove} disabled={!!actionLoading}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                {actionLoading ? 'Procesando...' : 'Confirmar aprobación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rechazar */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Rechazar transferencia</h2>
            <p className="text-gray-600 mb-4">
              Rechazando <strong>${rejectModal.amount.toFixed(2)} {rejectModal.currency}</strong> de <strong>{rejectModal.user?.email}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo del rechazo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Ej: Referencia no encontrada, monto no corresponde..."
                rows={3}
                className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            {actionError && <p className="text-red-600 text-sm mb-4">{actionError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-gray-700 border rounded hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleReject} disabled={!!actionLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                {actionLoading ? 'Procesando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
