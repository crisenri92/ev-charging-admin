import Link from 'next/link'

export default function WelcomePage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ background: '#0a0f1e' }}>
      <div className="w-full max-w-xs text-center">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-green-600 flex items-center justify-center mb-5 shadow-lg shadow-green-900/50">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.268a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Recarga<span className="text-green-400">T</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Plataforma de carga eléctrica</p>
        </div>

        {/* Access options */}
        <div className="space-y-3">
          <Link
            href="/mobile/login"
            className="flex items-center justify-between w-full px-5 py-4 bg-green-600 hover:bg-green-500 active:scale-[0.98] rounded-2xl transition-all group"
          >
            <div className="text-left">
              <p className="text-white font-semibold text-sm">Acceso usuarios</p>
              <p className="text-green-200/70 text-xs mt-0.5">Carga tu vehículo eléctrico</p>
            </div>
            <svg className="w-5 h-5 text-white/60 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/login"
            className="flex items-center justify-between w-full px-5 py-4 bg-gray-900 hover:bg-gray-800 active:scale-[0.98] border border-gray-800 hover:border-gray-700 rounded-2xl transition-all group"
          >
            <div className="text-left">
              <p className="text-white font-semibold text-sm">Panel de administración</p>
              <p className="text-gray-500 text-xs mt-0.5">Gestiona cargadores y usuarios</p>
            </div>
            <svg className="w-5 h-5 text-gray-600 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <p className="text-gray-700 text-xs mt-10">© 2025 RecargaT</p>
      </div>
    </div>
  )
}
