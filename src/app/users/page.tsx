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
          <h2 className="text-2xl font-bold text-white">Users</h2>
          <p className="text-gray-400 mt-1">{users.length} registered users</p>
        </div>
        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
          + Invite User
        </button>
      </div>

      {loading && <p className="text-gray-400">Loading users...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Balance</th>
                <th className="text-left px-6 py-3">Last sign in</th>
                <th className="text-left px-6 py-3">Role</th>
                <th className="text-left px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
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
      )}
    </div>
  )
}
