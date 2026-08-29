'use client'
import { MobileToast } from '@/components/MobileToast'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const QUICK_AMOUNTS = [5, 10, 20, 50]

function WalletContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [recharging, setRecharging] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (searchParams.get('recharge') === 'success') {
      setShowBanner(true)
      setTimeout(() => setShowBanner(false), 6000)
    }
  }, [searchParams])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    if (!token) { router.push('/mobile/login'); return }

    const headers: Record<string, string> = { Authorization: 'Bearer ' + token }
    const [balRes, histRes] = await Promise.all([
      fetch('/api/wallet/balance', { headers }),
      fetch('/api/wallet/history', { headers }),
    ])
    const { balance } = await balRes.json()
    const { transactions } = await histRes.json()
    setBalance(balance)
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

      const res = await fetch('/api/payment/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ amount }),
      })
      const { checkoutUrl, error } = await res.json()
      if (error) { setToast({ msg: error, type: 'error' }); return }
      window.location.href = checkoutUrl
    } catch { alert('Error al procesar la recarga') } finally { setRecharging(false) }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <>{toast && <MobileToast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 pb-20 md:pb-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Mi Billetera</h1>
          <button onClick={() => router.push('/mobile')} className="text-sm text-green-400 border border-green-700 px-3 py-1 rounded-lg">
            ← Cargadores
          </button>
        </div>

        {showBanner && (
          <div className="mb-6 bg-green-900 border border-green-500 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <span className="font-medium">¡Saldo recargado exitosamente!</span>
          </div>
        )}

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-6 text-center">
          <p className="text-gray-400 text-sm mb-2 uppercase tracking-widest">Saldo disponible</p>
          {loading
            ? <div className="h-16 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-green-400 border-t-transparent" /></div>
            : <p className="text-6xl font-bold text-green-400">${(balance ?? 0).toFixed(2)}</p>}
          <p className="text-gray-500 text-xs mt-2">USD</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Recargar saldo</h2>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {QUICK_AMOUNTS.map(amt => (
              <button key={amt} onClick={() => handleRecharge(amt)} disabled={recharging}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg transition-colors">
                ${amt}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="number" min="1" placeholder="Otro monto ($)" value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-green-500" />
            <button onClick={() => handleRecharge(parseFloat(customAmount))}
              disabled={recharging || !customAmount || parseFloat(customAmount) < 1}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors">
              {recharging ? '...' : 'Recargar'}
            </button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Movimientos recientes</h2>
          {transactions.length === 0
            ? <p className="text-gray-500 text-center py-6">Sin movimientos aún</p>
            : (
              <div className="space-y-3">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{tx.description || tx.type}</p>
                      <p className="text-xs text-gray-400">{fmt(tx.created_at)}</p>
                    </div>
                    <span className={`font-bold text-lg ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Cargando...</div>}>
      <WalletContent />
    </Suspense>
  )
}