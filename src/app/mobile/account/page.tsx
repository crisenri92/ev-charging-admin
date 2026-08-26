'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/mobile/login'); return }
      setUser(session.user)
      setLoading(false)
    })
  }, [router])

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.replace('/mobile/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#111827' }}>
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent" />
    </div>
  )

  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  const initials = (user?.email || '?')[0].toUpperCase()

  return (
    <div className="min-h-screen pb-20" style={{ background: '#111827' }}>
      <div className="px-4 pt-8 pb-6 text-center" style={{ background: '#1f2937' }}>
        <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center text-3xl font-bold text-white mx-auto mb-3">
          {initials}
        </div>
        <p className="text-white font-semibold">{user?.email}</p>
        <p className="text-gray-400 text-xs mt-1">Miembro desde {createdAt}</p>
      </div>

      <div className="px-4 pt-6 space-y-4">
        <div className="bg-gray-900 rounded-xl divide-y divide-gray-800">
          <Link href="/wallet" className="flex items-center justify-between px-4 py-3">
            <span className="text-white text-sm">💳  Mi Wallet</span>
            <span className="text-gray-500">›</span>
          </Link>
          <Link href="/mobile" className="flex items-center justify-between px-4 py-3">
            <span className="text-white text-sm">⚡  Cargadores</span>
            <span className="text-gray-500">›</span>
          </Link>
          <Link href="/mobile/forgot-password" className="flex items-center justify-between px-4 py-3">
            <span className="text-white text-sm">🔑  Cambiar contraseña</span>
            <span className="text-gray-500">›</span>
          </Link>
        </div>

        <button onClick={handleLogout} disabled={loggingOut}
          className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">
          {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  )
}
