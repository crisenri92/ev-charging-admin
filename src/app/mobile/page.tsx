'use client'
import { useEffect, useState, Suspense, lazy, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { MobileToast } from '@/components/MobileToast'

const ChargerMap = lazy(() => import('@/components/ChargerMap'))
const PWAInstallBanner = lazy(() => import('@/components/PWAInstallBanner'))

interface Charger {
  id: string
  name: string | null
  status: string | null
  price_per_kwh: number | null
  latitude: number | null
  longitude: number | null
  address: string | null
}
interface Receipt { chargerName: string; balance: number; sessionId: string; startedAt: string }
interface Reservation { id: string; charger_id: string; charger_name: string; expires_at: string; duration_minutes: number }

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-green-500', charging: 'bg-yellow-500', offline: 'bg-red-500', unavailable: 'bg-gray-600',
}
const STATUS_LABEL: Record<string, string> = {
  available: 'Disponible', charging: 'En uso', offline: 'Sin conexión', unavailable: 'No disponible',
}
const ERROR_MAP: Record<string, string> = {
  insufficient_balance: 'Saldo insuficiente. Recarga tu wallet.',
  'No autenticado': 'Sesión expirada. Vuelve a iniciar sesión.',
  'Charger not found': 'Cargador no encontrado.',
}

function useCountdown(expiresAt: string | null) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [expiresAt])
  return secs
}

