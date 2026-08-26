'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/mobile')
  }

  return (
    <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
      <div className="text-center mb-8">
        <span className="text-5xl">⚡</span>
        <h1 className="text-2xl font-bold text-white mt-2">EV Charging</h1>
        <p className="text-gray-400 text-sm mt-1">Inicia sesión en tu cuenta</p>
      </div>
      {params.get('reset') === 'success' && (
        <div className="bg-green-900/40 border border-green-600 rounded-lg px-4 py-3 mb-4 text-green-400 text-sm text-center">
          ✅ Contraseña actualizada. Inicia sesión.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            placeholder="tu@email.com" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            placeholder="••••••••" required />
        </div>
        <div className="text-right">
          <Link href="/mobile/forgot-password" className="text-xs text-green-400 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-6">
        ¿No tienes cuenta?{' '}
        <Link href="/mobile/register" className="text-green-400 hover:underline">Regístrate</Link>
      </p>
    </div>
  )
}

export default function MobileLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#111827' }}>
      <Suspense fallback={<div className="text-white">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
