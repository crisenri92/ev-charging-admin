import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  new: 'bg-blue-500/10 text-blue-400',
  inactive: 'bg-gray-500/10 text-gray-400',
}

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, balance, role')
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

  const rows = (users ?? []).map(u => {
    const profile: any = profileMap.get(u.id) ?? {}
    const joined = new Date(u.created_at)
    const daysSince = (Date.now() - joined.getTime()) / 86400000
    const lastSeen = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null
    const status = daysSince < 7 ? 'new' : lastSeen ? 'active' : 'inactive'
    return {
      id: u.id,
      email: u.email ?? '—',
      balance: profile.balance ?? 0,
      role: profile.role ?? 'user',
      joined: joined.toLocaleDateString('es-EC'),
      status,
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Usuarios</h2>
          <p className="text-gray-400 mt-1">{rows.length} usuarios registrados</p>
        </div>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-left px-6 py-3">Saldo</th>
              <th className="text-left px-6 py-3">Rol</th>
              <th className="text-left px-6 py-3">Registro</th>
              <th className="text-left px-6 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center text-xs font-bold">
                      {u.email[0]?.toUpperCase()}
                    </div>
                    <span className="text-white font-medium">{u.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-300">${(u.balance ?? 0).toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-gray-500/10 text-gray-400'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-400">{u.joined}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[u.status]}`}>{u.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center text-gray-500 py-12">No hay usuarios registrados</div>
        )}
      </div>
    </div>
  )
}
