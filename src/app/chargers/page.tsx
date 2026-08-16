'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type ChargerStatus = 'available' | 'charging' | 'offline'

interface Charger {
  id: string
  name: string | null
  location: string | null
  status: ChargerStatus
  type: string | null
  power_kw: number | null
  created_at: string
}

const emptyForm: Omit<Charger, 'created_at'> = {
  id: '',
  name: '',
  location: '',
  status: 'available',
  type: '',
  power_kw: null,
}

const statusColors: Record<ChargerStatus, string> = {
  available: 'bg-green-100 text-green-800',
  charging: 'bg-blue-100 text-blue-800',
  offline: 'bg-red-100 text-red-800',
}

export default function ChargersPage() {
  const [chargers, setChargers] = useState<Charger[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [locationModal, setLocationModal] = useState<Charger | null>(null)
  const [locationInput, setLocationInput] = useState('')
  const [locSaving, setLocSaving] = useState(false)
  const [locMsg, setLocMsg] = useState('')


  const fetchChargers = useCallback(async () => {
    const { data, error } = await supabase.from('chargers').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setChargers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchChargers()

    const channel = supabase
      .channel('chargers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chargers' }, () => {
        fetchChargers()
      })
      .subscribe()

    const interval = setInterval(fetchChargers, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchChargers])

  const openAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (c: Charger) => {
    setForm({ id: c.id, name: c.name || '', location: c.location || '', status: c.status, type: c.type || '', power_kw: c.power_kw })
    setEditingId(c.id)
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        const { error } = await supabase.from('chargers').update({
          name: form.name,
          location: form.location,
          status: form.status,
          type: form.type,
          power_kw: form.power_kw,
        }).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('chargers').insert({
          id: form.id,
          name: form.name,
          location: form.location,
          status: form.status,
          type: form.type,
          power_kw: form.power_kw,
        })
        if (error) throw error
      }
      setModalOpen(false)
      fetchChargers()
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('chargers').delete().eq('id', id)
    if (error) setError(error.message)
    else { setDeleteId(null); fetchChargers() }
  }

  const handleSaveLocation = async () => {
    if (!locationModal) return
    setLocSaving(true); setLocMsg('')
    const res = await fetch(`/api/chargers/${locationModal.id}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ location_input: locationInput })
    })
    const d = await res.json()
    if (res.ok) {
      setLocMsg('✅ Ubicación guardada')
      setTimeout(() => { setLocationModal(null); setLocMsg('') }, 1500)
    } else {
      setLocMsg('❌ ' + d.error)
    }
    setLocSaving(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cargadores</h1>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          + Agregar cargador
        </button>
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
                <th className="text-left px-4 py-3 text-gray-600 font-medium">ID</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Ubicación</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Estado</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Potencia (kW)</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {chargers.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin cargadores registrados</td></tr>
              )}
              {chargers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.id}</td>
                  <td className="px-4 py-3 font-medium">{c.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.location || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.type || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.power_kw ?? '—'}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                    <button
                  onClick={() => { setLocationModal(c); setLocationInput(c.latitude ? `${c.latitude},${c.longitude}` : '') }}
                  className="text-blue-500 hover:text-blue-700 text-xs font-medium mr-2"
                >📍 Ubicación</button>
                <button onClick={() => setDeleteId(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Editar cargador' : 'Agregar cargador'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                  <input value={form.id} onChange={e => setForm(f => ({...f, id: e.target.value}))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input value={form.name || ''} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input value={form.location || ''} onChange={e => setForm(f => ({...f, location: e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as ChargerStatus}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="available">available</option>
                  <option value="charging">charging</option>
                  <option value="offline">offline</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <input value={form.type || ''} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Potencia (kW)</label>
                <input type="number" value={form.power_kw ?? ''} onChange={e => setForm(f => ({...f, power_kw: e.target.value ? Number(e.target.value) : null}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
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
            <h2 className="text-lg font-semibold mb-2">¿Eliminar cargador?</h2>
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
