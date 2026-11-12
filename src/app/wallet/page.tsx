'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MobileToast } from '@/components/MobileToast'

const QUICK_AMOUNTS = [5, 10, 20, 50]
const CHARGER_POWER_KW = 7.2 // Assumed charger power in kW (Level 2 AC)
const BANK_INFO = {
  bank: 'Banco Pichincha',
  name: 'Christian Flores',
  account: '2203417047',
  type: 'Transaccional',
  id: '1720026937',
  email: 'crisenri92@gmail.com',
}

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

type PaymentMethod = 'deuna' | 'transfer'
type TransferStep = 'bank-info' | 'form' | 'success'

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

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('deuna')

  // Transfer state
  const [transferStep, setTransferStep] = useState<TransferStep>('bank-info')
  const [transferData, setTransferData] = useState({ amount: '', reference: '', senderName: '' })
  const [transferFile, setTransferFile] = useState<File | null>(null)
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Voucher
  const [voucherCode, setVoucherCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)

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
    const num = parseFloat(transferData.amount)
    if (!transferData.amount || isNaN(num)) errs.amount = 'Ingresa un monto válido'
    else if (num <= 0) errs.amount = 'El monto debe ser mayor a $0'
    else if (num > 10000) errs.amount = 'El monto máximo es $10,000'
    if (!transferData.reference.trim()) errs.reference = 'Ingresa el número de comprobante'
    if (!transferFile) errs.file = 'Adjunta la captura de la transferencia'
    setTransferErrors(errs)
    return Object.keys(errs).length === 0
  }

  const uploadReceipt = async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user?.id}/${Date.now()}.${ext}`
    setUploadProgress(30)
    const { error } = await supabase.storage
      .from('transfer-receipts')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error('Error subiendo comprobante: ' + error.message)
    setUploadProgress(80)
    const { data: urlData } = supabase.storage.from('transfer-receipts').getPublicUrl(path)
    setUploadProgress(100)
    return urlData.publicUrl
  }

  const handleTransferSubmit = async () => {
    if (!validateTransfer()) return
    setTransferLoading(true)
    setUploadProgress(0)
    try {
      const token = await getToken()
      if (!token) { router.push('/mobile/login'); return }
      let receiptUrl: string | undefined
      if (transferFile) receiptUrl = await uploadReceipt(transferFile)
      const res = await fetch('/api/transfer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          amount: parseFloat(transferData.amount),
          reference_number: transferData.reference.trim(),
          sender_name: transferData.senderName.trim() || undefined,
          receipt_url: receiptUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar la solicitud')
      const status = data.transfer_request?.status
      if (status === 'approved') {
        setToast({ msg: 'Transferencia aprobada automáticamente. Â¡Saldo acreditado!', type: 'success' })
        loadData()
      } else if (status === 'rejected') {
        setToast({ msg: 'El comprobante no fue válido. Revisa la imagen y vuelve a intentar.', type: 'error' })
        return
      }
      setTransferStep('success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setToast({ msg, type: 'error' })
    } finally {
      setTransferLoading(false)
      setUploadProgress(0)
    }
  }

  const resetTransfer = () => {
    setTransferData({ amount: '', reference: '', senderName: '' })
    setTransferFile(null)
    setTransferErrors({})
    setTransferStep('bank-info')
    setUploadProgress(0)
  }

  function txIcon(type: string, amount: number) {
    if (type === 'voucher') return '🎁'
    if (type === 'transfer') return '🏦'
    if (type === 'balance_recharge' || type === 'topup' || type === 'recharge' || amount > 0) return '💸'
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

  const customAmt = parseFloat(customAmount)
  const busy = recharging || waitingPayment
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
      if (!res.ok) { setToast({ msg: d.error || 'Código inválido', type: 'error' }); return }
      setToast({ msg: `+$${d.amount.toFixed(2)} agregados a tu wallet 💚`, type: 'success' })
      setVoucherCode('')
      loadData()
    } catch { setToast({ msg: 'Error de conexión', type: 'error' }) }
    finally { setRedeeming(false) }
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a' }}>
      {toast && <MobileToast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Deuna payment modal */}
      {pendingPayment && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
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
                onClick={async () => {
                  const token = await getToken()
                  if (!token || !pendingPayment) return
                  cancelledRef.current = false
                  pollPayment(pendingPayment.paymentId, token)
                }}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-40">
                {waitingPayment ? 'Consultando…' : 'Ya paguá'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance header */}
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
                  {balance > 0 ? formatChargingTime(availableMinutes) : '—'}
                </p>
                <p className="text-gray-600 text-xs">a {CHARGER_POWER_KW} kW</p>
              </div>
              <div className="w-px h-10 bg-gray-700" />
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Energía</p>
                <p className="text-blue-400 font-bold text-lg">
                  {balance > 0 ? availableKwh.toFixed(1) + ' kWh' : '—'}
                </p>
                <p className="text-gray-600 text-xs">${pricePerKwh.toFixed(2)}/kWh</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment method selector */}
      <div className="px-4 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Método de recarga</p>
        <div className="flex gap-2 bg-gray-800/50 p-1 rounded-xl border border-gray-700">
          <button onClick={() => { setPaymentMethod('deuna'); resetTransfer() }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'deuna' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
            <span>💸</span> Deuna
          </button>
          <button onClick={() => { setPaymentMethod('transfer'); resetTransfer() }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'transfer' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
            <span>🏦</span> Transferencia
          </button>
        </div>
      </div>

      {/* Deuna section */}
      {paymentMethod === 'deuna' && (
        <div className="px-4 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recargar saldo</p>
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
                type="number" min="1" max="500" step="0.01"
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
          {customAmount && customAmt >= 1 && (
            <p className="text-gray-500 text-xs mt-2 text-center">
              Con ${customAmt.toFixed(2)} obtienes {formatChargingTime((customAmt / pricePerKwh / CHARGER_POWER_KW) * 60)} de carga
            </p>
          )}
        </div>
      )}

      {/* Transfer section */}
      {paymentMethod === 'transfer' && (
        <div className="px-4 mb-5">
          {transferStep === 'bank-info' && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Datos para la transferencia</p>
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden mb-4">
                <div className="bg-blue-600/20 border-b border-gray-700 px-4 py-3 flex items-center gap-2">
                  <span className="text-blue-400 text-lg">🏦</span>
                  <span className="text-white font-semibold text-sm">{BANK_INFO.bank}</span>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">{BANK_INFO.type}</span>
                </div>
                <div className="divide-y divide-gray-700/50">
                  {[
                    { label: 'Titular', value: BANK_INFO.name },
                    { label: 'NÂº de cuenta', value: BANK_INFO.account },
                    { label: 'Cédula', value: BANK_INFO.id },
                    { label: 'Email', value: BANK_INFO.email },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3">
                      <span className="text-gray-500 text-xs w-24">{label}</span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="text-white text-sm font-mono">{value}</span>
                        <button onClick={() => copyToClipboard(value, label)}
                          className="text-gray-500 hover:text-blue-400 active:scale-90 transition-all p-1 rounded">
                          {copiedField === label
                            ? <span className="text-green-400 text-xs">Copiado</span>
                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-gray-500 text-xs text-center mb-4">
                Realiza la transferencia y luego sube el comprobante para acreditar tu saldo automáticamente
              </p>
              <button onClick={() => setTransferStep('form')}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm">
                Ya transferí, subir comprobante
              </button>
            </div>
          )}

          {transferStep === 'form' && (
            <div>
              <button onClick={() => setTransferStep('bank-info')} className="flex items-center gap-1.5 text-gray-400 hover:text-white mb-4 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Ver datos bancarios
              </button>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Confirmar transferencia</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Monto transferido *</label>
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
                  <label className="text-xs text-gray-400 mb-1 block">NÂº de comprobante / referencia *</label>
                  <input type="text"
                    value={transferData.reference}
                    onChange={e => setTransferData(p => ({ ...p, reference: e.target.value }))}
                    placeholder="Ej: 20241105123456"
                    className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
                  {transferErrors.reference && <p className="text-red-400 text-xs mt-1">{transferErrors.reference}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Nombre del titular (opcional)</label>
                  <input type="text"
                    value={transferData.senderName}
                    onChange={e => setTransferData(p => ({ ...p, senderName: e.target.value }))}
                    placeholder="Tu nombre completo"
                    className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Captura del comprobante *</label>
                  <label className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    transferFile ? 'border-green-500/50 bg-green-500/5' : transferErrors.file ? 'border-red-500/50 bg-red-500/5' : 'border-gray-600 bg-gray-800/50 hover:border-blue-500/50'
                  }`}>
                    <input type="file" accept="image/*" capture="environment" className="sr-only"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) { setTransferFile(f); setTransferErrors(p => ({ ...p, file: '' })) }
                      }} />
                    <div className="py-5 text-center px-4">
                      {transferFile ? (
                        <>
                          <p className="text-green-400 text-sm font-medium">Imagen seleccionada</p>
                          <p className="text-gray-400 text-xs mt-1 truncate max-w-xs">{transferFile.name}</p>
                          <p className="text-gray-500 text-xs mt-1">Toca para cambiar</p>
                        </>
                      ) : (
                        <>
                          <svg className="w-8 h-8 text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-gray-400 text-sm">Toca para subir captura</p>
                          <p className="text-gray-600 text-xs mt-1">JPG, PNG o PDF</p>
                        </>
                      )}
                    </div>
                  </label>
                  {transferErrors.file && <p className="text-red-400 text-xs mt-1">{transferErrors.file}</p>}
                </div>
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Subiendo imagen...</span>
                    <span>{uploadProgress}%</span>
                     </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
              <p className="text-gray-600 text-xs text-center mt-3 mb-3">
                La imagen será verificada automáticamente por IA. El saldo se acreditará en segundos si es válida.
              </p>
              <button onClick={handleTransferSubmit} disabled={transferLoading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2">
                {transferLoading && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {transferLoading ? 'Verificando con IA...' : 'Enviar comprobante'}
              </button>
            </div>
          )}

          {transferStep === 'success' && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-white font-bold text-lg mb-2">Â¡Comprobante enviado!</p>
              <p className="text-gray-400 text-sm mb-6">
                Si fue aprobado automáticamente, tu saldo ya fue actualizado. Si requiere revisión manual, lo procesaremos pronto.
              </p>
              <button onClick={() => { resetTransfer(); loadData() }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium text-sm">
                Ver mi saldo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Voucher */}
      <div className="px-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Canjear código</p>
        <div className="flex gap-2">
          <input type="text" placeholder="Ej: BIENVENIDA"
            value={voucherCode}
            onChange={e => setVoucherCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && redeemVoucher()}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm font-mono tracking-widest transition-all uppercase"
          />
          <button onClick={redeemVoucher} disabled={redeeming || !voucherCode.trim()}
            className="px-5 py-3 bg-purple-700 hover:bg-purple-600 active:scale-95 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all whitespace-nowrap">
            {redeeming ? '...' : 'Canjear'}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="px-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Movimientos recientes</p>
        {loading
          ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />)}</div>
          : transactions.length === 0
          ? (
            <div className="bg-gray-900 rounded-xl p-8 text-center">
              <p className="text-3xl mb-2">💸</p>
              <p className="text-gray-500 text-sm">Sin movimientos aún</p>
            </div>
          )
          : (
            <div className="bg-gray-900 rounded-2xl overflow-hidden divide-y divide-gray-800">
              {transactions.slice(0, 20).map((t: Transaction) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl w-8 text-center flex-shrink-0">{txIcon(t.type, t.amount)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{t.description || (t.amount > 0 ? 'Recarga' : 'Carga eléctrica')}</p>
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
