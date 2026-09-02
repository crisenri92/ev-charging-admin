'use client'
import { useEffect, useState } from 'react'

interface Voucher {
  id: string
  code: string
  description: string | null
  amount: number
  max_uses: number
  uses_count: number
  active: boolean
  expires_at: string | null
  created_at: string
}

const EMPTY = { code: '', description: '', amount: 5, max_uses: 1, active: true, expires_at: '' }

function VoucherModal({ v, onSave, onClose }: { v: Partial<Voucher>; onSave: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ ...EMPTY, ...v, expires_at: v.expires_at?.slice(0, 10) || '' })
  const set = (k: string, val: any) => setForm(f => ({ ...f, [k]: val }))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-white font-bold text-lg mb-5">{v.id ? 'Editar voucher' : 'Nuevo voucher'}</h2>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Código</label>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
              placeholder="BIENVENIDA"
              className="w-full bg-gray-800 text-white font-mono rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-purple-500 outline-none uppercase tracking-widest" />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Descripción (opcional)</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Crédito de bienvenida"
              className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-purple-500 outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Monto ($)</label>
              <input type="number" step="0.01" min="0.01" value={form.amount}
                onChange={e => set('amount', parseFloat(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-purple-500 outline-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Usos máx (0=∞)</label>
              <input type="number" min="0" value={form.max_uses}
                onChange={e => set('max_uses', parseInt(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-purple-500 outline-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Expira</label>
              <input type="date" value={form.expires_at}
                onChange={e => set('expires_at', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-purple-500 outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => set('active', !form.active)}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.active ? 'bg-purple-600' : 'bg-gray-700'}`}>
              <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: form.active ? '22px' : '2px' }} />
            </div>
            <span className="text-gray-300 text-sm">{form.active ? 'Activo' : 'Inactivo'}</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm">Cancelar</button>
          <button onClick={() => onSave({ ...form, expires_at: form.expires_at || null })}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm">Guardar</button>
        </div>
      </div>
    </div>
  )
}

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Partial<Voucher> | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => { fetchVouchers() }, [])

  async function fetchVouchers() {
    const r = await fetch('/api/vouchers')
    setVouchers(await r.json())
    setLoading(false)
  }

  async function saveVoucher(form: any) {
    const method = modal?.id ? 'PATCH' : 'POST'
    const body = modal?.id ? { id: modal.id, ...form } : form
    const r = await fetch('/api/vouchers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) { const d = await r.json(); alert(d.error); return }
    setModal(null)
    fetchVouchers()
  }

  async function deleteVoucher(id: string) {
    await fetch('/api/vouchers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setDeleteTarget(null)
    fetchVouchers()
  }

  async function toggleActive(v: Voucher) {
    await fetch('/api/vouchers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, active: !v.active }) })
    fetchVouchers()
  }

  return (
    <div className="max-w-3xl mx-auto">
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Vouchers</h1>
              <p className="text-gray-500 text-sm mt-1">Códigos de descuento y créditos</p>
            </div>
            <button onClick={() => setModal({})}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors">
              + Nuevo voucher
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-400 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {vouchers.map(v => (
                <div key={v.id} className={`bg-gray-900 rounded-2xl p-4 border ${v.active ? 'border-gray-800' : 'border-gray-800/40 opacity-50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="text-2xl">🎁</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-purple-400 font-mono font-bold text-sm">{v.code}</code>
                          {v.expires_at && new Date(v.expires_at) < new Date() && (
                            <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-lg">Expirado</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                          {v.description && <span>{v.description}</span>}
                          <span>{v.uses_count}{v.max_uses > 0 ? `/${v.max_uses}` : ''} usos</span>
                          {v.expires_at && <span>Expira {new Date(v.expires_at).toLocaleDateString('es-EC')}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-green-400 font-bold text-lg">${Number(v.amount).toFixed(2)}</span>
                      <button onClick={() => toggleActive(v)}
                        className={`text-xs px-2.5 py-1 rounded-lg ${v.active ? 'bg-yellow-900/40 text-yellow-400' : 'bg-gray-800 text-gray-400'}`}>
                        {v.active ? 'Pausar' : 'Activar'}
                      </button>
                      <button onClick={() => setModal(v)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400">Editar</button>
                      <button onClick={() => setDeleteTarget(v.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-900/30 text-red-400">Eliminar</button>
                    </div>
                  </div>
                </div>
              ))}
              {vouchers.length === 0 && (
                <div className="bg-gray-900 rounded-2xl p-10 text-center border border-gray-800">
                  <p className="text-3xl mb-3">🎁</p>
                  <p className="text-gray-500">No hay vouchers creados aún</p>
                </div>
              )}
            </div>
          )}
        </div>
      {modal !== null && <VoucherModal v={modal} onSave={saveVoucher} onClose={() => setModal(null)} />}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-2">¿Eliminar voucher?</h2>
            <p className="text-sm text-gray-400 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm border border-gray-700">Cancelar</button>
              <button onClick={() => deleteVoucher(deleteTarget)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
