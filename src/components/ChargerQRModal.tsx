'use client'
import { useEffect, useRef } from 'react'

interface Props {
  chargerId: string
  chargerName: string
  onClose: () => void
}

const BASE_URL = 'https://ev-charging-admin-production.up.railway.app'

export default function ChargerQRModal({ chargerId, chargerName, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const url = `${BASE_URL}/mobile?charger=${encodeURIComponent(chargerId)}`

  useEffect(() => {
    import('qrcode').then(QRCode => {
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, url, {
          width: 240,
          margin: 2,
          color: { dark: '#ffffff', light: '#1f2937' },
        })
      }
    })
  }, [url])

  const handleDownload = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `qr-${chargerId}.png`
    link.href = canvasRef.current.toDataURL()
    link.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl p-6 text-center w-72" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-bold text-lg mb-1">{chargerName}</h3>
        <p className="text-gray-400 text-xs mb-4">El usuario escanea este QR para iniciar carga</p>
        <canvas ref={canvasRef} className="rounded-xl mx-auto" />
        <p className="text-gray-600 text-xs mt-3 break-all">{url}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cerrar</button>
          <button onClick={handleDownload} className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold">Descargar</button>
        </div>
      </div>
    </div>
  )
}
