'use client'
import { useRouter, usePathname } from 'next/navigation'

export function BottomNav() {
  const router = useRouter()
  const path = usePathname() || ''
  const tabs = [
    { href: '/mobile', label: 'Inicio', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    { href: '/mobile/historial', label: 'Historial', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
    { href: '/mobile/account', label: 'Cuenta', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
  ]
  return (
    <nav className='fixed bottom-0 left-0 right-0 z-40' style={{ background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className='flex items-center justify-around h-16'>
        {tabs.map(tab => {
          const active = path === tab.href || (tab.href !== '/mobile' && path.startsWith(tab.href))
          return (
            <button key={tab.href} onClick={() => router.push(tab.href)} className='flex flex-col items-center gap-1 flex-1 py-2 transition-colors' style={{ color: active ? '#4ade80' : '#6b7280' }}>
              <span dangerouslySetInnerHTML={{__html: tab.icon}} />
              <span className='text-xs font-medium'>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
