'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMobileAuth } from '@/hooks/useMobileAuth'

interface Session {
  id: string; started_at: string; ended_at: string | null
  energy_kwh: number | null; cost: number | null; status: string
  charger_id: string; chargers?: { name: string | null }
}

function duration(start: string, end: string | null) {
  if (!end) return 'En curso'
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function relDate(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (diff < 60) return 'Ahora'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`
  if (diff < 172800) return 'Ayer'
  return new Date(d).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })
}

export default function HistorialPage() {
  const { user, loading } = useMobileAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('charging_sessions').select('*, chargers(name)')
      .eq('user_id', user.id).order('started_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setSessions(data); setDataLoading(false) })
  }, [user])

  if (loading || dataLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent" />
    </div>
  )

  const totalKwh = sessions.reduce((s, r) => s + (r.energy_kwh || 0), 0)
  const totalCost = sessions.reduce((s, r) => s + (r.cost || 0), 0)

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a' }}>
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white">Historial</h1>
        <p className="text-gray-500 text-xs mt-0.5">Últimas {sessions.length} sesiones</p>
      </div>

      {sessions.length > 0 && (
        <div className="mx-4 mb-5 grid grid-cols-2 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{totalKwh.toFixed(1)}</p>
            <p className="text-gray-500 text-xs mt-0.5">kWh total</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-white">${totalCost.toFixed(2)}</p>
            <p className="text-gray-500 text-xs mt-0.5">gastado</p>
          </div>
        </div>
      )}

      <div className="px-4 space-y-2">
        {sessions.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
            <p className="text-3xl mb-3">⚡</p>
            <p className="text-white font-medium mb-1">Sin sesiones aún</p>
            <p className="text-gray-500 text-sm">Inicia tu primera carga desde la pantalla principal</p>
          </div>
        ) : sessions.map(s => (
          <div key={s.id} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${s.status === 'active' ? 'bg-yellow-900/40' : 'bg-green-900/30'}`}>⚡</div>
                <div>
                  <p className="text-white text-sm font-semibold">{s.chargers?.name || s.charger_id}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{relDate(s.started_at)} · {duration(s.started_at, s.ended_at)}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                {s.status === 'active'
                  ? <span className="text-xs font-semibold text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full">En curso</span>
                  : <>
                      <p className="text-white text-sm font-bold">${(s.cost || 0).toFixed(2)}</p>
                      <p className="text-gray-500 text-xs">{(s.energy_kwh || 0).toFixed(2)} kWh</p>
                    </>
                }
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
