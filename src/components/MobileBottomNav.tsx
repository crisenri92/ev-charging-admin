'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/mobile', label: 'Inicio', icon: '🏠' },
  { href: '/chargers', label: 'Cargadores', icon: '⚡' },
  { href: '/sessions', label: 'Sesiones', icon: '📋' },
  { href: '/account', label: 'Cuenta', icon: '👤' },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-gray-900 border-t border-gray-700 flex h-16 z-50">
      {tabs.map(tab => (
        <Link key={tab.href} href={tab.href} className={`flex-1 flex flex-col items-center justify-center text-xs gap-1 ${pathname === tab.href ? 'text-green-400' : 'text-gray-400'}`}>
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
