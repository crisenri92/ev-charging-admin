import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ConditionalSidebar from '@/components/ConditionalSidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EV Charging Admin',
  description: 'CSMS Dashboard',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-950 text-white`}>
        <div className="flex min-h-screen">
          <ConditionalSidebar />
          <main className="flex-1 pt-16 p-4 md:p-8 overflow-auto min-w-0">
            {children}
          </main>
        </div>
            <ToastContainer />
      </body>
    </html>
  )
}
