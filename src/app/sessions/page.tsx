'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Session {
  id: string
  charger_id: string | null
  started_at: string | null
  ended_at: string | null
  kwh_delivered: number | null
  amount_charged: number | null
  user_id: string | null
  transaction_id: string | null
}

function duration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const mins = Math.floor((e.getTime() - s.getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

function StatusPill({ ended }: { ended: string | null }) {
  return ended
    ? <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">Completada</span>
    : <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300 border border-emerald-500/30">Activa</span>
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('charging_sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100)
      if (error) setError('Tabla charging_sessions no encontrada. Créala en Supabase.')
      else setSessions(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Sesiones de Carga</h1>
        <p className="mt-1 text-sm text-gray-400">Historial de sesiones registradas</p>
      </div>

      {error && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
          <strong>Sin datos:</strong> {error}
          <div className="mt-3">
            <p className="mb-2 font-mono text-xs text-gray-400">Ejecuta en Supabase SQL Editor:</p>
            <pre className="overflow-x-auto rounded bg-black/40 p-3 text-xs text-gray-300">{`CREATE TABLE charging_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  charger_id text REFERENCES chargers(id),
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  kwh_delivered numeric,
  amount_charged numeric,
  user_id text,
  transaction_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE charging_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_select_sessions ON charging_sessions
  FOR SELECT TO anon USING (true);`}</pre>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Cargando sesiones...
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-8 text-center text-gray-500">
          No hay sesiones registradas aún.
        </div>
      )}

      {/* Desktop table */}
      {!loading && sessions.length > 0 && (
        <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                {['Cargador', 'Inicio', 'Duración', 'kWh', 'Monto', 'Estado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-300">{s.charger_id ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{fmtDate(s.started_at)}</td>
                  <td className="px-4 py-3 text-gray-300">{duration(s.started_at, s.ended_at)}</td>
                  <td className="px-4 py-3 text-gray-300">{s.kwh_delivered != null ? `${s.kwh_delivered.toFixed(2)} kWh` : '—'}</td>
                  <td className="px-4 py-3 text-emerald-300">{s.amount_charged != null ? `$${s.amount_charged.toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-3"><StatusPill ended={s.ended_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!loading && sessions.length > 0 && (
        <div className="space-y-3 md:hidden">
          {sessions.map(s => (
            <div key={s.id} className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-blue-300">{s.charger_id ?? '—'}</span>
                <StatusPill ended={s.ended_at} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-gray-500">Inicio</p><p className="text-gray-300">{fmtDate(s.started_at)}</p></div>
                <div><p className="text-gray-500">Duración</p><p className="text-gray-300">{duration(s.started_at, s.ended_at)}</p></div>
                <div><p className="text-gray-500">kWh</p><p className="text-gray-300">{s.kwh_delivered != null ? `${s.kwh_delivered.toFixed(2)}` : '—'}</p></div>
                <div><p className="text-gray-500">Monto</p><p className="text-emerald-300">{s.amount_charged != null ? `$${s.amount_charged.toFixed(2)}` : '—'}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
