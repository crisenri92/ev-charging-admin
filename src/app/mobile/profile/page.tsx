'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/mobile/login'); return }
      setUser(session.user)
      setName(session.user.user_metadata?.full_name || '')
      setEmail(session.user.email || '')
    })
  }, [router])

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    setLoading(false)
    if (error) showToast('Error al guardar: ' + error.message, 'err')
    else showToast('Nombre actualizado', 'ok')
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPwd !== confirmPwd) { showToast('Las contraseñas no coinciden', 'err'); return }
    if (newPwd.length < 6) { showToast('Mínimo 6 caracteres', 'err'); return }
    setPwdLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setPwdLoading(false)
    if (error) showToast('Error: ' + error.message, 'err')
    else { showToast('Contraseña actualizada', 'ok'); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('') }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/mobile/login')
  }

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-400 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen px-4 pt-6 pb-10" style={{ background: '#0f172a' }}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium text-center shadow-lg transition-all ${toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/mobile" className="p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-white">Mi perfil</h1>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center text-3xl font-bold text-white mb-3">
          {name ? name[0].toUpperCase() : email[0]?.toUpperCase()}
        </div>
        <p className="text-white font-semibold text-lg">{name || 'Usuario'}</p>
        <p className="text-gray-400 text-sm">{email}</p>
      </div>

      {/* Name form */}
      <form onSubmit={saveName} className="mb-6 rounded-2xl p-4" style={{ background: '#1e293b' }}>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">Nombre</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Tu nombre completo"
          className="w-full px-3 py-2.5 rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500 mb-3"
          style={{ background: '#0f172a', border: '1px solid #334155' }}
        />
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl font-semibold text-white text-sm"
          style={{ background: loading ? '#166534' : '#16a34a' }}>
          {loading ? 'Guardando...' : 'Guardar nombre'}
        </button>
      </form>

      {/* Email (read-only) */}
      <div className="mb-6 rounded-2xl p-4" style={{ background: '#1e293b' }}>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">Email</p>
        <div className="px-3 py-2.5 rounded-xl text-gray-400 text-sm" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          {email}
        </div>
        <p className="text-gray-600 text-xs mt-2">El email no se puede cambiar</p>
      </div>

      {/* Password form */}
      <form onSubmit={changePassword} className="mb-6 rounded-2xl p-4" style={{ background: '#1e293b' }}>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">Cambiar contraseña</p>
        <input
          type="password"
          value={newPwd}
          onChange={e => setNewPwd(e.target.value)}
          placeholder="Nueva contraseña"
          className="w-full px-3 py-2.5 rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500 mb-3"
          style={{ background: '#0f172a', border: '1px solid #334155' }}
        />
        <input
          type="password"
          value={confirmPwd}
          onChange={e => setConfirmPwd(e.target.value)}
          placeholder="Confirmar nueva contraseña"
          className="w-full px-3 py-2.5 rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500 mb-3"
          style={{ background: '#0f172a', border: '1px solid #334155' }}
        />
        <button type="submit" disabled={pwdLoading}
          className="w-full py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: pwdLoading ? '#1e3a5f' : '#1d4ed8', color: 'white' }}>
          {pwdLoading ? 'Actualizando...' : 'Cambiar contraseña'}
        </button>
      </form>

      {/* Logout */}
      <button onClick={logout}
        className="w-full py-3 rounded-2xl font-semibold text-red-400 text-sm border border-red-900/40"
        style={{ background: '#1e293b' }}>
        Cerrar sesión
      </button>
    </div>
  )
}
