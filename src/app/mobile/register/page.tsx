'use client'
import { useState } from 'react'
import Link from 'next/link'

const ERROR_MAP: Record<string, string> = {
  'User already registered': 'Ya existe una cuenta con ese email',
  'A user with this email address has already been registered': 'Ya existe una cuenta con ese email',
  'Password should be at least 6 characters': 'La contrasena debe tener al menos 6 caracteres',
  'Unable to validate email address: invalid format': 'Email invalido',
  'Este correo ya esta registrado.': 'Ya existe una cuenta con ese email',
}

const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const EyeOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
)

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPwd) {
      setError('Las contrasenas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName: name }),
      })
      const data = await res.json()

      if (!res.ok) {
        const msg = data.error || 'Error al registrarse'
        setError(ERROR_MAP[msg] ?? msg)
        return
      }

      // Show confirmation email message
      setRegistered(true)
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ---- Success screen ----
  if (registered) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Revisa tu correo</h1>
          <p className="text-gray-400 text-sm mb-2">
            Te enviamos un enlace de confirmacion a
          </p>
          <p className="text-white font-medium text-sm mb-6">{email}</p>
          <p className="text-gray-500 text-xs mb-8">
            Haz clic en el enlace del correo para activar tu cuenta y poder iniciar sesion.
          </p>
          <Link
            href="/mobile/login"
            className="block w-full py-3 rounded-xl bg-green-500 text-black font-semibold text-sm text-center hover:bg-green-400 transition-colors"
          >
            Ir al inicio de sesion
          </Link>
        </div>
      </div>
    )
  }

  // ---- Register form ----
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Crear cuenta</h1>
          <p className="text-gray-500 text-sm">Registrate para usar RecargaT</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Nombre completo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Correo electronico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Contrasena</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50 pr-10"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-3 text-gray-500">
                {showPwd ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Confirmar contrasena</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                placeholder="Repite tu contrasena"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50 pr-10"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-3 text-gray-500">
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-green-500 text-black font-semibold text-sm hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <div className="pt-4 border-t border-white/10">
            <span className="text-gray-500 text-sm">Ya tienes cuenta? </span>
            <Link href="/mobile/login" className="text-green-400 text-sm font-medium hover:underline">
              Iniciar sesion
            </Link>
          </div>
          <div>
            <Link href="/" className="text-gray-600 text-sm hover:text-gray-400">
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
