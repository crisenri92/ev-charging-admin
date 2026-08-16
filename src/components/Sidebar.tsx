'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⚡' },
  { href: '/chargers', label: 'Cargadores', icon: '🔌' },
  { href: '/sessions', label: 'Sesiones', icon: '📋' },
  { href: '/users', label: 'Usuarios', icon: '👤' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Hamburger button - only mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-gray-800 p-2 rounded-lg"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        <span className="block w-5 h-0.5 bg-white mb-1"></span>
        <span className="block w-5 h-0.5 bg-white mb-1"></span>
        <span className="block w-5 h-0.5 bg-white"></span>
      </button>

      {/* Overlay - mobile only */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-50
          flex flex-col p-6 transition-transform duration-300
          md:static md:translate-x-0 md:flex
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-bold text-yellow-400">⚡ EV Admin</h1>
            <p className="text-xs text-gray-400">CSMS Dashboard</p>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto text-xs text-gray-600">v1.0.0</div>
      </aside>
    </>
  )
}
