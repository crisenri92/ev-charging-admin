import Link from 'next/link'

export default function WelcomePage() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="https://assets.mixkit.co/videos/35540/35540-720.mp4" type="video/mp4" />
        <source src="https://assets.mixkit.co/videos/44545/44545-720.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 100%)' }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">

        {/* Logo */}
        <div className="mb-2">
          <div className="w-16 h-16 rounded-2xl bg-green-500/90 backdrop-blur flex items-center justify-center mx-auto mb-5 shadow-xl shadow-green-900/60">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.268a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-lg">
            Recarga<span className="text-green-400">T</span>
          </h1>
          <p className="text-white/60 text-sm mt-2 font-medium tracking-widest uppercase">Plataforma de carga eléctrica</p>
        </div>

        {/* Access buttons */}
        <div className="w-full max-w-xs mt-12 space-y-3">
          <Link
            href="/mobile/login"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl transition-all active:scale-[0.98] group"
            style={{ background: 'rgba(22,163,74,0.92)', backdropFilter: 'blur(12px)' }}
          >
            <div className="text-left">
              <p className="text-white font-bold text-sm">Acceso usuarios</p>
              <p className="text-green-200/80 text-xs mt-0.5">Carga tu vehículo eléctrico</p>
            </div>
            <svg className="w-5 h-5 text-white/70 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/login"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border border-white/15 transition-all active:scale-[0.98] group"
            style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
          >
            <div className="text-left">
              <p className="text-white font-bold text-sm">Panel de administración</p>
              <p className="text-white/50 text-xs mt-0.5">Gestiona cargadores y usuarios</p>
            </div>
            <svg className="w-5 h-5 text-white/40 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <p className="absolute bottom-6 text-white/25 text-xs">© 2025 RecargaT</p>
      </div>
    </div>
  )
}
