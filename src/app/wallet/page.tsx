'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MobileToast } from '@/components/MobileToast'

const QUICK_AMOUNTS = [5, 10, 20, 50]
const CHARGER_POWER_KW = 7.2 // Assumed charger power in kW (Level 2 AC)

interface Transaction {
  id: string
  amount: number
  type: string
  description: string
  balance_after: number
  created_at: string
}

interface PendingPayment {
  id: string
  paymentId: string
  amount: number
  qrCode?: string
  deeplink?: string
  numericCode?: string
  expiresAt?: string
}

function formatChargingTime(minutes: number): string {
  if (minutes < 60) return `~${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`
}

function WalletContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [recharging, setRecharging] = useState(false)
  const [waitingPayment, setWaitingPayment] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'error'|'success'|'info' } | null>(null)
  const [pricePerKwh, setPricePerKwh] = useState<number>(0.15)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (searchParams.get('recharge') === 'success') {
      setToast({ msg: 'â Recarga exitosa. Tu saldo fue actualizado.', type: 'success' })
    }
  }, [searchParams])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const loadData = useCallback(async () => {
    const token = await getToken()
    if (!token) { router.push('/mobile/login'); return }
    const headers: Record<string, string> = { Authorization: 'Bearer ' + token }
    const [balRes, histRes] = await Promise.all([
      fetch('/api/wallet/balance', { headers }),
      fetch('/api/wallet/history', { headers }),
    ])
    const { balance } = await balRes.json()
    const { transactions } = await histRes.json()
    setBalance(balance ?? 0)
    setTransactions(transactions || [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    loadData()
    // Fetch current price
    fetch('/api/pricing').then(r => r.json()).then(d => {
      if (d && d.price) setPricePerKwh(d.price)
    }).catch(() => {})
  }, [loadData])

  const pollPayment = async (paymentId: string, token: string) => {
    setWaitingPayment(true)
    try {
      const pollRes = await fetch('/api/payments/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ paymentId }),
      })
      const pollData = await pollRes.json()
      if (cancelledRef.current) return

      if (pollData.status === 'approved') {
        setPendingPayment(null)
        setToast({ msg: 'â Recarga confirmada. Tu saldo fue actualizado.', type: 'success' })
        loadData()
        return
      }

      if (pollData.status === 'failed' || pollData.status === 'expired') {
        setToast({ msg: 'El pago expirÃ³ o fallÃ³. Intenta de nuevo.', type: 'error' })
        return
      }

      setToast({ msg: 'AÃºn no se confirma el pago. Puedes seguir esperando.', type: 'info' })
    } catch {
      if (!cancelledRef.current) {
        setToast({ msg: 'No se pudo consultar el pago. Intenta de nuevo.', type: 'error' })
      }
    } finally {
      setWaitingPayment(false)
    }
  }

  const handleRecharge = async (amount: number) => {
    if (recharging || waitingPayment || amount < 1) return
    cancelledRef.current = false
    setRecharging(true)
    try {
      const token = await getToken()
      if (!token) { router.push('/mobile/login'); return }
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          provider: 'deuna',
          context: 'wallet_recharge',
          amount,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setToast({ msg: data.error || 'No se pudo crear el pago', type: 'error' })
        return
      }

      const payment = data.payment as PendingPayment
      setPendingPayment(payment)
      pollPayment(payment.paymentId, token)
    } catch {
      setToast({ msg: 'Error de conexiÃ³n. Intenta de nuevo.', type: 'error' })
    } finally {
      setRecharging(false)
    }
  }

  const closePaymentModal = () => {
    cancelledRef.current = true
    setPendingPayment(null)
    setWaitingPayment(false)
  }

  function txIcon(type: string, amount: number) {
    if (type === 'voucher') return 'ð'
    if (type === 'balance_recharge' || type === 'topup' || type === 'recharge' || amount > 0) return 'ð³'
    if (type === 'charge' || type === 'charge_deduction') return 'â¡'
    return 'ð¸'
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
  }

  const [voucherCode, setVoucherCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const customAmt = parseFloat(customAmount)
  const busy = recharging || waitingPayment

  // Balance â charging time calculation
  const availableKwh = (balance ?? 0) / pricePerKwh
  const availableMinutes = (availableKwh / CHARGER_POWER_KW) * 60

  async function redeemVoucher() {
    if (!voucherCode.trim() || redeeming) return
    setRedeeming(true)
    try {
      const token = await getToken()
      if (!token) { router.push('/mobile/login'); return }
      const res = await fetch('/api/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ code: voucherCode }),
      })
      const d = await res.json()
      if (!res.ok) { setToast({ msg: d.error || 'CÃ³digo invÃ¡lido', type: 'error' }); return }
      setToast({ msg: `+$${d.amount.toFixed(2)} agregados a tu wallet ð`, type: 'success' })
      setVoucherCode('')
      loadData()
    } catch { setToast({ msg: 'Error de conexiÃ³n', type: 'error' }) }
    finally { setRedeeming(false) }
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a' }}>
      {toast && <MobileToast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {pendingPayment && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-md rounded-2xl p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold">Paga ${pendingPayment.amount.toFixed(2)}</h2>
              <button onClick={closePaymentModal} className="text-gray-400 hover:text-white text-xl">â</button>
            </div>

            {pendingPayment.qrCode && (
              <div className="bg-white rounded-xl p-3 flex justify-center mb-4">
                <img
                  src={pendingPayment.qrCode}
                  alt="QR de pago Deuna"
                  className="w-56 h-56 object-contain"
                />
              </div>
            )}

            {pendingPayment.deeplink && (
              <a
                href={pendingPayment.deeplink}
                target="_blank"
                rel="noreferrer"
                className="block text-center bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl mb-3"
              >
                Abrir en Deuna
              </a>
            )}

            {pendingPayment.numericCode && (
              <p className="text-center text-gray-300 text-sm mb-3">
                CÃ³digo: <span className="font-mono text-white text-lg">{pendingPayment.numericCode}</span>
              </p>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-4">
              {waitingPayment && (
                <div className="h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              )}
              {waitingPayment
                ? 'Esperando confirmaciÃ³n de pagoâ¦'
                : 'Si ya pagaste, vuelve a consultar'}
            </div>

            <div className="flex gap-2">
              <button
                onClick={closePaymentModal}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300"
              >
                Cancelar
              </button>
              <button
                disabled={waitingPayment}
                onClick={async () => {
                  const token = await getToken()
                  if (!token || !pendingPayment) return
                  cancelledRef.current = false
                  pollPayment(pendingPayment.paymentId, token)
                }}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-40"
              >
                {waitingPayment ? 'Consultandoâ¦' : 'Ya paguÃ©'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden px-4 pt-10 pb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-green-700/40 via-green-800/20 to-transparent" />
        <div className="relative text-center">
          <p className="text-green-400/80 text-sm font-medium uppercase tracking-widest mb-2">Saldo disponible</p>
          {loading
            ? <div className="h-14 w-32 bg-gray-700/50 rounded-xl animate-pulse mx-auto" />
            : <p className="text-6xl font-bold text-white tracking-tight">
                <span className="text-3xl text-green-400 align-top mt-2 inline-block mr-1">$</span>
                {balance?.toFixed(2)}
              </p>
          }
          {/* Balance to charging time conversion */}
          {!loading && balance !== null && (
            <div className="mt-4 inline-flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-2xl px-5 py-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Tiempo de carga</p>
                <p className="text-green-400 font-bold text-lg">
                  {balance > 0 ? formatChargingTime(availableMinutes) : 'â'}
                </p>
                <p className="text-gray-600 text-xs">a {CHARGER_POWER_KW} kW</p>
              </div>
              <div className="w-px h-10 bg-gray-700" />
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">EnergÃ­a</p>
                <p className="text-blue-400 font-bold text-lg">
                  {balance > 0 ? availableKwh.toFixed(1) + ' kWh' : 'â'}
                </p>
                <p className="text-gray-600 text-xs">${pricePerKwh.toFixed(2)}/kWh</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recargar saldo</p>
        {/* Quick amount buttons with time preview */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {QUICK_AMOUNTS.map(amt => {
            const mins = (amt / pricePerKwh / CHARGER_POWER_KW) * 60
            return (
              <button key={amt} onClick={() => handleRecharge(amt)} disabled={busy}
                className="bg-gray-800 hover:bg-gray-700 active:scale-95 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-all border border-gray-700 hover:border-green-600 flex flex-col items-center gap-0.5">
                <span>${amt}</span>
                <span className="text-gray-500 text-xs font-normal">{formatChargingTime(mins)}</span>
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">$</span>
            <input
              type="number"
              min="1"
              max="500"
              step="0.01"
              placeholder="Otro monto"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm transition-all"
              inputMode="decimal"
            />
          </div>
          <button
            onClick={() => handleRecharge(customAmt)}
            disabled={busy || !customAmount || customAmt < 1}
            className="px-5 py-3 bg-green-600 hover:bg-green-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all whitespace-nowrap">
            {recharging ? '...' : 'Recargar'}
          </button>
        </div>
        {/* Estimated time for custom amount */}
        {customAmount && customAmt >= 1 && (
          <p className="text-gray-500 text-xs mt-2 text-center">
            Con ${customAmt.toFixed(2)} obtienes {formatChargingTime((customAmt / pricePerKwh / CHARGER_POWER_KW) * 60)} de carga
          </p>
        )}
      </div>

      <div className="px-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Canjear cÃ³digo</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ej: BIENVENIDA"
            value={voucherCode}
            onChange={e => setVoucherCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && redeemVoucher()}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm font-mono tracking-widest transition-all uppercase"
          />
          <button
            onClick={redeemVoucher}
            disabled={redeeming || !voucherCode.trim()}
            className="px-5 py-3 bg-purple-700 hover:bg-purple-600 active:scale-95 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all whitespace-nowrap">
            {redeeming ? '...' : 'Canjear'}
          </button>
        </div>
      </div>

      <div className="px-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Movimientos recientes</p>
        {loading
          ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />)}</div>
          : transactions.length === 0
          ? (
            <div className="bg-gray-900 rounded-xl p-8 text-center">
              <p className="text-3xl mb-2">ð³</p>
              <p className="text-gray-500 text-sm">Sin movimientos aÃºn</p>
            </div>
          )
          : (
            <div className="bg-gray-900 rounded-2xl overflow-hidden divide-y divide-gray-800">
              {transactions.slice(0, 20).map((t: Transaction) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl w-8 text-center flex-shrink-0">{txIcon(t.type, t.amount)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{t.description || (t.amount > 0 ? 'Recarga' : 'Carga elÃ©ctrica')}</p>
                    <p className="text-gray-500 text-xs">{formatDate(t.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
                    </p>
                    <p className="text-gray-600 text-xs">${t.balance_after?.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}><div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent" /></div>}>
      <WalletContent />
    </Suspense>
  )
}
