'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ChargingSession {
  id: string;
  transaction_id: number;
  charger_id: string;
  status: string;
  energy_kwh: number | null;
  cost: number | null;
  start_time: string | null;
  stop_time: string | null;
  stop_reason: string | null;
  created_at: string;
}

interface BalanceSummary {
  balance: number;
  currency: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDuration(start: string | null, stop: string | null) {
  if (!start || !stop) return '—';
  const mins = Math.round((new Date(stop).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    active: 'bg-blue-100 text-blue-800',
    error: 'bg-red-100 text-red-800',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-800';
}

export default function HistorialPage() {
  const [sessions, setSessions] = useState<ChargingSession[]>([]);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('No autenticado'); setLoading(false); return; }

        const [{ data: sessData, error: sessErr }, { data: balData }] = await Promise.all([
          supabase
            .from('charging_sessions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('user_balances')
            .select('balance, currency')
            .eq('user_id', user.id)
            .single(),
        ]);

        if (sessErr) throw new Error(sessErr.message);
        setSessions(sessData ?? []);
        setBalance(balData);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-600">Error: {error}</div>
  );

  const totalCost = sessions.reduce((s, r) => s + (r.cost ?? 0), 0);
  const totalEnergy = sessions.reduce((s, r) => s + (r.energy_kwh ?? 0), 0);
  const completed = sessions.filter(s => s.status === 'completed').length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Historial de Sesiones</h1>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Saldo actual', value: balance ? `$${balance.balance.toFixed(2)}` : '—' },
          { label: 'Sesiones completadas', value: completed.toString() },
          { label: 'Energía total (kWh)', value: totalEnergy.toFixed(2) },
          { label: 'Costo total', value: `$${totalCost.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      {sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Sin sesiones de carga aún</p>
          <p className="text-sm mt-1">Las sesiones aparecerán aquí después de tu primera carga</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  {['Fecha', 'Cargador', 'Duración', 'kWh', 'Costo', 'Estado', 'Razón'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(s.start_time ?? s.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-gray-800">{s.charger_id}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDuration(s.start_time, s.stop_time)}</td>
                    <td className="px-4 py-3 text-gray-800">{s.energy_kwh != null ? s.energy_kwh.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.cost != null ? `$${s.cost.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.stop_reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
