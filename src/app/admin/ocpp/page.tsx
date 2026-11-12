'use client'
import { useEffect, useState, useRef } from 'react'

interface ChargerInfo {
  id: string
  status: string
  connectorStatus?: string
  activeSession: { transactionId: number; idTag?: string; meterStart?: number } | null
  lastHeartbeat?: string
}

interface LogEntry { ts: string; dir: 'req'|'res'; label: string; body: string }

const CMD_STYLE: Record<string, string> = {
  'remote-start': 'bg-green-700 hover:bg-green-600',
  'remote-stop':  'bg-red-800 hover:bg-red-700',
  'reset-soft':   'bg-yellow-700 hover:bg-yellow-600',
  'reset-hard':   'bg-orange-700 hover:bg-orange-600',
  'unlock':       'bg-blue-700 hover:bg-blue-600',
}

function statusColor(s: string) {
  const ls = s.toLowerCase()
  if (ls === 'available') return 'text-green-400'
  if (ls === 'charging' || ls === 'preparing') return 'text-yellow-400'
  if (ls === 'faulted' || ls === 'unavailable') return 'text-red-400'
  return 'text-gray-400'
}

export default function OcppPanel() {
  const [chargers, setChargers] = useState<ChargerInfo[]>([])
  const [selected, setSelected] = useState('')
  const [idTag, setIdTag] = useState('DEMO')
  const [connectorId, setConnectorId] = useState('1')
  const [txId, setTxId] = useState('')
  const [log, setLog] = useState<LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const addLog = (dir: 'req'|'res', label: string, body: unknown) =>
    setLog(prev => [{ ts: new Date().toLocaleTimeString('es-EC'), dir, label, body: JSON.stringify(body, null, 2) }, ...prev.slice(0, 49)])

  const fetchChargers = async () => {
    try {
      const r = await fetch('/api/ocpp-proxy')
      if (!r.ok) return
      const data: ChargerInfo[] = await r.json()
      setChargers(data)
      if (!selected && data.length > 0) setSelected(data[0].id)
      const sel = data.find(c => c.id === (selected || data[0]?.id))
      if (sel?.activeSession?.transactionId) setTxId(String(sel.activeSession.transactionId))
    } catch {}
  }

  useEffect(() => {
    fetchChargers()
    if (!autoRefresh) return
    const iv = setInterval(fetchChargers, 5000)
    return () => clearInterval(iv)
  }, [autoRefresh, selected])

  const sendCommand = async (action: string) => {
    if (!selected) return
    setBusy(true)
    const payload =
      action === 'remote-start' ? { idTag, connectorId: parseInt(connectorId) || 1 } :
      action === 'remote-stop'  ? { transactionId: parseInt(txId) || 0 } :
      action === 'reset-soft'   ? { type: 'Soft' } :
      action === 'reset-hard'   ? { type: 'Hard' } : {}
    const realAction = action.startsWith('reset') ? 'reset' : action
    addLog('req', action.toUpperCase(), { chargerId: selected, action: realAction, payload })
    try {
      const r = await fetch('/api/ocpp-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargerId: selected, action: realAction, payload }),
      })
      const data = await r.json()
      addLog('res', `${action.toUpperCase()} ${r.status}`, data)
      await fetchChargers()
    } catch (e: any) {
      addLog('res', 'ERROR', { error: e.message })
    } finally { setBusy(false) }
  }

  const selCharger = chargers.find(c => c.id === selected)

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel OCPP</h1>
            <p className="text-gray-500 text-sm">Comandos directos al CSMS / VESTEL</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="w-4 h-4 accent-green-500" />
              Auto 5s
            </label>
            <button onClick={fetchChargers} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs rounded-lg border border-gray-700">
              ↻ Refrescar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            {/* Charger list */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Cargadores</p>
              {chargers.length === 0
                ? <p className="text-gray-600 text-sm">Sin cargadores conectados al CSMS</p>
                : chargers.map(c => (
                  <button key={c.id} onClick={() => setSelected(c.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border mb-2 transition-all ${selected === c.id ? 'bg-gray-800 border-gray-600' : 'bg-gray-950 border-gray-800 hover:border-gray-700'}`}>
                    <div className="text-left">
                      <p className="font-mono text-sm">{c.id}</p>
                      {c.activeSession && <p className="text-xs text-yellow-500 mt-0.5">TX #{c.activeSession.transactionId}</p>}
                    </div>
                    <span className={`text-xs font-bold ${statusColor(c.status)}`}>{c.status}</span>
                  </button>
                ))
              }
            </div>

            {/* Detail */}
            {selCharger && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 font-mono text-xs space-y-1.5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-sans">Estado actual</p>
                {[
                  ['ID', selCharger.id],
                  ['Status', selCharger.status],
                  selCharger.connectorStatus ? ['Connector', selCharger.connectorStatus] : null,
                  selCharger.activeSession ? ['TX ID', String(selCharger.activeSession.transactionId)] : ['Sesión', 'ninguna'],
                  selCharger.activeSession?.idTag ? ['idTag', selCharger.activeSession.idTag] : null,
                  selCharger.activeSession?.meterStart != null ? ['Meter start', selCharger.activeSession.meterStart + ' Wh'] : null,
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k as string} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className={`${k === 'Status' ? statusColor(v as string) : 'text-gray-200'}`}>{v as string}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Params */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Parámetros</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">idTag</label>
                  <input value={idTag} onChange={e => setIdTag(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Connector ID</label>
                  <input value={connectorId} onChange={e => setConnectorId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Transaction ID (stop)</label>
                <input value={txId} onChange={e => setTxId(e.target.value)} placeholder="auto desde sesión activa" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500" />
              </div>
            </div>

            {/* Commands */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Comandos OCPP 1.6</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'remote-start', label: '▶ RemoteStart' },
                  { id: 'remote-stop',  label: '■ RemoteStop'  },
                  { id: 'reset-soft',   label: '↺ Reset Soft'  },
                  { id: 'reset-hard',   label: '⚡ Reset Hard' },
                  { id: 'unlock',       label: '🔓 Unlock Connector', full: true },
                ].map(cmd => (
                  <button key={cmd.id} onClick={() => sendCommand(cmd.id)} disabled={busy || !selected}
                    className={`py-2.5 px-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 active:scale-[0.97] ${CMD_STYLE[cmd.id]} ${cmd.full ? 'col-span-2' : ''}`}>
                    {busy ? '...' : cmd.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Log */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col" style={{minHeight: 600}}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Log</p>
              <button onClick={() => setLog([])} className="text-xs text-gray-600 hover:text-gray-400">Limpiar</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs">
              {log.length === 0 && <p className="text-gray-700 text-center mt-10">Sin actividad</p>}
              {log.map((e, i) => (
                <div key={i} className={`rounded-lg p-2.5 border ${e.dir === 'req' ? 'bg-blue-950/30 border-blue-900/40' : 'bg-gray-800 border-gray-700'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${e.dir === 'req' ? 'bg-blue-800 text-blue-200' : 'bg-gray-700 text-gray-300'}`}>
                      {e.dir === 'req' ? '→ REQ' : '← RES'}
                    </span>
                    <span className="text-gray-300 font-semibold">{e.label}</span>
                    <span className="text-gray-600 ml-auto">{e.ts}</span>
                  </div>
                  <pre className="text-gray-400 whitespace-pre-wrap break-all leading-relaxed">{e.body}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
