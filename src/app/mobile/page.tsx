'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function MobilePage() {
  const [chargers, setChargers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCharger, setLoadingCharger] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkSession()
    fetchChargers()
    const iv = setInterval(fetchChargers, 15000)
    return () => clearInterval(iv)
  }, [])

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/mobile/login')
  }

  async function fetchChargers() {
    const { data } = await supabase.from('chargers').select('*').order('name')
    if (data) setChargers(data)
    setLoading(false)
  }

  async function startCharge(chargerId) {
    setLoadingCharger(chargerId)
    setSuccessMsg('')
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
      if (res.status === 402) {
        router.push('/wallet')
        return
      }
      if (!res.ok) {
        alert('Error: ' + (data.error || 'desconocido'))
        return
      }
      setSuccessMsg(`✅ Carga iniciada en ${data.chargerName || chargerId}. Saldo restante: $${data.balance?.toFixed(2)}`)
      fetchChargers()
    } catch { alert('Error de conexion') }
    finally { setLoadingCharger(null) }
  }

  const available = chargers.filter(c => c.status === 'available')
  const unavailable = chargers.filter(c => c.status !== 'available')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#111827' }}>
      <p className="text-gray-400">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen text-white pb-20 px-4 pt-6" style={{ background: '#111827' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">⚡ Cargadores EV</h1>
        <button onClick={() => router.push('/wallet')}
          className="text-sm text-green-400 border border-green-700 px-3 py-1 rounded-lg">
          Mi Wallet
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 bg-green-900 border border-green-500 rounded-xl p-3 text-sm text-green-300">
          {successMsg}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-green-400 uppercase mb-3">Disponibles ({available.length})</h2>
        {available.length === 0
          ? <p className="text-gray-500 text-sm">No hay cargadores disponibles</p>
          : (
            <div className="space-y-3">
              {available.map(c => (
                <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-sm text-gray-400">{c.location}</p>
                    </div>
                    <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded-full">Disponible</span>
                  </div>
                  <button onClick={() => startCharge(c.id)} disabled={!!loadingCharger}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                    style={{ minHeight: '52px' }}>
                    {loadingCharger === c.id ? 'Iniciando...' : '⚡ Iniciar Carga'}
                  </button>
                </div>
              ))}
            </div>
          )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">No disponibles ({unavailable.length})</h2>
        <div className="space-y-3">
          {unavailable.map(c => (
            <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 opacity-60">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-gray-400">{c.location}</p>
                </div>
                <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded-full capitalize">{c.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
