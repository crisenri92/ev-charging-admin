'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MobileToast } from '@/components/MobileToast'

const QUICK_AMOUNTS = [5, 10, 20, 50]

const BANK_INFO = [
  { label: 'Banco', value: 'Banco XYZ' },
  { label: 'Titular', value: 'RecargaT S.A.' },
  { label: 'N° de cuenta', value: '1234567890' },
  { label: 'Tipo', value: 'Corriente' },
  { label: 'RUC', value: '0992345678001' },
  { label: 'Email', value: 'pagos@recargat.app' },
]

interface MinutePackage {
  id: string
  name: string
  minutes: number
  price_usd: number
  description?: string
}

interface Transaction {
  id: string
  amount: number
  type: string
  description: string
  balance_after: number
  minutes_amount?: number
  minutes_after?: number
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

type PaymentMethod = 'deuna' | 'transfer'
type TransferStep = 'bank-info' | 'form' | 'success'

const DEFAULT_PACKAGES: MinutePackage[] = [
  { id: 'default-30',  name: 'Pack 30 min',  minutes: 30,  price_usd: 3.00  },
  { id: 'default-60',  name: 'Pack 60 min',  minutes: 60,  price_usd: 5.50  },
  { id: 'default-120', name: 'Pack 120 min', minutes: 120, price_usd: 10.00 },
  { id: 'default-240', name: 'Pack 240 min', minutes: 240, price_usd: 18.00 },
]

function WalletContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
  const [minutesBalance, setMinutesBalance] = useState<number | null>(null)
  const [packages, setPackages] = useState<MinutePackage[]>(DEFAULT_PACKAGES)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [recharging, setRecharging] = useState(false)
  const [waitingPayment, setWaitingPayment] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'error'|'success'|'info' } | null>(null)
  const cancelledRef = useRef(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('deuna')
  const [transferStep, setTransferStep] = useState<TransferStep>('bank-info')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferRef, setTransferRef] = useState('')
  const [transferReceiptUrl, setTransferReceiptUrl] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('recharge') === 'success') {
      setToast({ msg: '✅ Recarga exitosa. Tu saldo fue actualizado.', type: 'success' })
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
    const [balRes, histRes, pkgRes] = await Promise.all([
      fetch('/api/wallet/balance', { headers }),
      fetch('/api/wallet/history', { headers }),
      fetch('/api/wallet/packages'),
    ])
    const balData = await balRes.json()
    const { transactions } = await histRes.json()
    setBalance(balData.balance ?? 0)
    setMinutesBalance(balData.minutes_balance ?? 0)
    setTransactions(transactions || [])
    if (pkgRes.ok) {
      const pkgData = await pkgRes.json()
      if (pkgData.packages?.length) setPackages(pkgData.packages)
    }
    setLoading(false)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

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
        setToast({ msg: '✅ Recarga confirmada. Tu saldo fue actualizado.', type: 'success' })
        loadData()
        return
      }
      if (pollData.status === 'failed' || pollData.status === 'expired') {
        setToast({ msg: 'El pago expiró o falló. Intenta de nuevo.', type: 'error' })
        return
      }
      setToast({ msg: 'Aún no se confirma el pago. Puedes seguir esperando.', type: 'info' })
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
        body: JSON.stringify({ provider: 'deuna', context: 'wallet_recharge', amount }),
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
      setToast({ msg: 'Error de conexión. Intenta de nuevo.', type: 'error' })
    } finally {
      setRecharging(false)
    }
  }

  const closePaymentModal = () => {
    cancelledRef.current = true
    setPendingPayment(null)
    setWaitingPayment(false)
  }

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(label)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      setToast({ msg: 'No se pudo copiar', type: 'error' })
    }
  }

  const validateTransfer = (): boolean => {
    const errs: Record<string, string> = {}
    const num = parseFloat(transferAmount)
    if (!transferAmount || isNaN(num)) errs.amount = 'Ingresa un monto válido'
    else if (num <= 0) errs.amount = 'El monto debe ser mayor a $0'
    else if (num > 10000) errs.amount = 'El monto máximo es $10,000'
    if (!transferRef.trim()) errs.ref = 'Ingresa el número de referencia'
    setTransferErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleTransferSubmit = async () => {
    if (!validateTransfer()) return
    setTransferLoading(true)
    try {
      const token = await getToken()
      if (!token) { router.push('/mobile/login'); return }
      const body: Record<string, unknown> = {
        amount: parseFloat(transferAmount),
        reference_number: transferRef.trim(),
      }
      if (transferReceiptUrl.trim()) body.receipt_url = transferReceiptUrl.trim()
      const res = await fetch('/api/transfer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar la solicitud')
      setTransferStep('success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setToast({ msg, type: 'error' })
    } finally {
      setTransferLoading(false)
    }
  }

  const resetTransfer = () => {
    setTransferAmount('')
    setTransferRef('')
    setTransferReceiptUrl('')
    setTransferErrors({})
    setTransferStep('bank-info')
  }

  function txIcon(type: string, amount: number) {
    if (type === 'voucher') return '🎁'
    if (type === 'transfer') return '🏦'
    if (type === 'balance_recharge' || type === 'topup' || type === 'recharge' || amount > 0) return '💳'
    if (type === 'charge' || type === 'charge_deduction') return '⚡'
    return '💸'
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
      if (!res.ok) { setToast({ msg: d.error || 'Código inválido', type: 'error' }); return }
      setToast({ msg: `+${d.amount.toFixed(2)} agregados a tu wallet 🎉`, type: 'success' })
      setVoucherCode('')
      loadData()
    } catch { setToast({ msg: 'Error de conexión', type: 'error' }) }
    finally { setRedeeming(false) }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0f172a', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
      {toast && <MobileToast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {pendingPayment && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="bg-gray-900 w-full max-w-md rounded-2xl p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold">Paga ${pendingPayment.amount.toFixed(2)}</h2>
              <button onClick={closePaymentModal} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            {pendingPayment.qrCode && (
              <div className="bg-white rounded-xl p-3 flex justify-center mb-4">
                <img src={pendingPayment.qrCode} alt="QR de pago Deuna" className="w-56 h-56 object-contain" />
              </div>
            )}
            {pendingPayment.deeplink && (
              <a href={pendingPayment.deeplink} target="_blank" rel="noreferrer"
                className="block text-center bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl mb-3">
                Abrir en Deuna
              </a>
            )}
            {pendingPayment.numericCode && (
              <p className="text-center text-gray-300 text-sm mb-3">
                Código: <span className="font-mono text-white text-lg">{pendingPayment.numericCode}</span>
              </p>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-4">
              {waitingPayment && <div className="h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />}
              {waitingPayment ? 'Esperando confirmación de pago…' : 'Si ya pagaste, vuelve a consultar'}
            </div>
            <div className="flex gap-2">
              <button onClick={closePaymentModal} className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300">Cancelar</button>
              <button disabled={waitingPayment}
                onClick={async () => { const token = await getToken(); if (!token || !pendingPayment) return; cancelledRef.current = false; pollPayment(pendingPayment.paymentId, token) }}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-40">
                {waitingPayment ? 'Consultando…' : 'Ya pagué'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Header — minutes primary */}
      <div className="relative overflow-hidden px-4 pt-6 pb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700/40 via-blue-800/20 to-transparent" />
        <div className="relative">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-gray-400 hover:text-white mb-4 active:opacity-70 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Volver</span>
          </button>
          <div className="text-center">
            <p className="text-blue-400/80 text-sm font-medium uppercase tracking-widest mb-2">Minutos disponibles</p>
            {loading
              ? <div className="h-14 w-32 bg-gray-700/50 rounded-xl animate-pulse mx-auto" />
              : <p className="text-6xl font-bold text-white tracking-tight">
                  {minutesBalance ?? 0}
                  <span className="text-2xl text-blue-400 ml-2">min</span>
                </p>
            }
            <p className="text-gray-500 text-xs mt-3">
              Saldo: {loading ? '—' : <span className="text-green-400">${(balance ?? 0).toFixed(2)}</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Método de recarga</p>
        <div className="flex gap-2 bg-gray-800/50 p-1 rounded-xl border border-gray-700">
          <button onClick={() => { setPaymentMethod('deuna'); resetTransfer() }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'deuna' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
            <span>💳</span> Deuna
          </button>
          <button onClick={() => { setPaymentMethod('transfer'); resetTransfer() }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'transfer' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
            <span>🏦</span> Transferencia
          </button>
        </div>
      </div>
      {/* Deuna payment method */}
      {paymentMethod === 'deuna' && (
        <div className="px-4 mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Elige un paquete</p>
          {loading
            ? <div className="grid grid-cols-2 gap-3">
                {[0,1,2,3].map(i => <div key={i} className="h-24 bg-gray-800/50 rounded-xl animate-pulse" />)}
              </div>
            : <div className="grid grid-cols-2 gap-3">
                {packages.map(pkg => (
                  <button key={pkg.id}
                    onClick={() => handleRecharge(pkg.price_usd)}
                    className="bg-gray-800/60 hover:bg-gray-700/60 active:scale-95 border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 text-left transition-all">
                    <p className="text-2xl font-bold text-white">{pkg.minutes}<span className="text-blue-400 text-base ml-1">min</span></p>
                    <p className="text-green-400 font-semibold text-sm mt-1">${pkg.price_usd.toFixed(2)}</p>
                    {pkg.description && <p className="text-gray-500 text-xs mt-1 truncate">{pkg.description}</p>}
                  </button>
                ))}
              </div>
          }
          <div className="mt-4">
            <label className="block text-xs text-gray-400 font-medium mb-2">O ingresa monto personalizado</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number" inputMode="decimal" min="1" step="0.01"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <button
                onClick={() => handleRecharge(parseFloat(customAmount) || 0)}
                disabled={!customAmount || parseFloat(customAmount) <= 0}
                className="px-5 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl active:scale-95 transition-all text-sm">
                Recargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer payment method */}
      {paymentMethod === 'transfer' && (
        <div className="px-4 mb-5">
          {transferStep === 'info' && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Datos bancarios</p>
              <div className="space-y-3">
                {BANK_INFO.map((bank, idx) => (
                  <div key={idx} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold text-sm">{bank.bank}</span>
                      <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">{bank.type}</span>
                    </div>
                    <div className="space-y-1.5">
                      {[['Titular', bank.name], ['Cuenta', bank.account], ['Cédula', bank.id], ['Email', bank.email]].map(([label, val]) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-gray-500 text-xs">{label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-200 text-xs font-mono">{val}</span>
                            <button onClick={() => copyToClipboard(val, label)} className="text-gray-500 hover:text-blue-400 active:scale-90 transition-all text-xs">📋</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setTransferStep('form')}
                className="mt-4 w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm">
                Ya transferí →
              </button>
            </div>
          )}
          {transferStep === 'form' && (
            <div>
              <button onClick={() => setTransferStep('info')} className="flex items-center gap-1.5 text-gray-400 hover:text-white mb-4 text-sm">
                ← Volver a datos bancarios
              </button>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Confirmar transferencia</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Monto transferido</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" inputMode="decimal" min="1" step="0.01"
                      value={transferData.amount}
                      onChange={e => setTransferData(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
                  </div>
                  {transferErrors.amount && <p className="text-red-400 text-xs mt-1">{transferErrors.amount}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">N.° de comprobante</label>
                  <input type="text"
                    value={transferData.reference}
                    onChange={e => setTransferData(p => ({ ...p, reference: e.target.value }))}
                    placeholder="Ej: 20241105123456"
                    className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
                  {transferErrors.reference && <p className="text-red-400 text-xs mt-1">{transferErrors.reference}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Nombre del titular</label>
                  <input type="text"
                    value={transferData.senderName}
                    onChange={e => setTransferData(p => ({ ...p, senderName: e.target.value }))}
                    placeholder="Nombre completo"
                    className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
                  {transferErrors.senderName && <p className="text-red-400 text-xs mt-1">{transferErrors.senderName}</p>}
                </div>
              </div>
              <button
                onClick={handleTransferSubmit}
                disabled={transferLoading}
                className="mt-4 w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2">
                {transferLoading && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {transferLoading ? 'Enviando…' : 'Enviar comprobante'}
              </button>
            </div>
          )}
          {transferStep === 'success' && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-white font-bold text-lg mb-2">¡Comprobante enviado!</p>
              <p className="text-gray-400 text-sm mb-6">Revisaremos tu transferencia y acreditaremos tu saldo en breve.</p>
              <button onClick={resetTransfer} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium text-sm">
                Enviar otra
              </button>
            </div>
          )}
        </div>
      )}
      {/* Voucher section */}
      <div className="px-4 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Canjear voucher</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={voucherCode}
            onChange={e => setVoucherCode(e.target.value.toUpperCase())}
            placeholder="Código de voucher"
            className="flex-1 px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm font-mono uppercase"
          />
          <button
            onClick={redeemVoucher}
            disabled={!voucherCode || redeeming}
            className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold rounded-xl active:scale-95 transition-all text-sm">
            {redeeming ? '…' : 'Canjear'}
          </button>
        </div>
      </div>

      {/* Transaction history */}
      <div className="px-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Historial</p>
        {loading
          ? <div className="space-y-3">
              {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />)}
            </div>
          : transactions.length === 0
            ? <div className="text-center py-10 text-gray-600">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm">Sin transacciones aún</p>
              </div>
            : <div className="space-y-2">
                {transactions.map(t => (
                  <div key={t.id} className="bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 rounded-xl p-3.5 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5 flex-shrink-0">{txIcon(t.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white text-sm font-medium truncate">{t.description || t.type}</p>
                          <span className={`text-sm font-semibold flex-shrink-0 ${t.type === 'recharge' || t.type === 'transfer' ? 'text-green-400' : 'text-red-400'}`}>
                            {t.type === 'recharge' || t.type === 'transfer' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-gray-500 text-xs">{formatDate(t.created_at)}</p>
                          {t.minutes_amount ? (
                            <span className={`text-xs ${t.type === 'recharge' || t.type === 'transfer' ? 'text-blue-400' : 'text-orange-400'}`}>
                              {t.type === 'recharge' || t.type === 'transfer' ? '+' : '-'}{Math.abs(t.minutes_amount)} min
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
        }
      </div>
    </div>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <WalletContent />
    </Suspense>
  )
}
