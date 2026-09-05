'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { BottomNav } from '../components/BottomNav'



export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [stats, setStats] = useState<{sessions: number; kwh: number; cost: number} | null>(null)
  const { permission, subscribed, subscribe } = usePushNotifications()
  const [subscribing, setSubscribing] = useState(false)
  const [subResult, setSubResult] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/mobile/login'); return }
      setUser(session.user)
      setLoading(false)
      // Fetch charging stats
      supabase.from('charging_sessions').select('energy_kwh, cost').eq('user_id', session.user.id).eq('status', 'completed').then(({ data }) => {
        if (data) setStats({
          sessions: data.length,
          kwh: data.reduce((s, r) => s + (r.energy_kwh || 0), 0),
          cost: data.reduce((s, r) => s + (r.cost || 0), 0)
        })
      })
    })
  }, [router])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/mobile/login')
  }

  async function handleSubscribe() {
    setSubscribing(true)
    const ok = await subscribe()
    setSubResult(ok ? '✅ Notificaciones activadas' : '❌ No se pudo activar. Verifica los permisos del navegador.')
    setSubscribing(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent" />
    </div>
  )

  const initials = (user?.user_metadata?.full_name || user?.email || '?').slice(0, 2).toUpperCase()
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }) : ''

  return (
    <div className="min-h-screen text-white px-4 pt-6" style={{ background: '#0f172a', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
      <h1 className="text-xl font-bold mb-6">Mi Cuenta</h1>

      {/* Avatar */}
      <div className="flex items-center gap-4 bg-gray-900 rounded-2xl p-5 mb-4">
        <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center text-xl font-bold">
          {initials}
        </div>
        <div>
          <p className="text-white font-semibold">{user?.user_metadata?.full_name || 'Usuario'}</p>
          <p className="text-gray-400 text-sm">{user?.email}</p>
          <p className="text-gray-600 text-xs mt-0.5">Miembro desde {memberSince}</p>
        </div>
      </div>

      
      {/* Stats */}
      {stats && stats.sessions > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.sessions}</p>
            <p className="text-gray-500 text-xs mt-0.5">Sesiones</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-green-400">{stats.kwh.toFixed(1)}</p>
            <p className="text-gray-500 text-xs mt-0.5">kWh</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-white">{(stats.kwh * 0.233).toFixed(1)}</p>
            <p className="text-gray-500 text-xs mt-0.5">kg CO₂ 🌱</p>
          </div>
        </div>
      )}

{/* Push notifications */}
      <div className="bg-gray-900 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm">Notificaciones push</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {permission === 'granted' ? 'Activadas' : permission === 'denied' ? 'Bloqueadas en el navegador' : 'Recibe alertas de carga completada'}
            </p>
          </div>
          {permission !== 'granted' && permission !== 'denied' && (
            <button onClick={handleSubscribe} disabled={subscribing}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg">
              {subscribing ? '...' : 'Activar'}
            </button>
          )}
          {permission === 'granted' && <span className="text-green-400 text-xs">✓ Activo</span>}
          {permission === 'denied' && <span className="text-red-400 text-xs">Bloqueado</span>}
        </div>
        {subResult && <p className="text-xs mt-2 text-gray-400">{subResult}</p>}
      </div>

      {/* Quick links */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden mb-4">
        {[
          { label: '⚡ Mis cargas', href: '/mobile/historial' },
          { label: '💳 Mi Wallet', href: '/wallet' },
          { label: '🔑 Cambiar contraseña', href: '/mobile/forgot-password' },
        ].map(link => (
          <button key={link.href} onClick={() => router.push(link.href)}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-800 last:border-0 hover:bg-gray-800 text-left">
            <span className="text-white text-sm">{link.label}</span>
            <span className="text-gray-600">›</span>
          </button>
        ))}
      </div>

      <button onClick={handleSignOut} disabled={signingOut}
        className="w-full py-3 bg-red-900/40 hover:bg-red-900/60 text-red-400 font-semibold rounded-xl text-sm transition-colors">
        {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
      </button>
      <BottomNav />
    </div>
  )
}
