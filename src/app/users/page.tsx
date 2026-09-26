'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface AdminUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  user_metadata: Record<string, any>
  role: string
  balance: number
  currency: string
}

type BalanceOp = 'add' | 'subtract' | 'set'

const roleColor: Record<string, string> = {
  admin: 'bg-purple-500/10 text-purple-400',
  client: 'bg-green-500/10 text-green-400',
}

function initials(u: AdminUser) {
  const name = u.user_metadata?.full_name || u.email || ''
  return name.split(/[\s@]/).map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800">
      {[1,2,3,4,5].map(i => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-800 rounded animate-pulse" style={{ width: i === 1 ? '80%' : i === 2 ? '60%' : '50%' }} />
        </td>
      ))}
    </tr>
  )
}

// M-7: Balance adjustment modal with extra confirmation for destructive ops
function BalanceModal({
  user,
  onClose,
  onSuccess,
}: {
  user: AdminUser
  onClose: () => void
  onSuccess: (userId: string, newBalance: number) => void
}) {
  const [op, setOp] = useState<BalanceOp>('add')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const destructive = op === 'subtract' || op === 'set'
  const parsedAmount = parseFloat(amount)

  const previewBalance = () => {
    if (isNaN(parsedAmount) || parsedAmount < 0) return null
    if (op === 'add') return user.balance + parsedAmount
    if (op === 'subtract') return Math.max(0, user.balance - parsedAmount)
    return parsedAmount
  }

  const preview = previewBalance()

  const handleNext = () => {
    if (!amount || isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Ingresa un monto válido')
      return
    }
    setError('')
    if (destructive) {
      setStep('confirm')
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, operation: op, amount: parsedAmount, note }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error desconocido')
      onSuccess(user.id, json.newBalance)
      onClose()
    } catch (e: any) {
      setError(e.message)
      setStep('form')
    } finally {
      setSaving(false)
    }
  }

  const opLabel = { add: 'Añadir', subtract: 'Descontar', set: 'Establecer' }[op]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        {step === 'form' ? (
          <>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Ajustar saldo</h3>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-gray-800/60 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Usuario</p>
              <p className="text-sm text-white font-medium">{user.user_metadata?.full_name || user.email}</p>
              <p className="text-xs text-gray-500">Saldo actual: <span className="text-white font-mono">${user.balance.toFixed(2)}</span></p>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2 font-medium">Operación</p>
              <div className="grid grid-cols-3 gap-2">
                {(['add', 'subtract', 'set'] as BalanceOp[]).map(o => (
                  <button
                    key={o}
                    onClick={() => setOp(o)}
                    className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                      op === o
                        ? o === 'add' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : o === 'subtract' ? 'border-red-500 bg-red-500/20 text-red-300'
                          : 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {o === 'add' ? '+ Añadir' : o === 'subtract' ? '− Descontar' : '= Establecer'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                Monto ({op === 'set' ? 'nuevo saldo' : 'USD'})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Nota (opcional)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ej: Ajuste manual por error de cobro"
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>

            {preview !== null && !isNaN(preview) && (
              <div className="mb-4 rounded-xl bg-gray-800/40 px-4 py-2.5 text-sm">
                <span className="text-gray-400">Saldo resultante: </span>
                <span className="font-mono font-semibold text-white">${preview.toFixed(2)}</span>
              </div>
            )}

            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-xl border border-gray-700 py-2.5 text-sm text-gray-400 hover:bg-gray-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleNext}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  destructive
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {opLabel}
              </button>
            </div>
          </>
        ) : (
          // M-7: Extra confirmation step for destructive operations
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-red-400">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Confirmar operación</h3>
            <p className="text-sm text-gray-400 mb-1">
              Estás a punto de <strong className="text-white">{op === 'subtract' ? 'descontar' : 'establecer en'} ${parsedAmount.toFixed(2)}</strong> al saldo de:
            </p>
            <p className="text-sm text-white font-medium mb-1">{user.user_metadata?.full_name || user.email}</p>
            <div className="flex items-center gap-2 mb-6 text-sm">
              <span className="text-gray-500 line-through font-mono">${user.balance.toFixed(2)}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-500">
                <path fillRule="evenodd" d="M16.72 7.72a.75.75 0 011.06 0l3.75 3.75a.75.75 0 010 1.06l-3.75 3.75a.75.75 0 11-1.06-1.06l2.47-2.47H3a.75.75 0 010-1.5h16.19l-2.47-2.47a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
              <span className="text-white font-mono font-semibold">${(preview ?? 0).toFixed(2)}</span>
            </div>
            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep('form')} className="flex-1 rounded-xl border border-gray-700 py-2.5 text-sm text-gray-400 hover:bg-gray-800 transition-colors">
                ← Volver
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                {saving ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [balanceUser, setBalanceUser] = useState<AdminUser | null>(null)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        if (data.users) setUsers(data.users)
        else setError(data.error || 'Error cargando usuarios')
      })
      .catch(() => setError('Error de red'))
      .finally(() => setLoading(false))
  }, [])

  const handleBalanceSuccess = (userId: string, newBalance: number) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: newBalance } : u))
  }

  return (
    <div>
      {balanceUser && (
        <BalanceModal
          user={balanceUser}
          onClose={() => setBalanceUser(null)}
          onSuccess={handleBalanceSuccess}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Usuarios</h2>
          <p className="text-gray-400 mt-1">{loading ? '…' : `${users.length} usuarios registrados`}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
              <th className="text-left px-6 py-3">Nombre</th>
              <th className="text-left px-6 py-3">Saldo</th>
              <th className="text-left px-6 py-3">Último acceso</th>
              <th className="text-left px-6 py-3">Rol</th>
              <th className="text-left px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
            {!loading && !error && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                  <p className="text-4xl mb-3">👤</p>
                  <p className="font-medium text-gray-400">No hay usuarios registrados</p>
                </td>
              </tr>
            )}
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center text-xs font-bold">
                      {initials(u)}
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {u.user_metadata?.full_name || '—'}
                      </div>
                      <div className="text-gray-500 text-xs">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-white">
                  ${u.balance.toFixed(2)} {u.currency}
                </td>
                <td className="px-6 py-4 text-gray-400">
                  {u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleDateString('es-MX')
                    : '—'}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${roleColor[u.role] || 'bg-gray-500/10 text-gray-400'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBalanceUser(u)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 transition-colors"
                    >
                      Saldo
                    </button>
                    <Link
                      href={`/users/${u.id}/sessions`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors"
                    >
                      Historial
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
