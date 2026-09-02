import MobileBottomNav from '@/components/MobileBottomNav'
import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import ConditionalSidebar from '@/components/ConditionalSidebar'
import { ToastContainer } from '@/components/Toast'

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600', '700', '900'] })

export const metadata: Metadata = {
  title: 'RecargaT',
  description: 'Recarga tu vehículo eléctrico fácil y rápido',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RecargaT',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#111827',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('SW registered:', reg.scope); })
                    .catch(function(err) { console.log('SW error:', err); });
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${outfit.className} bg-gray-950 text-white`}>
        <div className="flex min-h-screen">
          <ConditionalSidebar />
          <main className="flex-1 pt-16 p-4 md:p-8 overflow-auto min-w-0">
            {children}
          </main>
        </div>
        <ToastContainer />
            <MobileBottomNav />
      </body>
    </html>
  )
}
