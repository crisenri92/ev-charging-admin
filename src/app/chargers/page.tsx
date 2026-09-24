'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from '@/components/Toast'

interface Charger {
  id: string
  name: string | null
  status: string | null
  latitude: number | null
  longitude: number | null
  price_per_kwh: number | null
  firmware: string | null
  serial_number: string | null
  last_heartbeat: string | null
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; dot: string; cls: string }> = {
    Available: { label: 'Disponible', dot: 'bg-emerald-400', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    Charging: { label: 'Cargando', dot: 'bg-blue-400', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    Faulted: { label: 'Falla', dot: 'bg-red-400', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
    Offline: { label: 'Offline', dot: 'bg-gray-400', cls: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
    Unavailable: { label: 'No disponible', dot: 'bg-orange-400', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  }
  const s = status ?? 'Offline'
  const m = map[s] ?? map['Offline']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${s === 'Charging' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  )
}

function QrModal({ charger, onClose }: { charger: Charger; onClose: () => void }) {
  const qrData = `https://recargat.app/mobile?charger=${encodeURIComponent(charger.id)}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`
  const label = charger.name || charger.id

  const download = async () => {
    const resp = await fetch(qrUrl)
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${charger.id}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">QR Cargador</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <p className="text-sm text-gray-400 mb-4 text-center">{label}</p>
        <div className="flex justify-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt={`QR ${label}`} className="rounded-lg border border-gray-700 w-56 h-56" />
        </div>
        <p className="text-xs text-gray-500 text-center mb-5 break-all">{qrData}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm border border-gray-700">Cerrar</button>
          <button onClick={download} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
            Descargar PNG
          </button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ charger, onClose, onSave }: { charger: Charger; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: charger.name ?? '', price_per_kwh: charger.price_per_kwh ?? '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/chargers/${charger.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name || null,
          price_per_kwh: form.price_per_kwh ? Number(form.price_per_kwh) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error || 'Error al actualizar el cargador', 'error')
        return
      }
      toast('Cargador actualizado')
      onSave()
      onClose()
    } catch {
      toast('Error de red. Intenta de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Editar Cargador</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Nombre</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={charger.id}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Precio por kWh ($)</label>
            <input type="number" step="0.01" value={form.price_per_kwh} onChange={e => setForm(f => ({ ...f, price_per_kwh: e.target.value }))}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-500" />
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-gray-500"><span className="text-gray-400">ID:</span> {charger.id}</p>
            {charger.serial_number && <p className="text-xs text-gray-500"><span className="text-gray-400">Serial:</span> {charger.serial_number}</p>}
            {charger.firmware && <p className="text-xs text-gray-500"><span className="text-gray-400">Firmware:</span> {charger.firmware}</p>}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors border border-gray-700">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LocationModal({ charger, onClose, onSave }: { charger: Charger; onClose: () => void; onSave: () => void }) {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/chargers/${charger.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: url }) })
    if (res.ok) { onSave(); onClose() }
    else { setError('No se pudo parsear la ubicación. Pega el link de Google Maps.'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Establecer Ubicación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        {charger.latitude && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400">
            Ubicación actual: {charger.latitude.toFixed(6)}, {charger.longitude?.toFixed(6)}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Link de Google Maps</label>
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-500" />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors border border-gray-700">Cancelar</button>
          <button onClick={save} disabled={saving || !url} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? 'Guardando...' : 'Guardar ubicación'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChargersPage() {
  const [chargers, setChargers] = useState<Charger[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<Charger | null>(null)
  const [locationTarget, setLocationTarget] = useState<Charger | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [qrTarget, setQrTarget] = useState<Charger | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newId, setNewId] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchChargers = useCallback(async () => {
    const res = await fetch('/api/admin/chargers')
    const data = await res.json()
    setChargers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchChargers() }, [fetchChargers])

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/chargers/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error || 'Error al eliminar el cargador', 'error')
        return
      }
      toast('Cargador eliminado')
      setDeleteTarget(null)
      fetchChargers()
    } catch {
      toast('Error de red. Intenta de nuevo.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleAdd = async () => {
    if (!newId.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/admin/chargers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newId.trim(), status: 'Offline' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error || 'Error al agregar el cargador', 'error')
        return
      }
      toast('Cargador agregado')
      setNewId('')
      setShowAdd(false)
      fetchChargers()
    } catch {
      toast('Error de red. Intenta de nuevo.', 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Cargadores</h1>
          <p className="text-sm text-gray-400 mt-0.5">{chargers.length} cargador{chargers.length !== 1 ? 'es' : ''} registrado{chargers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          + Agregar cargador
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : chargers.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-20"><path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.268a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" /></svg>
            <p className="font-medium text-gray-400 mb-1">No hay cargadores</p>
            <p className="text-sm">Agrega tu primer cargador para comenzar</p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['ID / Nombre', 'Estado', 'Ubicación', 'Precio/kWh', 'Firmware', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {chargers.map(c => (
                <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-white text-sm">{c.name || c.id}</p>
                    {c.name && <p className="text-xs text-gray-500 mt-0.5">{c.id}</p>}
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3.5 text-sm text-gray-400">
                    {c.latitude ? `${c.latitude.toFixed(4)}, ${c.longitude?.toFixed(4)}` : <span className="text-gray-600">Sin coordenadas</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-300">
                    {c.price_per_kwh ? `$${c.price_per_kwh.toFixed(2)}` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">{c.firmware ?? <span className="text-gray-600">—</span>}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => setEditTarget(c)} className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md border border-gray-700 transition-colors">Editar</button>
                      <button onClick={() => setLocationTarget(c)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded-md border border-gray-700 transition-colors"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-3 h-3'><path fillRule='evenodd' d='M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.083 3.964-5.129 3.964-8.827a8.25 8.25 0 00-16.5 0c0 3.698 2.02 6.744 3.964 8.827a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.144.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z' clipRule='evenodd' /></svg>Ubicación</button>
                      <button onClick={() => setQrTarget(c)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-violet-400 rounded-md border border-gray-700 transition-colors"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-3 h-3'><path fillRule='evenodd' d='M3 4.875C3 3.839 3.84 3 4.875 3h4.5C10.41 3 11.25 3.84 11.25 4.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5A1.875 1.875 0 013 9.375v-4.5zM4.875 4.5a.375.375 0 00-.375.375v4.5c0 .207.168.375.375.375h4.5a.375.375 0 00.375-.375v-4.5a.375.375 0 00-.375-.375h-4.5zm7.875.375C12.75 3.839 13.59 3 14.625 3h4.5C20.16 3 21 3.84 21 4.875v4.5c0 1.036-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 01-1.875-1.875v-4.5zm1.875-.375a.375.375 0 00-.375.375v4.5c0 .207.168.375.375.375h4.5a.375.375 0 00.375-.375v-4.5a.375.375 0 00-.375-.375h-4.5zM6 6.75A.75.75 0 016.75 6h.75a.75.75 0 010 1.5h-.75A.75.75 0 016 6.75zm9.75 0A.75.75 0 0116.5 6h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zM3 14.625C3 13.589 3.84 12.75 4.875 12.75h4.5c1.036 0 1.875.84 1.875 1.875v4.5A1.875 1.875 0 019.375 21h-4.5A1.875 1.875 0 013 19.125v-4.5zm1.875-.375a.375.375 0 00-.375.375v4.5c0 .207.168.375.375.375h4.5a.375.375 0 00.375-.375v-4.5a.375.375 0 00-.375-.375h-4.5zm6.75.375a.75.75 0 01.75-.75H13.5a.75.75 0 010 1.5h-1.125a.75.75 0 01-.75-.75zm4.875 0a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zM6 16.5a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75A.75.75 0 016 16.5zm10.5 0a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zm-3 3a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75z' clipRule='evenodd' /></svg>QR</button>
                      <button onClick={() => setDeleteTarget(c.id)} className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-red-900/40 text-red-400 rounded-md border border-gray-700 hover:border-red-500/30 transition-colors">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-4">Agregar Cargador</h2>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">ID del Cargador (OCPP)</label>
            <input value={newId} onChange={e => setNewId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="CHARGER_001"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm border border-gray-700">Cancelar</button>
              <button onClick={handleAdd} disabled={adding || !newId.trim()} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {adding ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-2">¿Eliminar cargador?</h2>
            <p className="text-sm text-gray-400 mb-6">Esta acción no se puede deshacer. El cargador <span className="text-white font-mono">{deleteTarget}</span> será eliminado permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg text-sm border border-gray-700">Cancelar</button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={deleting} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrTarget && <QrModal charger={qrTarget} onClose={() => setQrTarget(null)} />}
      {editTarget && <EditModal charger={editTarget} onClose={() => setEditTarget(null)} onSave={fetchChargers} />}
      {locationTarget && <LocationModal charger={locationTarget} onClose={() => setLocationTarget(null)} onSave={fetchChargers} />}
    </div>
  )
}
