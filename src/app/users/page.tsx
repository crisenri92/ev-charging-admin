'use client'
import { useEffect, useState, useCallback } from 'react'

interface User {
  id: string
  email: string
  balance: number
  currency: string
  role: string
  created_at: string
  last_sign_in_at: string | null
}
type Mode = null | 'balance' | 'role' | 'delete' | 'reset'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<User | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // balance form
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceOp, setBalanceOp] = useState<'add' | 'subtract' | 'set'>('add')
  const [balanceReason, setBalanceReason] = useState('')
  // role form
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error cargando usuarios')
      setUsers(data.users ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const openModal = (user: User, m: Mode) => {
    setSelected(user)
    setMode(m)
    setMsg('')
    setBalanceAmount('')
    setBalanceReason('')
    setBalanceOp('add')
    setNewRole(user.role === 'admin' ? 'admin' : 'user')
  }

  const closeModal = () => { setSelected(null); setMode(null); setMsg('') }

  const doBalance = async () => {
    if (!selected || !balanceAmount) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, amount: Number(balanceAmount), operation: balanceOp, reason: balanceReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg('Saldo actualizado correctamente')
      await loadUsers()
      setTimeout(closeModal, 1200)
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const doRole = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg('Rol actualizado correctamente')
      await loadUsers()
      setTimeout(closeModal, 1200)
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg('Usuario eliminado')
      await loadUsers()
      setTimeout(closeModal, 1200)
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const doReset = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selected.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg('Email de reset enviado a ' + selected.email)
      setTimeout(closeModal, 2000)
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Usuarios</h2>
          <p className="text-gray-400 mt-1">{users.length} usuarios registrados</p>
        </div>
        <button onClick={loadUsers} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
          Actualizar
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-400 text-center py-12">Cargando usuarios...</div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Saldo</th>
                <th className="text-left px-4 py-3">Rol</th>
                <th className="text-left px-4 py-3">Registro</th>
                <th className="text-left px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center text-xs font-bold">
                        {(u.email?.[0] ?? '?').toUpperCase()}
                      </div>
                      <span className="text-white text-xs">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-green-400 font-medium">
                    ${Number(u.balance).toFixed(2)} {u.currency}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('es-MX') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openModal(u, 'balance')} className="px-2 py-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded text-xs">Saldo</button>
                      <button onClick={() => openModal(u, 'role')} className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded text-xs">Rol</button>
                      <button onClick={() => openModal(u, 'reset')} className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-xs">Reset</button>
                      <button onClick={() => openModal(u, 'delete')} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {mode && selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">
                {mode === 'balance' && 'Modificar Saldo'}
                {mode === 'role' && 'Cambiar Rol'}
                {mode === 'reset' && 'Resetear Contraseña'}
                {mode === 'delete' && 'Eliminar Usuario'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <p className="text-gray-400 text-sm mb-4">{selected.email}</p>

            {mode === 'balance' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Operación</label>
                  <select value={balanceOp} onChange={e => setBalanceOp(e.target.value as any)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm">
                    <option value="add">Agregar</option>
                    <option value="subtract">Restar</option>
                    <option value="set">Establecer</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Monto (USD)</label>
                  <input type="number" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} min="0" step="0.01"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Motivo (opcional)</label>
                  <input type="text" value={balanceReason} onChange={e => setBalanceReason(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" placeholder="Ajuste manual..." />
                </div>
                <p className="text-xs text-gray-500">Saldo actual: ${Number(selected.balance).toFixed(2)}</p>
              </div>
            )}

            {mode === 'role' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Nuevo rol</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value as any)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm">
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500">Rol actual: {selected.role}</p>
              </div>
            )}

            {mode === 'reset' && (
              <p className="text-gray-300 text-sm">Se enviará un email de restablecimiento de contraseña a <strong>{selected.email}</strong>.</p>
            )}

            {mode === 'delete' && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">Esta acción es irreversible. El usuario y todos sus datos serán eliminados permanentemente.</p>
              </div>
            )}

            {msg && (
              <div className={`mt-3 p-2 rounded text-sm ${msg.startsWith('Error') ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}>
                {msg}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={closeModal} disabled={busy}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                Cancelar
              </button>
              <button
                onClick={mode === 'balance' ? doBalance : mode === 'role' ? doRole : mode === 'delete' ? doDelete : doReset}
                disabled={busy}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white ${
                  mode === 'delete' ? 'bg-red-600 hover:bg-red-700' :
                  mode === 'balance' ? 'bg-green-600 hover:bg-green-700' :
                  mode === 'role' ? 'bg-purple-600 hover:bg-purple-700' :
                  'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}>
                {busy ? 'Procesando...' : mode === 'balance' ? 'Aplicar' : mode === 'role' ? 'Cambiar' : mode === 'delete' ? 'Eliminar' : 'Enviar email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
