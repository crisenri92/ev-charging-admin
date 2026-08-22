'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ADMIN_TABS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/chargers', label: 'Cargadores', icon: '⚡' },
  { href: '/sessions', label: 'Sesiones', icon: '📋' },
  { href: '/users', label: 'Usuarios', icon: '👥' },
]

const MOBILE_TABS = [
  { href: '/mobile', label: 'Inicio', icon: '🏠' },
  { href: '/wallet', label: 'Wallet', icon: '💳' },
]

const MOBILE_PATHS = ['/mobile', '/wallet']

export default function MobileBottomNav() {
  const pathname = usePathname()

  // Hide on login pages and full desktop
  if (pathname === '/login' || pathname === '/mobile/login') return null

  const isMobileRoute = MOBILE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  const tabs = isMobileRoute ? MOBILE_TABS : ADMIN_TABS

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-gray-900 border-t border-gray-700 flex h-16 z-50">
      {tabs.map(tab => (
        <Link key={tab.href} href={tab.href}
          className={`flex-1 flex flex-col items-center justify-center text-xs gap-1 ${pathname === tab.href ? 'text-green-400' : 'text-gray-400'}`}>
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
