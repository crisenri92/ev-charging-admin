'use client'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>

      {/* ── Hero con video de fondo ─────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center justify-center min-h-[60vh] px-6 overflow-hidden">

        {/* Video de fondo */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.35) saturate(1.2)' }}
        >
          {/* Video de carga de vehículos eléctricos — reemplaza src si quieres otro */}
          <source
            src="https://videos.pexels.com/video-files/3571264/3571264-hd_1280_720_30fps.mp4"
            type="video/mp4"
          />
        </video>

        {/* Gradiente sobre el video */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0.5) 60%, rgba(15,23,42,1) 100%)',
          }}
        />

        {/* Contenido del hero */}
        <div className="relative z-10 text-center flex flex-col items-center gap-4">
          {/* Ícono de rayo */}
          <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-400/40 flex items-center justify-center mb-2 shadow-lg shadow-green-500/20">
            <svg className="w-9 h-9 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight drop-shadow-xl">
            RECARGAT
          </h1>
          <p className="text-green-400 text-base sm:text-lg font-medium tracking-wide">
            El futuro de la movilidad eléctrica
          </p>
          <p className="text-gray-300 text-sm sm:text-base max-w-xs sm:max-w-md leading-relaxed mt-1">
            Carga tu vehículo eléctrico de forma inteligente, rápida y segura
            desde cualquier lugar de Ecuador.
          </p>
        </div>
      </div>

      {/* ── Selector de rol ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 pt-10 pb-16">
        <p className="text-gray-300 text-base font-medium mb-8">¿Cómo deseas ingresar?</p>

        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-sm">

          {/* Tarjeta Usuario */}
          <button
            onClick={() => router.push('/mobile')}
            className="flex-1 flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700/70 hover:border-green-500/60 active:scale-95 transition-all duration-200 p-8 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">Usuario</p>
              <p className="text-gray-400 text-xs mt-1">Recargar mi vehículo</p>
            </div>
          </button>

          {/* Tarjeta Administrador */}
          <button
            onClick={() => router.push('/login')}
            className="flex-1 flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700/70 hover:border-blue-500/60 active:scale-95 transition-all duration-200 p-8 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">Administrador</p>
              <p className="text-gray-400 text-xs mt-1">Gestionar la plataforma</p>
            </div>
          </button>

        </div>

        <p className="text-gray-600 text-xs mt-12">© 2026 RecargaT · Ecuador</p>
      </div>

    </div>
  )
}
