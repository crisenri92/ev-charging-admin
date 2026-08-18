
'use client'
import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

const listeners: ((t: Toast) => void)[] = []
let nextId = 1

export function toast(message: string, type: ToastType = 'success') {
  const t = { id: nextId++, message, type }
  listeners.forEach(fn => fn(t))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id))
      }, 4000)
    }
    listeners.push(handler)
    return () => { listeners.splice(listeners.indexOf(handler), 1) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg transition-all
          ${t.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            t.type === 'error'   ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                   'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          {t.message}
        </div>
      ))}
    </div>
  )
}
