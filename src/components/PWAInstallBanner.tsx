'use client'
import { useEffect, useState } from 'react'

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already installed (running as standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as any).standalone) return
    // Don't show if dismissed before
    if (localStorage.getItem('pwa-banner-dismissed')) return

    const isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    if (isIOSDevice) {
      setShow(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    setShow(false)
    setDismissed(true)
    localStorage.setItem('pwa-banner-dismissed', '1')
  }

  if (!show || dismissed) return null

  return (
    <div className="mx-4 mb-4 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: '#1e3a5f', border: '1px solid #1d4ed8' }}>
      <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.268a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold">Instalar EV Charging</p>
        {isIOS ? (
          <p className="text-blue-300 text-xs mt-0.5">Toca <span className="font-bold">⎋ Compartir</span> → "Agregar a pantalla de inicio"</p>
        ) : (
          <p className="text-blue-300 text-xs mt-0.5">Accede más rápido desde tu pantalla de inicio</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isIOS && (
          <button onClick={install} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#1d4ed8' }}>
            Instalar
          </button>
        )}
        <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
