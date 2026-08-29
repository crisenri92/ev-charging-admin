'use client'
import { useEffect, useState, Suspense, useCallback } from 'react'
import { MobileToast } from '@/components/MobileToast'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Charger {
  id: string
  name: string | null
  status: string | null
  price_per_kwh: number | null
}

interface Receipt {
  chargerName: string
  balance: number
  sessionId: string
  startedAt: string
}

function ReceiptModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm text-center">
        <span className="text-5xl">✅</span>
        <h2 className="text-xl font-bold text-white mt-3 mb-1">Carga iniciada</h2>
        <p className="text-gray-400 text-sm mb-4">Tu sesión de carga comenzó correctamente</p>
        <div className="bg-gray-800 rounded-xl p-4 text-left space-y-2 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Cargador</span>
            <span className="text-white text-sm font-medium">{receipt.chargerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Sesión</span>
            <span className="text-white text-sm font-mono">{receipt.sessionId.slice(0,8)}…</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Inicio</span>
            <span className="text-white text-sm">{new Date(receipt.startedAt).toLocaleTimeString('es-EC')}</span>
          </div>
          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
            <span className="text-gray-400 text-sm">Saldo restante</span>
            <span className="text-green-400 text-sm font-bold">${receipt.balance.toFixed(2)}</span>
          </div>
        </div>
        <button onClick={onClose}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors">
          Entendido
        </button>
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
  const [qrConfirm, setQrConfirm] = useState<string | null>(null) // charger id from QR
  const [toast, setToast] = useState<{ msg: string; type: 'error'|'success'|'info' } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/mobile/login')
    })
    fetchChargers()
    const iv = setInterval(fetchChargers, 15000)

    // Check for ?charger= param (from QR scan)
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ chargerId }),
      })
      const data = await res.json()
      if (res.status === 402) { setToast({ msg: 'Saldo insuficiente. Recarga tu wallet.', type: 'error' }); router.push('/wallet'); return }
      if (!res.ok) { setToast({ msg: translateError(data.error) || 'Error al iniciar carga', type: 'error' }); return }

      setReceipt({
        chargerName: data.chargerName || chargerId,
        balance: data.balance ?? 0,
        sessionId: data.sessionId,
        startedAt: new Date().toISOString(),
      })
      fetchChargers()
    } catch { setToast({ msg: 'Error de conexión. Intenta de nuevo.', type: 'error' }) }
    finally { setLoadingCharger(null) }
  }

  function translateError(msg: string): string {
    const map: Record<string, string> = {
      'insufficient_balance': 'Saldo insuficiente. Recarga tu wallet.',
      'No autenticado': 'Tu sesión expiró. Vuelve a iniciar sesión.',
      'Charger not found': 'Cargador no encontrado.',
    }
    return map[msg] || msg
  }

  const qrCharger = qrConfirm ? chargers.find(c => c.id === qrConfirm) : null
  const available = chargers.filter(c => (c.status || '').toLowerCase() === 'available')
  const unavailable = chargers.filter(c => (c.status || '').toLowerCase() !== 'available')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#111827' }}>
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen text-white pb-20 px-4 pt-6" style={{ background: '#111827' }}>
      {toast && <MobileToast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {/* QR confirm modal */}
      {qrConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm text-center">
            <span className="text-4xl">⚡</span>
            <h2 className="text-xl font-bold text-white mt-3 mb-1">Iniciar carga</h2>
            <p className="text-gray-400 text-sm mb-2">Cargador detectado:</p>
            <p className="text-green-400 font-bold text-lg mb-6">{qrCharger?.name || qrConfirm}</p>
            {qrCharger?.status?.toLowerCase() !== 'available' && (
              <p className="text-yellow-400 text-sm mb-4">⚠️ Este cargador no está disponible ({qrCharger?.status || 'Offline'})</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setQrConfirm(null); router.replace('/mobile') }}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm">Cancelar</button>
              <button onClick={() => startCharge(qrConfirm)} disabled={!!loadingCharger}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm">
                {loadingCharger ? 'Iniciando...' : 'Iniciar carga'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">⚡ Cargadores EV</h1>
        <button onClick={() => router.push('/wallet')}
          className="text-sm text-green-400 border border-green-700 px-3 py-1 rounded-lg">
          Mi Wallet
        </button>
      </div>

      {available.length > 0 && (
        <div className="mb-6">
          <p className="text-green-400 text-xs font-semibold uppercase tracking-wide mb-3">DISPONIBLES ({available.length})</p>
          <div className="space-y-3">
            {available.map(c => (
              <div key={c.id} className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{c.name || c.id}</p>
                  <p className="text-gray-500 text-xs">${c.price_per_kwh ?? 0.15}/kWh</p>
                </div>
                <button
                  onClick={() => startCharge(c.id)}
                  disabled={loadingCharger === c.id}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                  {loadingCharger === c.id ? '...' : 'Cargar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {available.length === 0 && !loading && (
        <div className="bg-gray-900 rounded-xl p-6 text-center mb-4">
          <p className="text-gray-500 text-sm">No hay cargadores disponibles en este momento</p>
        </div>
      )}

      {unavailable.length > 0 && (
        <div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">NO DISPONIBLES ({unavailable.length})</p>
          <div className="space-y-2">
            {unavailable.map(c => (
              <div key={c.id} className="bg-gray-900/50 rounded-xl p-4 flex items-center justify-between opacity-60">
                <p className="text-gray-400 font-medium">{c.name || c.id}</p>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">{c.status || 'Offline'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MobilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#111827' }}><div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent" /></div>}>
      <MobileContent />
    </Suspense>
  )
}
