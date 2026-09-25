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

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div>
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
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      roleColor[u.role] || 'bg-gray-500/10 text-gray-400'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Link
                    href={`/users/${u.id}/sessions`}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors"
                  >
                    Historial
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
