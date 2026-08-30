'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ERROR_MAP: Record<string, string> = {
  'User already registered': 'Ya existe una cuenta con ese email',
  'A user with this email address has already been registered': 'Ya existe una cuenta con ese email',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
  'Unable to validate email address: invalid format': 'Email inválido',
}

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPwd) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)

    // 1. Create account via admin API (no email confirmation required)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName: name.trim() })
    })
    const result = await res.json()

    if (!res.ok || !result.ok) {
      const msg = result.error || 'Error al crear la cuenta'
      setError(ERROR_MAP[msg] || msg)
      setLoading(false)
      return
    }

    // 2. Sign in immediately (user is already confirmed)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      // Account created but auto-login failed — send to login page
      setError('Cuenta creada. Inicia sesión con tu email y contraseña.')
      setLoading(false)
      router.push('/mobile/login')
      return
    }

    router.push('/mobile')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: '#0f172a' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-600 mb-4 shadow-lg shadow-green-900/40">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.268a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
          <p className="text-slate-400 text-sm mt-1">Únete a EV Charging</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Nombre completo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Tu nombre"
              className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-green-500 transition"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-green-500 transition"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-green-500 transition"
                style={{ background: '#1e293b', border: '1px solid #334155' }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition">
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirmar contraseña</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              required
              placeholder="Repite tu contraseña"
              className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-green-500 transition"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-all"
            style={{ background: loading ? '#166534' : '#16a34a' }}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/mobile/login" className="text-green-400 font-medium hover:text-green-300">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
