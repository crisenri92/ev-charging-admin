'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export default function MobileLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/mobile')
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="https://assets.mixkit.co/videos/14538/14538-720.mp4" type="video/mp4" />
        <source src="https://assets.mixkit.co/videos/4233/4233-720.mp4" type="video/mp4" />
      </video>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(15,23,42,0.92) 100%)' }}
      />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-5 py-10">
        <div
          className="w-full max-w-sm rounded-2xl p-8"
          style={{
            background: 'rgba(17,24,39,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white tracking-tight">
              Recarga<span className="text-green-400">T</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">Red de carga eléctrica inteligente</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-3 mb-5 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                placeholder="tu@correo.com"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(p=>!p)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors" aria-label="Mostrar u ocultar contrasena">
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all"
              style={{ background: loading ? '#16a34a99' : '#16a34a' }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/mobile/forgot-password" className="text-green-400 text-sm hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <div className="mt-4 text-center">
            <Link href="/" className="text-gray-500 text-xs hover:text-gray-400">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
