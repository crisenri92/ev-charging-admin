import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RecargaT',
  description: 'Red de carga eléctrica inteligente',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RecargaT',
  },
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
