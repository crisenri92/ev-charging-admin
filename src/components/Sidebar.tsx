'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: 'Dashboard', icon: '⚡' },
  { href: '/chargers', label: 'Chargers', icon: '🔌' },
  { href: '/sessions', label: 'Sessions', icon: '📋' },
  { href: '/users', label: 'Users', icon: '👤' },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">⚡ EV Admin</h1>
        <p className="text-xs text-gray-400 mt-1">CSMS Dashboard</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              <span className="text-lg">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-500">v1.0.0</p>
      </div>
    </aside>
  )
}
