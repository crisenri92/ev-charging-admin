const chargers = [
  { id: 'CP-01', name: 'Zone A - Spot 1', type: 'DC Fast', power: '50kW', status: 'available', sessions: 142 },
  { id: 'CP-02', name: 'Zone A - Spot 2', type: 'DC Fast', power: '50kW', status: 'occupied', sessions: 98 },
  { id: 'CP-03', name: 'Zone B - Spot 1', type: 'AC Level 2', power: '22kW', status: 'available', sessions: 203 },
  { id: 'CP-07', name: 'Zone B - Spot 5', type: 'DC Fast', power: '100kW', status: 'occupied', sessions: 67 },
  { id: 'CP-11', name: 'Zone C - Spot 1', type: 'AC Level 2', power: '7kW', status: 'offline', sessions: 312 },
  { id: 'CP-14', name: 'Zone C - Spot 4', type: 'DC Ultra', power: '150kW', status: 'available', sessions: 45 },
]
const statusColor: Record<string, string> = {
  available: 'bg-green-500/10 text-green-400 border border-green-500/20',
  occupied: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  offline: 'bg-red-500/10 text-red-400 border border-red-500/20',
}
export default function ChargersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Chargers</h2>
          <p className="text-gray-400 mt-1">{chargers.length} charging points</p>
        </div>
        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">+ Add Charger</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {chargers.map((c) => (
          <div key={c.id} className="rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-mono text-green-400 text-sm">{c.id}</p>
                <p className="font-medium text-white mt-1">{c.name}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${statusColor[c.status]}`}>{c.status}</span>
            </div>
            <div className="flex gap-4 text-sm text-gray-400 mt-4">
              <span>🔋 {c.type}</span>
              <span>⚡ {c.power}</span>
              <span>📋 {c.sessions}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
