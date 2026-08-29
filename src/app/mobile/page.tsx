'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { MobileToast } from '@/components/MobileToast'



interface Charger { id: string; name: string | null; status: string | null; price_per_kwh: number | null }
interface Receipt { chargerName: string; balance: number; sessionId: string; startedAt: string }

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-green-500',
  charging: 'bg-yellow-500',
  offline: 'bg-red-500',
  unavailable: 'bg-gray-600',
}
const STATUS_LABEL: Record<string, string> = {
  available: 'Disponible',
  charging: 'En uso',
  offline: 'Sin conexión',
  unavailable: 'No disponible',
}
const ERROR_MAP: Record<string, string> = {
  insufficient_balance: 'Saldo insuficiente. Recarga tu wallet.',
  'No autenticado': 'Sesión expirada. Vuelve a iniciar sesión.',
  'Charger not found': 'Cargador no encontrado.',
}

function ReceiptModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4 pb-8">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm text-center border border-gray-800">
        <div className="w-16 h-16 rounded-full bg-green-900/60 border-2 border-green-500 flex items-center justify-center text-3xl mx-auto mb-4">⚡</div>
        <h2 className="text-xl font-bold text-white mb-1">¡Carga iniciada!</h2>
        <p className="text-gray-400 text-sm mb-5">Tu sesión está activa</p>
        <div className="bg-gray-800 rounded-2xl p-4 text-left space-y-3 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Cargador</span>
            <span className="text-white text-sm font-semibold">{receipt.chargerName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Inicio</span>
            <span className="text-white text-sm">{new Date(receipt.startedAt).toLocaleTimeString('es-EC')}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-700">
            <span className="text-gray-400 text-sm">Saldo restante</span>
            <span className="text-green-400 text-lg font-bold">${receipt.balance.toFixed(2)}</span>
          </div>
        </div>
        <button onClick={onClose} className="w-full py-3.5 bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-semibold rounded-2xl transition-all">Entendido</button>
      </div>
    </div>
  )
}

function QrConfirmModal({ chargerId, charger, onConfirm, onCancel, loading }: {
  chargerId: string; charger: Charger | undefined; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  const st = (charger?.status || '').toLowerCase()
  const available = st === 'available'
  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4 pb-8">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm text-center border border-gray-800">
        <div className="text-4xl mb-3">📷</div>
        <h2 className="text-xl font-bold text-white mb-1">Cargador detectado</h2>
        <p className="text-gray-400 text-sm mb-4">Escaneaste el código QR de:</p>
        <div className="bg-gray-800 rounded-xl p-3 mb-4">
          <p className="text-white font-semibold">{charger?.name || chargerId}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[st] || 'bg-gray-500'}`} />
            <span className="text-gray-400 text-xs">{STATUS_LABEL[st] || charger?.status || 'Desconocido'}</span>
          </div>
        </div>
        {!available && <p className="text-yellow-400 text-sm mb-4 bg-yellow-900/20 rounded-xl px-3 py-2">Este cargador no está disponible en este momento</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl text-sm font-medium transition-colors">Cancelar</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm transition-all active:scale-[0.98]">
            {loading ? <span className="flex items-center justify-center gap-1"><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Iniciando</span> : 'Iniciar carga'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChargerCard({ charger, onStart, loading }: { charger: Charger; onStart: () => void; loading: boolean }) {
  const st = (charger.status || '').toLowerCase()
  const available = st === 'available'
  return (
    <div className={`bg-gray-900 rounded-2xl p-4 border transition-all ${available ? 'border-green-800/40' : 'border-gray-800'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${available ? 'bg-green-900/40' : 'bg-gray-800'}`}>
            ⚡
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{charger.name || charger.id}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLOR[st] || 'bg-gray-500'}`} />
              <span className="text-xs text-gray-400">{STATUS_LABEL[st] || charger.status}</span>
              {charger.price_per_kwh && <span className="text-xs text-gray-600">· ${charger.price_per_kwh}/kWh</span>}
            </div>
          </div>
        </div>
        {available && (
          <button onClick={onStart} disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 active:scale-[0.96] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all">
            {loading
              ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : 'Cargar'
            }
          </button>
        )}
      </div>
    </div>
  )
}

function MobileContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [chargers, setChargers] = useState<Charger[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCharger, setLoadingCharger] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [qrConfirm, setQrConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'error'|'success'|'info' } | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/mobile/login'); return }
      // Load balance
      fetch('/api/wallet/balance', { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json()).then(d => setBalance(d.balance ?? 0)).catch(() => {})
    })
    fetchChargers()
    const iv = setInterval(fetchChargers, 15000)
    const qrCharger = params.get('charger')
    if (qrCharger) setQrConfirm(qrCharger)
    return () => clearInterval(iv)
  }, [router, params])

  async function fetchChargers() {
    const { data } = await supabase.from('chargers').select('id, name, status, price_per_kwh').order('name')
    if (data) setChargers(data)
    setLoading(false)
  }

  async function startCharge(chargerId: string) {
    setLoadingCharger(chargerId)
    setQrConfirm(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/mobile/login'); return }
      const res = await fetch('/api/charging/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ chargerId }),
      })
      const data = await res.json()
      if (res.status === 402) { setToast({ msg: 'Saldo insuficiente. Recarga tu wallet.', type: 'error' }); setTimeout(() => router.push('/wallet'), 1800); return }
      if (!res.ok) { setToast({ msg: ERROR_MAP[data.error] || 'Error al iniciar carga', type: 'error' }); return }
      setReceipt({ chargerName: data.chargerName || chargerId, balance: data.balance ?? 0, sessionId: data.sessionId, startedAt: new Date().toISOString() })
      fetchChargers()
      // Refresh balance
      setBalance(data.balance ?? 0)
    } catch { setToast({ msg: 'Error de conexión. Intenta de nuevo.', type: 'error' }) }
    finally { setLoadingCharger(null) }
  }

  const qrCharger = qrConfirm ? chargers.find(c => c.id === qrConfirm) : null
  const available = chargers.filter(c => (c.status || '').toLowerCase() === 'available')
  const unavailable = chargers.filter(c => (c.status || '').toLowerCase() !== 'available')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Buscando cargadores...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a' }}>
      {toast && <MobileToast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {qrConfirm && <QrConfirmModal chargerId={qrConfirm} charger={qrCharger} onConfirm={() => startCharge(qrConfirm)} onCancel={() => { setQrConfirm(null); router.replace('/mobile') }} loading={loadingCharger === qrConfirm} />}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}

      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Cargadores</h1>
          <p className="text-gray-500 text-xs mt-0.5">Actualiza cada 15s</p>
        </div>
        <button onClick={() => router.push('/wallet')}
          className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 px-3 py-2 rounded-xl">
          <span className="text-green-400 text-sm font-bold">{balance !== null ? `$${balance.toFixed(2)}` : '...'}</span>
          <span className="text-gray-500 text-xs">→</span>
        </button>
      </div>

      <div className="px-4 space-y-6">
        {available.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-2">Disponibles · {available.length}</p>
            <div className="space-y-2">
              {available.map(c => (
                <ChargerCard key={c.id} charger={c} onStart={() => startCharge(c.id)} loading={loadingCharger === c.id} />
              ))}
            </div>
          </div>
        )}

        {available.length === 0 && (
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
            <p className="text-3xl mb-3">🔌</p>
            <p className="text-white font-medium mb-1">Sin cargadores disponibles</p>
            <p className="text-gray-500 text-sm">El sistema verifica automáticamente cada 15 segundos</p>
          </div>
        )}

        {unavailable.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">No disponibles · {unavailable.length}</p>
            <div className="space-y-2 opacity-50">
              {unavailable.map(c => (
                <ChargerCard key={c.id} charger={c} onStart={() => {}} loading={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MobilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}><div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent" /></div>}>
      <MobileContent />
    </Suspense>
  )
}
