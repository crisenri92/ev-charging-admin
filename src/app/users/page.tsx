const users = [
  { id: 'U-001', name: 'Carlos Mendoza', email: 'carlos.m@mail.com', sessions: 42, spent: '$84.20', joined: '2025-03-12', status: 'active' },
  { id: 'U-002', name: 'Ana Perez', email: 'ana.p@mail.com', sessions: 28, spent: '$56.40', joined: '2025-04-01', status: 'active' },
  { id: 'U-003', name: 'Luis Ramirez', email: 'luis.r@mail.com', sessions: 15, spent: '$30.00', joined: '2025-05-20', status: 'active' },
  { id: 'U-004', name: 'Maria Garcia', email: 'maria.g@mail.com', sessions: 67, spent: '$134.80', joined: '2025-01-08', status: 'active' },
  { id: 'U-005', name: 'Jose Hernandez', email: 'jose.h@mail.com', sessions: 3, spent: '$6.00', joined: '2026-07-30', status: 'new' },
  { id: 'U-006', name: 'Laura Vega', email: 'laura.v@mail.com', sessions: 0, spent: '$0.00', joined: '2026-08-10', status: 'inactive' },
]
const sc: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  new: 'bg-blue-500/10 text-blue-400',
  inactive: 'bg-gray-500/10 text-gray-400',
}
export default function UsersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Users</h2>
          <p className="text-gray-400 mt-1">{users.length} registered users</p>
        </div>
        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">+ Invite User</button>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
              <th className="text-left px-6 py-3">Name</th>
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-left px-6 py-3">Sessions</th>
              <th className="text-left px-6 py-3">Spent</th>
              <th className="text-left px-6 py-3">Joined</th>
              <th className="text-left px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center text-xs font-bold">
                      {u.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <span className="text-white font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-400">{u.email}</td>
                <td className="px-6 py-4 text-gray-300">{u.sessions}</td>
                <td className="px-6 py-4 font-medium">{u.spent}</td>
                <td className="px-6 py-4 text-gray-400">{u.joined}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${sc[u.status]}`}>{u.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
