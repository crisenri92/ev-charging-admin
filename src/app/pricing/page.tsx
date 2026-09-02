'use client'
import { useEffect, useState } from 'react'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface PricingRule {
  id: string
  name: string
  price_per_kwh: number
  start_hour: number
  end_hour: number
  days_of_week: number[]
  active: boolean
  priority: number
}

const EMPTY: Omit<PricingRule, 'id'> = {
  name: '', price_per_kwh: 0.15, start_hour: 0, end_hour: 23,
  days_of_week: [0,1,2,3,4,5,6], active: true, priority: 0,
}

function fmt(h: number) { return `${String(h).padStart(2,'0')}:00` }

function RuleModal({ rule, onSave, onClose }: {
  rule: Partial<PricingRule>; onSave: (r: any) => void; onClose: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY, ...rule })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function toggleDay(d: number) {
    set('days_of_week', form.days_of_week.includes(d)
      ? form.days_of_week.filter(x => x !== d)
      : [...form.days_of_week, d].sort())
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-white font-bold text-lg mb-5">{rule.id ? 'Editar regla' : 'Nueva regla'}</h2>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Nombre</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">$/kWh</label>
              <input type="number" step="0.01" min="0" value={form.price_per_kwh}
                onChange={e => set('price_per_kwh', parseFloat(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Desde</label>
              <input type="number" min="0" max="23" value={form.start_hour}
                onChange={e => set('start_hour', parseInt(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Hasta</label>
              <input type="number" min="0" max="23" value={form.end_hour}
                onChange={e => set('end_hour', parseInt(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1.5 block">Días</label>
            <div className="flex gap-1.5">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${form.days_of_week.includes(i) ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Prioridad (mayor = prevalece)</label>
              <input type="number" min="0" value={form.priority}
                onChange={e => set('priority', parseInt(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 outline-none" />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => set('active', !form.active)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${form.active ? 'bg-green-600' : 'bg-gray-700'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.active ? 'left-5.5' : 'left-0.5'}`} style={{ left: form.active ? '22px' : '2px' }} />
                </div>
                <span className="text-gray-300 text-sm">{form.active ? 'Activa' : 'Inactiva'}</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm transition-colors">Cancelar</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-colors">Guardar</button>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  const [rules, setRules] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Partial<PricingRule> | null>(null)
  const [currentPrice, setCurrentPrice] = useState<{ price: number; ruleName: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => { fetchRules(); fetchCurrent() }, [])

  async function fetchRules() {
    const r = await fetch('/api/pricing/rules')
    const d = await r.json()
    setRules(d)
    setLoading(false)
  }

  async function fetchCurrent() {
    const r = await fetch('/api/pricing')
    const d = await r.json()
    setCurrentPrice(d)
  }

  async function saveRule(form: any) {
    setSaving(true)
    const method = modal?.id ? 'PATCH' : 'POST'
    const body = modal?.id ? { id: modal.id, ...form } : form
    await fetch('/api/pricing/rules', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetchRules()
    await fetchCurrent()
    setModal(null)
    setSaving(false)
  }

  async function deleteRule(id: string) {
    await fetch('/api/pricing/rules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setDeleteTarget(null)
    fetchRules()
  }

  async function toggleActive(rule: PricingRule) {
    await fetch('/api/pricing/rules', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, active: !rule.active })
    })
    fetchRules()
    fetchCurrent()
  }

  return (
    <div className="max-w-3xl mx-auto">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Tarifas dinámicas</h1>
              <p className="text-gray-500 text-sm mt-1">Configura precios por hora y día de la semana</p>
            </div>
            <button onClick={() => setModal({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-colors">
              + Nueva regla
            </button>
          </div>

          {/* Current price banner */}
          {currentPrice && (
            <div className="bg-green-900/20 border border-green-800/40 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-green-400 text-xs font-semibold uppercase tracking-widest">Tarifa vigente ahora</p>
                <p className="text-white font-semibold mt-0.5">{currentPrice.ruleName}</p>
              </div>
              <span className="text-3xl font-bold text-green-400">${Number(currentPrice.price).toFixed(2)}<span className="text-base font-normal text-green-600">/kWh</span></span>
            </div>
          )}

          {/* Rules list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-400 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id} className={`bg-gray-900 rounded-2xl p-4 border transition-all ${rule.active ? 'border-gray-800' : 'border-gray-800/40 opacity-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${rule.active ? 'bg-green-500' : 'bg-gray-600'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">{rule.name}</p>
                          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-lg">P{rule.priority}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span>{fmt(rule.start_hour)} – {fmt(rule.end_hour)}</span>
                          <span>{rule.days_of_week.map(d => DAYS[d]).join(', ')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-green-400 font-bold text-lg">${Number(rule.price_per_kwh).toFixed(2)}<span className="text-xs text-green-700 font-normal">/kWh</span></span>
                      <button onClick={() => toggleActive(rule)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${rule.active ? 'bg-yellow-900/40 text-yellow-400 hover:bg-yellow-900/60' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {rule.active ? 'Pausar' : 'Activar'}
                      </button>
                      <button onClick={() => setModal(rule)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors">Editar</button>
                      <button onClick={() => setDeleteTarget(rule.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors">Eliminar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-gray-600 text-xs mt-6">
            Las reglas con mayor prioridad prevalecen. Si un horario no tiene regla activa se usa la tarifa base.
          </p>
        </div>
      {modal !== null && <RuleModal rule={modal} onSave={saveRule} onClose={() => setModal(null)} />}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-2">¿Eliminar regla?</h2>
            <p className="text-sm text-gray-400 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm border border-gray-700">Cancelar</button>
              <button onClick={() => deleteRule(deleteTarget)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
