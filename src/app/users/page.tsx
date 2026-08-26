'use client'
import { useState, useEffect, useCallback } from 'react'

interface User {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  role: string
  balance: number
  currency: string
}

type ToastType = { message: string; type: 'success' | 'error' }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastType | null>(null)
  const [saving, setSaving] = useState(false)

  // Balance modal
  const [balanceUser, setBalanceUser] = useState<User | null>(null)
  const [amount, setAmount] = useState('')
  const [operation, setOperation] = useState<'add' | 'subtract' | 'set'>('add')

  // Create user modal
  const [createOpen, setCreateOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'client' | 'admin'>('client')

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSaveBalance = async () => {
    if (!balanceUser || !amount) return
    setSaving(true)
    const res = await fetch('/api/admin/users/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: balanceUser.id, amount: parseFloat(amount), operation }),
    })
    const data = await res.json()
    if (data.error) { showToast(data.error, 'error') } else {
      showToast(`Saldo actualizado: $${data.newBalance?.toFixed(2)}`, 'success')
      setBalanceUser(null)
      fetchUsers()
    }
    setSaving(false)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, role: newRole }),
    })
    const data = await res.json()
    if (data.error) { showToast(data.error, 'error') } else {
      showToast(`Usuario ${newEmail} creado`, 'success')
      setCreateOpen(false)
      setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('client')
      fetchUsers()
    }
    setSaving(false)
  }

  const handleResetPassword = async (email: string) => {
    const res = await fetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (data.error) showToast(data.error, 'error')
    else showToast(`Link de recuperación enviado a ${email}`, 'success')
  }

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`¿Eliminar usuario ${user.email}? Esta acción no se puede deshacer.`)) return
    const res = await fetch('/api/admin/users/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    const data = await res.json()
    if (data.error) showToast(data.error, 'error')
    else { showToast('Usuario eliminado', 'success'); fetchUsers() }
  }

  const clients = users.filter(u => u.role !== 'admin')
  const admins = users.filter(u => u.role === 'admin')

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white text-sm shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-gray-400 text-sm mt-1">{clients.length} clientes · {admins.length} admins</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors text-sm">
          + Crear usuario
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Cargando usuarios...</div>
      ) : (
        <>
          {/* Clients table */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Clientes</h2>
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Saldo</th>
                    <th className="px-4 py-3 text-left">Registro</th>
                    <th className="px-4 py-3 text-left">Último acceso</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {clients.map(user => (
                    <tr key={user.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-white">{user.email}</td>
                      <td className="px-4 py-3 text-green-400 font-mono">${user.balance.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(user.created_at).toLocaleDateString('es-EC')}</td>
                      <td className="px-4 py-3 text-gray-400">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('es-EC') : '—'}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => { setBalanceUser(user); setAmount(''); setOperation('add') }}
                          className="text-xs px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded">
                          Saldo
                        </button>
                        <button onClick={() => handleResetPassword(user.email!)}
                          className="text-xs px-2 py-1 bg-yellow-700 hover:bg-yellow-600 text-white rounded">
                          Reset pwd
                        </button>
                        <button onClick={() => handleDeleteUser(user)}
                          className="text-xs px-2 py-1 bg-red-800 hover:bg-red-700 text-white rounded">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No hay clientes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admins table */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Administradores</h2>
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Registro</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {admins.map(user => (
                    <tr key={user.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-white">{user.email}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(user.created_at).toLocaleDateString('es-EC')}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleResetPassword(user.email!)}
                          className="text-xs px-2 py-1 bg-yellow-700 hover:bg-yellow-600 text-white rounded">
                          Reset pwd
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Balance modal */}
      {balanceUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-bold text-lg mb-1">Gestionar saldo</h3>
            <p className="text-gray-400 text-sm mb-4">{balanceUser.email} · Saldo actual: <span className="text-green-400">${balanceUser.balance.toFixed(2)}</span></p>
            <div className="space-y-3">
              <select value={operation} onChange={e => setOperation(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                <option value="add">Agregar</option>
                <option value="subtract">Descontar</option>
                <option value="set">Establecer</option>
              </select>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                placeholder="Monto en USD" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setBalanceUser(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSaveBalance} disabled={saving} className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-bold text-lg mb-4">Crear nuevo usuario</h3>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
                placeholder="Nombre completo (opcional)" />
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
                placeholder="Email *" />
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
                placeholder="Contraseña (mín. 8 caracteres) *" />
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                <option value="client">Cliente (acceso app móvil)</option>
                <option value="admin">Administrador (acceso dashboard)</option>
              </select>
              <p className="text-xs text-gray-500">El usuario podrá iniciar sesión inmediatamente sin verificar email.</p>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                  {saving ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
