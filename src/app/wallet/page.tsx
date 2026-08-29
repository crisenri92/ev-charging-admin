'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { MobileToast } from '@/components/MobileToast'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const QUICK_AMOUNTS = [5, 10, 20, 50]

interface Transaction {
  id: string
  amount: number
  type: string
  description: string
  balance_after: number
  created_at: string
}

function WalletContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [recharging, setRecharging] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'error'|'success'|'info' } | null>(null)

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

  useEffect(() => { loadData() }, [loadData])

  const handleRecharge = async (amount: number) => {
    if (recharging || amount < 1) return
    setRecharging(true)
    try {
      const token = await getToken()
      if (!token) { router.push('/mobile/login'); return }
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ amount }),
      })
      const { checkoutUrl, error } = await res.json()
      if (error) { setToast({ msg: error, type: 'error' }); return }
      window.location.href = checkoutUrl
    } catch {
      setToast({ msg: 'Error de conexión. Intenta de nuevo.', type: 'error' })
    } finally {
      setRecharging(false)
    }
  }

  function txIcon(type: string, amount: number) {
    if (type === 'topup' || amount > 0) return '💳'
    if (type === 'charge') return '⚡'
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

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a' }}>
      {toast && <MobileToast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Balance Card */}
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
          <p className="text-gray-500 text-xs mt-3">≈ {loading ? '—' : ((balance ?? 0) / 0.15).toFixed(0)} kWh de carga</p>
        </div>
      </div>

      {/* Recharge section */}
      <div className="px-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recargar saldo</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {QUICK_AMOUNTS.map(amt => (
            <button key={amt} onClick={() => handleRecharge(amt)} disabled={recharging}
              className="bg-gray-800 hover:bg-gray-700 active:scale-95 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-all border border-gray-700 hover:border-green-600">
              ${amt}
            </button>
          ))}
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
            disabled={recharging || !customAmount || customAmt < 1}
            className="px-5 py-3 bg-green-600 hover:bg-green-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all whitespace-nowrap">
            {recharging ? '...' : 'Recargar'}
          </button>
        </div>
      </div>

      {/* Transaction history */}
      <div className="px-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Movimientos recientes</p>
        {loading
          ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />)}</div>
          : transactions.length === 0
          ? (
            <div className="bg-gray-900 rounded-xl p-8 text-center">
              <p className="text-3xl mb-2">💳</p>
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
