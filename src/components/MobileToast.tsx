'use client'
import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'error' | 'success' | 'info'
  onDone: () => void
}

export function MobileToast({ message, type = 'error', onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])

  const bg = type === 'error' ? 'bg-red-900/90 border-red-700' : type === 'success' ? 'bg-green-900/90 border-green-700' : 'bg-gray-800/90 border-gray-600'
  const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'

  return (
    <div className={`fixed top-4 left-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border ${bg} text-white text-sm shadow-xl animate-in fade-in slide-in-from-top-2 duration-200`}>
      <span>{icon}</span>
      <span className="flex-1">{message}</span>
      <button onClick={onDone} className="text-gray-400 hover:text-white ml-1">✕</button>
    </div>
  )
}
