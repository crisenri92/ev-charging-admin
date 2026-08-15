const sessions = [
  { id: 'S-1042', user: 'carlos.m@mail.com', charger: 'CP-07', start: '2026-08-15 09:12', kwh: '18.2', cost: '$3.64', status: 'completed' },
  { id: 'S-1041', user: 'ana.p@mail.com', charger: 'CP-03', start: '2026-08-15 08:30', kwh: '29.4', cost: '$5.88', status: 'completed' },
  { id: 'S-1040', user: 'luis.r@mail.com', charger: 'CP-11', start: '2026-08-15 07:55', kwh: '8.8', cost: '$1.76', status: 'completed' },
  { id: 'S-1038', user: 'jose.h@mail.com', charger: 'CP-14', start: '2026-08-15 10:05', kwh: '12.1', cost: '$2.42', status: 'active' },
]
const sc: Record<string, string> = {
  completed: 'bg-green-500/10 text-green-400',
  active: 'bg-blue-500/10 text-blue-400',
}
export default function SessionsPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Sessions</h2>
        <p className="text-gray-400 mt-1">Charging session history</p>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
              <th className="text-left px-6 py-3">ID</th>
              <th className="text-left px-6 py-3">User</th>
              <th className="text-left px-6 py-3">Charger</th>
              <th className="text-left px-6 py-3">Start</th>
              <th className="text-left px-6 py-3">kWh</th>
              <th className="text-left px-6 py-3">Cost</th>
              <th className="text-left px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-6 py-4 text-green-400 font-mono">{s.id}</td>
                <td className="px-6 py-4 text-gray-300">{s.user}</td>
                <td className="px-6 py-4 text-gray-400">{s.charger}</td>
                <td className="px-6 py-4 text-gray-400">{s.start}</td>
                <td className="px-6 py-4">{s.kwh}</td>
                <td className="px-6 py-4 font-medium">{s.cost}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${sc[s.status]}`}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
