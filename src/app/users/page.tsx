'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  role: string | null
  created_at: string
}

const emptyForm = { full_name: '', role: '' }

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setProfiles(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const openEdit = (p: Profile) => {
    setEditingUser(p)
    setForm({ full_name: p.full_name || '', role: p.role || '' })
  }

  const handleSave = async () => {
    if (!editingUser) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name,
      role: form.role,
    }).eq('id', editingUser.id)
    if (error) setError(error.message)
    else { setEditingUser(null); fetchProfiles() }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) setError(error.message)
    else { setDeleteId(null); fetchProfiles() }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Teléfono</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Rol</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Registro</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin usuarios registrados</td></tr>
              )}
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.full_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.phone || '—'}</td>
                  <td className="px-4 py-3">
                    {p.role ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{p.role}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString('es-MX')}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                    <button onClick={() => setDeleteId(p.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Editar usuario</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Sin rol</option>
                  <option value="admin">admin</option>
                  <option value="user">user</option>
                  <option value="operator">operator</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditingUser(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-2">¿Eliminar usuario?</h2>
            <p className="text-gray-600 text-sm mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
