'use client'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

const NO_SIDEBAR_PATHS = ['/', '/login', '/forgot-password', '/mobile', '/wallet']

export default function ConditionalSidebar() {
  const pathname = usePathname()
  if (NO_SIDEBAR_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null
  return <Sidebar />
}
