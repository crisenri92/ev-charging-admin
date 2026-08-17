
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface User {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  created_at: string | null
  balance: number | null
}

function Avatar({ name, email }: { name: string | null; email: string | null }) {
  const initials = (name ?? email ?? '?').slice(0, 2).toUpperCase()
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500']
  const color = colors[(initials.charCodeAt(0) ?? 0) % colors.length]
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
      {initials}
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const filtered = users.filter(u =>
    !search || (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" /></svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por email o nombre..."
            className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-500 w-64"
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-20"><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" /></svg>
            <p className="font-medium text-gray-400 mb-1">{search ? 'Sin resultados' : 'No hay usuarios'}</p>
            <p className="text-sm">{search ? `No se encontraron usuarios con "${search}"` : 'Los usuarios aparecen aquí cuando se registran'}</p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Usuario', 'Email', 'Teléfono', 'Saldo', 'Registrado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} email={u.email} />
                      <div>
                        <p className="font-medium text-white text-sm">{u.name ?? <span className="text-gray-500">Sin nombre</span>}</p>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">{u.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-300">{u.email ?? <span className="text-gray-600">&mdash;</span>}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-400">{u.phone ?? <span className="text-gray-600">&mdash;</span>}</td>
                  <td className="px-4 py-3.5">
                    {u.balance != null ? (
                      <span className={`text-sm font-medium ${u.balance > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                        ${u.balance.toFixed(2)}
                      </span>
                    ) : <span className="text-gray-600 text-sm">&mdash;</span>}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' }) : '&mdash;'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
