const metrics = [
  { label: 'Active Chargers', value: '24', sub: '3 offline', icon: '⚡', color: 'green' },
  { label: 'Sessions Today', value: '187', sub: '+12% vs yesterday', icon: '🔌', color: 'blue' },
  { label: 'Total Users', value: '1,432', sub: '28 new this week', icon: '👤', color: 'purple' },
  { label: 'Revenue MTD', value: '$8,924', sub: '+5.2% vs last month', icon: '💰', color: 'yellow' },
]
const colorMap: Record<string, string> = {
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}
const sessions = [
  { id: 'S-1042', user: 'carlos.m@mail.com', charger: 'CP-07', duration: '45 min', kwh: '18.2', cost: '$3.64' },
  { id: 'S-1041', user: 'ana.p@mail.com', charger: 'CP-03', duration: '1h 12min', kwh: '29.4', cost: '$5.88' },
  { id: 'S-1040', user: 'luis.r@mail.com', charger: 'CP-11', duration: '22 min', kwh: '8.8', cost: '$1.76' },
]
export default function Dashboard() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 mt-1">Real-time EV charging overview.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-xl border ${colorMap[m.color]} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium opacity-80">{m.label}</span>
              <span className="text-2xl">{m.icon}</span>
            </div>
            <p className="text-3xl font-bold">{m.value}</p>
            <p className="text-xs mt-1 opacity-60">{m.sub}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold">Recent Sessions</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left px-6 py-3">Session</th>
              <th className="text-left px-6 py-3">User</th>
              <th className="text-left px-6 py-3">Charger</th>
              <th className="text-left px-6 py-3">Duration</th>
              <th className="text-left px-6 py-3">kWh</th>
              <th className="text-left px-6 py-3">Cost</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-6 py-4 text-green-400 font-mono">{s.id}</td>
                <td className="px-6 py-4 text-gray-300">{s.user}</td>
                <td className="px-6 py-4 text-gray-400">{s.charger}</td>
                <td className="px-6 py-4 text-gray-400">{s.duration}</td>
                <td className="px-6 py-4">{s.kwh}</td>
                <td className="px-6 py-4 font-medium">{s.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