function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const secs = useCountdown(expiresAt)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-lg ${secs < 60 ? 'bg-red-900/40 text-red-400' : 'bg-blue-900/40 text-blue-400'}`}>
      {m}:{String(s).padStart(2, '0')}
    </span>
  )
}

function ReserveModal({ charger, onConfirm, onCancel, loading }: {
  charger: Charger; onConfirm: (mins: number) => void; onCancel: () => void; loading: boolean
}) {
  const [duration, setDuration] = useState(30)
  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4 pb-8">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm text-center border border-gray-800">
        <div className="text-3xl mb-3">🕐</div>
        <h2 className="text-xl font-bold text-white mb-1">Reservar cargador</h2>
        <p className="text-gray-400 text-sm mb-5">{charger.name || charger.id}</p>
        <p className="text-gray-500 text-xs mb-3">¿Cuánto tiempo necesitas?</p>
        <div className="flex gap-2 mb-5">
          {[15, 30, 60].map(m => (
            <button key={m} onClick={() => setDuration(m)}
              className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all ${duration === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {m} min
            </button>
          ))}
        </div>
        <p className="text-gray-600 text-xs mb-5">El cargador quedará reservado hasta las {new Date(Date.now() + duration * 60000).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl text-sm font-medium transition-colors">Cancelar</button>
          <button onClick={() => onConfirm(duration)} disabled={loading}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm transition-all active:scale-[0.98]">
            {loading ? <span className="flex items-center justify-center gap-1"><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></span> : 'Reservar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReceiptModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4 pb-8">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm text-center border border-gray-800">
        <div className="w-16 h-16 rounded-full bg-green-900/60 border-2 border-green-500 flex items-center justify-center text-3xl mx-auto mb-4">⚡</div>
        <h2 className="text-xl font-bold text-white mb-1">¡Carga iniciada!</h2>
        <p className="text-gray-400 text-sm mb-5">Tu sesión está activa</p>
        <div className="bg-gray-800 rounded-2xl p-4 text-left space-y-3 mb-5">
          <div className="flex justify-between"><span className="text-gray-400 text-sm">Cargador</span><span className="text-white text-sm font-semibold">{receipt.chargerName}</span></div>
          <div className="flex justify-between"><span className="text-gray-400 text-sm">Inicio</span><span className="text-white text-sm">{new Date(receipt.startedAt).toLocaleTimeString('es-EC')}</span></div>
          <div className="flex justify-between pt-2 border-t border-gray-700"><span className="text-gray-400 text-sm">Saldo restante</span><span className="text-green-400 text-lg font-bold">${receipt.balance.toFixed(2)}</span></div>
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
            <span className="text-gray-400 text-xs">{STATUS_LABEL[st] || charger?.status}</span>
          </div>
        </div>
        {!available && <p className="text-yellow-400 text-sm mb-4 bg-yellow-900/20 rounded-xl px-3 py-2">Este cargador no está disponible</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-800 text-white rounded-2xl text-sm font-medium">Cancelar</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm transition-all">
            {loading ? <svg className="animate-spin h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : 'Iniciar carga'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChargerCard({ charger, onStart, onReserve, onCancelReservation, loading, dynamicPrice, myReservation, hasOtherReservation }: {
  charger: Charger; onStart: () => void; onReserve: () => void; onCancelReservation: () => void
  loading: boolean; dynamicPrice?: { price: number; ruleName: string } | null
  myReservation?: Reservation | null; hasOtherReservation?: boolean
}) {
  const st = (charger.status || '').toLowerCase()
  const available = st === 'available'
  const isReservedByMe = !!myReservation
  const isReservedByOther = !isReservedByMe && !!hasOtherReservation

  return (
    <div className={`bg-gray-900 rounded-2xl p-4 border transition-all ${isReservedByMe ? 'border-blue-700/60' : available ? 'border-green-800/40' : 'border-gray-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${isReservedByMe ? 'bg-blue-900/40' : available ? 'bg-green-900/40' : 'bg-gray-800'}`}>
            {isReservedByMe ? '🔖' : '⚡'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-semibold text-sm">{charger.name || charger.id}</p>
              {isReservedByMe && myReservation && <CountdownBadge expiresAt={myReservation.expires_at} />}
              {isReservedByOther && <span className="text-xs bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded-lg">Reservado</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLOR[st] || 'bg-gray-500'}`} />
              <span className="text-xs text-gray-400">{STATUS_LABEL[st] || charger.status}</span>
              {dynamicPrice && !isReservedByOther && <span className="text-xs text-green-700">· ${dynamicPrice.price.toFixed(2)}/kWh</span>}
            </div>
            {charger.address && <p className="text-xs text-gray-600 mt-0.5 truncate max-w-[180px]">{charger.address}</p>}
            {isReservedByMe && <p className="text-xs text-blue-400 mt-0.5">Tu reserva activa</p>}
          </div>
        </div>
        {available && !isReservedByOther && (
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={onStart} disabled={loading}
              className="px-3 py-2 bg-green-600 hover:bg-green-500 active:scale-[0.96] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all">
              {loading ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : 'Cargar'}
            </button>
            {!isReservedByMe && (
              <button onClick={onReserve}
                className="px-3 py-2 bg-blue-900/40 hover:bg-blue-900/60 text-blue-400 text-xs font-medium rounded-xl transition-all border border-blue-800/40">
                Reservar
              </button>
            )}
            {isReservedByMe && (
              <button onClick={onCancelReservation}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-xl transition-all">
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MapToggle({ mapView, onToggle }: { mapView: boolean; onToggle: () => void }) {
  return (
    <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
      <button onClick={() => mapView && onToggle()}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!mapView ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
        Lista
      </button>
      <button onClick={() => !mapView && onToggle()}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mapView ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
        Mapa
      </button>
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
  const [user, setUser] = useState<any>(null)
  const [mapView, setMapView] = useState(true)
  const [currentPricing, setCurrentPricing] = useState<{ price: number; ruleName: string } | null>(null)
  const [myReservations, setMyReservations] = useState<Reservation[]>([])
  const [chargerReservations, setChargerReservations] = useState<Record<string, boolean>>({})
  const [reserveModal, setReserveModal] = useState<Charger | null>(null)
  const [reservingCharger, setReservingCharger] = useState<string | null>(null)

  const fetchReservations = useCallback(async (token: string) => {
    const r = await fetch('/api/reservations', { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    setMyReservations(Array.isArray(d) ? d : [])
    // Build a map of charger_id -> has reservation (by others)
    // We'll fetch per-charger reservations separately for available chargers
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/mobile/login'); return }
      setUser(session.user)
      fetch('/api/wallet/balance', { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json()).then(d => setBalance(d.balance ?? 0)).catch(() => {})
      fetchReservations(session.access_token)
    })
    fetchChargers()
    fetch('/api/pricing').then(r => r.json()).then(d => setCurrentPricing(d)).catch(() => {})
    const iv = setInterval(async () => {
      fetchChargers()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) fetchReservations(session.access_token)
    }, 15000)
    const qrCharger = params.get('charger')
    if (qrCharger) setQrConfirm(qrCharger)
    return () => clearInterval(iv)
  }, [router, params, fetchReservations])

  async function fetchChargers() {
    const { data } = await supabase
      .from('chargers')
      .select('id, name, status, price_per_kwh, latitude, longitude, address')
      .order('name')
    if (data) {
      setChargers(data)
      // Check reservations for available chargers
      const available = data.filter(c => (c.status || '').toLowerCase() === 'available')
      const reservedMap: Record<string, boolean> = {}
      await Promise.all(available.map(async c => {
        const r = await fetch(`/api/reservations?chargerId=${c.id}`)
        const d = await r.json()
        if (d) reservedMap[c.id] = true
      }))
      setChargerReservations(reservedMap)
    }
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
      if (res.status === 402) { setToast({ msg: 'Saldo insuficiente.', type: 'error' }); setTimeout(() => router.push('/wallet'), 1800); return }
      if (!res.ok) { setToast({ msg: ERROR_MAP[data.error] || 'Error al iniciar carga', type: 'error' }); return }
      // Cancel any reservation for this charger
      const myRes = myReservations.find(r => r.charger_id === chargerId)
      if (myRes) {
        await fetch('/api/reservations', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ id: myRes.id }) })
      }
      setReceipt({ chargerName: data.chargerName || chargerId, balance: data.balance ?? 0, sessionId: data.sessionId, startedAt: new Date().toISOString() })
      setBalance(data.balance ?? 0)
      fetchChargers()
      fetchReservations(session.access_token)
    } catch { setToast({ msg: 'Error de conexión.', type: 'error' }) }
    finally { setLoadingCharger(null) }
  }

  async function createReservation(charger: Charger, durationMinutes: number) {
    setReservingCharger(charger.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/mobile/login'); return }
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ chargerId: charger.id, durationMinutes }),
      })
      const d = await res.json()
      if (!res.ok) { setToast({ msg: d.error || 'Error al reservar', type: 'error' }); return }
      setToast({ msg: `Cargador reservado por ${durationMinutes} min`, type: 'success' })
      setReserveModal(null)
      await fetchReservations(session.access_token)
      fetchChargers()
    } catch { setToast({ msg: 'Error de conexión.', type: 'error' }) }
    finally { setReservingCharger(null) }
  }

  async function cancelReservation(reservationId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch('/api/reservations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: reservationId }),
    })
    setToast({ msg: 'Reserva cancelada', type: 'info' })
    fetchReservations(session.access_token)
    fetchChargers()
  }

  const qrCharger = qrConfirm ? chargers.find(c => c.id === qrConfirm) : null
  const available = chargers.filter(c => (c.status || '').toLowerCase() === 'available')
  const unavailable = chargers.filter(c => (c.status || '').toLowerCase() !== 'available')
  const mappableChargers = chargers.filter(c => c.latitude && c.longitude)
    .map(c => ({ id: c.id, name: c.name, status: c.status || 'unknown', location: c.address, lat: c.latitude!, lng: c.longitude! }))

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
      {reserveModal && (
        <ReserveModal charger={reserveModal} loading={reservingCharger === reserveModal.id}
          onConfirm={mins => createReservation(reserveModal, mins)}
          onCancel={() => setReserveModal(null)} />
      )}

      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Cargadores</h1>
          <p className="text-gray-500 text-xs mt-0.5">Actualiza cada 15s · {chargers.length} estaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <MapToggle mapView={mapView} onToggle={() => setMapView(v => !v)} />
          <button onClick={() => router.push('/wallet')}
            className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 px-3 py-2 rounded-xl">
            <span className="text-green-400 text-sm font-bold">{balance !== null ? `$${balance.toFixed(2)}` : '...'}</span>
          </button>
          <button onClick={() => router.push('/mobile/profile')}
            className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </button>
        </div>
      </div>

      <Suspense fallback={null}><PWAInstallBanner /></Suspense>

      {/* Active reservations banner */}
      {myReservations.length > 0 && (
        <div className="px-4 mb-3">
          {myReservations.map(res => (
            <div key={res.id} className="bg-blue-900/20 border border-blue-800/40 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-xs font-semibold">🔖 Reserva activa</p>
                <p className="text-white text-sm font-medium mt-0.5">{res.charger_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <CountdownBadge expiresAt={res.expires_at} />
                <button onClick={() => cancelReservation(res.id)}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map view */}
      {mapView && (
        <div className="mb-0">
          {mappableChargers.length > 0 ? (
            <div className="rounded-none overflow-hidden" style={{height:'calc(100vh - 130px - 64px)',minHeight:320}}>
              <Suspense fallback={<div className="h-72 bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-green-400 border-t-transparent" /></div>}>
                <ChargerMap chargers={mappableChargers} />
              </Suspense>
              <div className="bg-gray-900 px-4 py-2 flex gap-4 text-xs text-gray-500 border-t border-gray-800">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Disponible</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />En uso</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" />Sin conexión</span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
              <p className="text-gray-500 text-sm">Ningún cargador tiene coordenadas configuradas</p>
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {!mapView && (
        <div className="px-4 space-y-6">
          {available.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-2">Disponibles · {available.length}</p>
              <div className="space-y-2">
                {available.map(c => {
                  const myRes = myReservations.find(r => r.charger_id === c.id) || null
                  const otherRes = !myRes && chargerReservations[c.id]
                  return (
                    <ChargerCard key={c.id} charger={c}
                      onStart={() => startCharge(c.id)}
                      onReserve={() => setReserveModal(c)}
                      onCancelReservation={() => myRes && cancelReservation(myRes.id)}
                      loading={loadingCharger === c.id}
                      dynamicPrice={currentPricing}
                      myReservation={myRes}
                      hasOtherReservation={otherRes}
                    />
                  )
                })}
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
                  <ChargerCard key={c.id} charger={c} onStart={() => {}} onReserve={() => {}} onCancelReservation={() => {}} loading={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
