'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://ev-charging-admin-production.up.railway.app/mobile/reset-password',
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#111827' }}>
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm text-center">
        <span className="text-5xl">📧</span>
        <h2 className="text-xl font-bold text-white mt-4 mb-2">Correo enviado</h2>
        <p className="text-gray-400 text-sm mb-6">Revisa tu bandeja de entrada en <strong className="text-white">{email}</strong> y haz clic en el link para restablecer tu contraseña.</p>
        <Link href="/mobile/login" className="block w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg text-center transition-colors">
          Volver al login
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#111827' }}>
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🔑</span>
          <h1 className="text-2xl font-bold text-white mt-2">Recuperar contraseña</h1>
          <p className="text-gray-400 text-sm mt-1">Te enviamos un link al correo registrado</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              placeholder="tu@email.com" required />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">
            {loading ? 'Enviando...' : 'Enviar link de recuperación'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/mobile/login" className="text-green-400 hover:underline">← Volver al login</Link>
        </p>
      </div>
    </div>
  )
}
