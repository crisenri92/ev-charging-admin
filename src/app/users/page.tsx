'use client'
import { useState, useEffect, useCallback } from 'react'
import { Users, DollarSign, Shield, X, Check } from 'lucide-react'

interface User {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  role: string
  balance: number
  currency: string
  user_metadata: any
}

interface Toast {
  message: string
  type: 'success' | 'error'
}

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'admins'>(' clients')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [reason,setReason]=useState("")
  const [amount, setAmount] = useState('' )
  const [operation, setOperation] = useState<'add' | 'subtract' | 'set'>(' add')
  const [toast, setToast] = useState<Toast | null>(null)
  const [saving, setSaving] = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch {
      showToast('Error al cargar usuarios', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const openModal = (user: User) => {
    setSelectedUser(user)
    setAmount('' )
    setOperation('add')
    setModalOpen(true)
    setReason("")
  }

  const handleSaveBalance = async () => {
    if (!selectedUser || !amount) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, amount: parseFloat(amount), operation })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(`Saldo actualizado: $${data.newBalance.toFixed(2)}`, 'success')
      setModalOpen(false)
      fetchUsers()
    } catch (e: any) {
      showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const clients = users.filter(u => u.role !== 'admin')
  const admins = users.filter(u => u.role === 'admin')
  const displayUsers = activeTab === 'clients' ? clients : admins
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Users className="text-blue-400" size={28} />
          <h1 className="text-2xl font-bold">Usuarios</h1>
        </div>
        <div className="flex gap-1 mb-6 bg-gray-800 p-1 rounded-lg w-fit">
          <button onClick={() => setActiveTab('clients')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'clients' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            <DollarSign size={16} /> Clientes ({clients.length})
          </button>
          <button onClick={() => setActiveTab('admins')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'admins' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            <Shield size={16} /> Administradores ({admins.length})
          </button>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">Cargando usuarios...</div>
          ) : displayUsers.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400">No hay usuarios en esta categoria</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-900/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Registro</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ultimo login</th>
                  {activeTab === 'clients' && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Saldo</th>}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {displayUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatDate(user.last_sign_in_at)}</td>
                    {activeTab === 'clients' && (
                      <td className="px-4 py-3 text-sm">
                        <span className="font-semibold text-green-400">${Number(user.balance).toFixed(2)}</span>
                        <span className="text-gray-500 ml-1 text-xs">{user.currency}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      {activeTab === 'clients' ? (
                        <button onClick={() => openModal(user)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors">Gestionar Saldo</button>
                      ) : (
                        <button className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-md transition-colors">Degradar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <div>
                <h2 className="font-bold text-lg">Gestionar Saldo</h2>
                <p className="text-sm text-gray-400 truncate">{selectedUser.email}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white p-1 rounded"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2 mb-2">
                {(['add', 'subtract', 'set'] as const).map(op => (
                  <button key={op} onClick={() => setOperation(op)} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${operation === op ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}>
                    {op === 'add' ? 'Agregar' : op === 'subtract' ? 'Descontar' : 'Establecer'}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">Montos rapidos:</p>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 20, 50].map(val => (
                    <button key={val} onClick={() => setAmount(String(val))} className={`py-2 text-sm font-semibold rounded-lg border transition-colors ${amount === String(val) ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-200'}`}>${val}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Monto personalizado</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full pl-7 pr-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" placeholder="0.00" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Saldo actual: <span className="text-green-400 font-medium">${Number(selectedUser.balance).toFixed(2)}</span></p>
              </div>
            </div>
              <div className="px-5 pb-3"><label className="text-xs text-gray-400 mb-1 block">Motivo (opcional)</label><input type="text" value={reason} onChange={(e)=>setReason(e.target.value)} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm" placeholder="Ej: Pago offline..." /></div>
            <div className="flex gap-2 p-5 border-t border-gray-700">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleSaveBalance} disabled={!amount || saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors">{saving ? 'Guardando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
