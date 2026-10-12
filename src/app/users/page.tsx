'use client'
import { useEffect, useState, useCallback } from 'react'

interface User {
  id: string; email: string; balance: number; role: string
  created_at: string; last_sign_in_at: string | null
}
type Mode = null | 'balance' | 'role' | 'delete' | 'reset'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<User | null>(null)
  const [modal, setModal] = useState<Mode>(null)
  const [amount, setAmount] = useState('')
  const [op, setOp] = useState<'add'|'subtract'|'set'>('add')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{type:'ok'|'err'; text:string}|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/users')
    if (r.ok) { const d = await r.json(); setUsers(d.users ?? []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const flash = (type: 'ok'|'err', text: string) => {
    setMsg({ type, text }); setTimeout(() => setMsg(null), 4000)
  }
  const open = (u: User, m: Mode) => { setSelected(u); setModal(m); setAmount(''); setOp('add'); setReason('') }
  const close = () => { setModal(null); setSelected(null) }

  const doBalance = async () => {
    if (!selected) return; setSaving(true)
    const r = await fetch('/api/admin/users/balance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selected.id, amount: parseFloat(amount), operation: op, reason }),
    })
    const d = await r.json(); setSaving(false)
    r.ok ? (flash('ok', `Saldo: $${d.newBalance?.toFixed(2)}`), close(), load()) : flash('err', d.error ?? 'Error')
  }

  const doRole = async () => {
    if (!selected) return; setSaving(true)
    const newRole = selected.role === 'admin' ? 'user' : 'admin'
    const r = await fetch('/api/admin/users/role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selected.id, role: newRole }),
    })
    const d = await r.json(); setSaving(false)
    r.ok ? (flash('ok', `Rol: ${newRole}`), close(), load()) : flash('err', d.error ?? 'Error')
  }

  const doDelete = async () => {
    if (!selected) return; setSaving(true)
    const r = await fetch('/api/admin/users/delete', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selected.id }),
    })
    const d = await r.json(); setSaving(false)
    r.ok ? (flash('ok', 'Eliminado'), close(), load()) : flash('err', d.error ?? 'Error')
  }

  const doReset = async () => {
    if (!selected) return; setSaving(true)
    const r = await fetch('/api/admin/users/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: selected.email }),
    })
    const d = await r.json(); setSaving(false)
    r.ok ? (flash('ok', 'Email enviado'), close()) : flash('err', d.error ?? 'Error')
  }

  const getStatus = (u: User) => {
    const days = (Date.now() - new Date(u.created_at).getTime()) / 86400000
    return days < 7 ? 'new' : u.last_sign_in_at ? 'active' : 'inactive'
  }
  const sc: Record<string,string> = {
    active:'bg-green-500/10 text-green-400', new:'bg-blue-500/10 text-blue-400', inactive:'bg-gray-500/10 text-gray-400'
  }

  return (
    <div>
      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${msg.type==='ok'?'bg-green-600':'bg-red-600'} text-white`}>
          {msg.text}
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Usuarios</h2>
          <p className="text-gray-400 mt-1">{users.length} usuarios registrados</p>
        </div>
        <button onClick={load} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs border border-gray-700">↻ Actualizar</button>
      </div>
      {loading ? (
        <div className="text-gray-500 text-center py-12">Cargando...</div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-left px-6 py-3">Saldo</th>
                <th className="text-left px-6 py-3">Rol</th>
                <th className="text-left px-6 py-3">Estado</th>
                <th className="text-left px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">
                        {(u.email[0]??'?').toUpperCase()}
                      </div>
                      <span className="text-white text-xs">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300 font-mono">${(u.balance??0).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.role==='admin'?'bg-purple-500/10 text-purple-400':'bg-gray-500/10 text-gray-400'}`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${sc[getStatus(u)]}`}>{getStatus(u)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => open(u,'balance')} className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-600/30">Saldo</button>
                      <button onClick={() => open(u,'role')} className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded hover:bg-purple-600/30">Rol</button>
                      <button onClick={() => open(u,'reset')} className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-500/20 rounded hover:bg-yellow-600/30">Reset</button>
                      <button onClick={() => open(u,'delete')} className="px-2 py-1 text-xs bg-red-600/20 text-red-400 border border-red-500/20 rounded hover:bg-red-600/30">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length===0 && <div className="text-center text-gray-500 py-12">No hay usuarios</div>}
        </div>
      )}

      {modal && selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={close}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            {modal==='balance' && <>
              <h3 className="text-white font-bold mb-1">Ajustar Saldo</h3>
              <p className="text-xs text-gray-400 mb-3">{selected.email} · actual: <span className="text-white font-mono">${(selected.balance??0).toFixed(2)}</span></p>
              <div className="flex gap-2 mb-3">
                {(['add','subtract','set'] as const).map(o => (
                  <button key={o} onClick={()=>setOp(o)} className={`flex-1 py-1.5 text-xs rounded border ${op===o?'bg-blue-600 border-blue-500 text-white':'border-gray-600 text-gray-400'}`}>
                    {o==='add'?'+Agregar':o==='subtract'?'-Descontar':'=Fijar'}
                  </button>
                ))}
              </div>
              <input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}
                placeholder="Monto" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2"/>
              <input type="text" value={reason} onChange={e=>setReason(e.target.value)}
                placeholder="Razón (opcional)" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-4"/>
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg">Cancelar</button>
                <button onClick={doBalance} disabled={saving||!amount} className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
                  {saving?'...':'Aplicar'}
                </button>
              </div>
            </>}
            {modal==='role' && <>
              <h3 className="text-white font-bold mb-1">Cambiar Rol</h3>
              <p className="text-xs text-gray-400 mb-4">{selected.email}</p>
              <p className="text-gray-300 text-sm mb-4">Actual: <b>{selected.role}</b> → Nuevo: <b>{selected.role==='admin'?'user':'admin'}</b></p>
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg">Cancelar</button>
                <button onClick={doRole} disabled={saving} className="flex-1 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg">
                  {saving?'...':'Cambiar'}
                </button>
              </div>
            </>}
            {modal==='reset' && <>
              <h3 className="text-white font-bold mb-1">Reset Contraseña</h3>
              <p className="text-xs text-gray-400 mb-4">{selected.email}</p>
              <p className="text-gray-300 text-sm mb-4">Se enviará email de recuperación a <b>{selected.email}</b>.</p>
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg">Cancelar</button>
                <button onClick={doReset} disabled={saving} className="flex-1 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg">
                  {saving?'...':'Enviar'}
                </button>
              </div>
            </>}
            {modal==='delete' && <>
              <h3 className="text-red-400 font-bold mb-1">Eliminar Usuario</h3>
              <p className="text-xs text-gray-400 mb-4">{selected.email}</p>
              <p className="text-gray-300 text-sm mb-4">Esta acción es <span className="text-red-400 font-bold">irreversible</span>.</p>
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg">Cancelar</button>
                <button onClick={doDelete} disabled={saving} className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg">
                  {saving?'...':'Eliminar'}
                </button>
              </div>
            </>}
          </div>
        </div>
      )}
    </div>
  )
}
