'use client'
import Link from 'next/link'
import { Outfit } from 'next/font/google'

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '700', '900'] })

export default function WelcomePage() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="https://assets.mixkit.co/videos/23125/23125-720.mp4" type="video/mp4" />
        <source src="https://assets.mixkit.co/videos/22982/22982-720.mp4" type="video/mp4" />
        <source src="https://assets.mixkit.co/videos/23126/23126-720.mp4" type="video/mp4" />
      </video>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.82) 100%)' }}
      />
      <div className={`relative z-10 flex flex-col items-center justify-center h-full px-6 text-center ${outfit.className}`}>
        <div className="mb-10">
          <h1 className="text-5xl font-black text-white tracking-tight mb-2">
            Recarga<span className="text-green-400">T</span>
          </h1>
          <p className="text-gray-300 text-lg font-medium">Red de carga eléctrica inteligente</p>
        </div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Link
            href="/mobile/login"
            className="w-full py-4 rounded-2xl text-white font-bold text-lg tracking-wide transition-all"
            style={{
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            Acceso usuarios
          </Link>
          <Link
            href="/login"
            className="w-full py-4 rounded-2xl font-bold text-lg tracking-wide transition-all"
            style={{
              background: 'rgba(74,222,128,0.15)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(74,222,128,0.4)',
              color: '#4ade80',
            }}
          >
            Panel de administración
          </Link>
        </div>
      </div>
    </div>
  )
}
