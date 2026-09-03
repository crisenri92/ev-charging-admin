'use client'
import { useEffect, useState } from 'react'

interface ChargerLocation {
  id: string
  name: string | null
  status: string
  location?: string | null
  lat: number
  lng: number
}

interface Props {
  chargers: ChargerLocation[]
}

const STATUS_LABEL: Record<string, string> = {
  available: 'Disponible',
  charging: 'En uso',
  offline: 'Sin conexión',
  unavailable: 'No disponible',
}

const STATUS_COLOR: Record<string, string> = {
  available: '#22c55e',
  charging: '#3b82f6',
  offline: '#6b7280',
  unavailable: '#6b7280',
}

export default function ChargerMap({ chargers }: Props) {
  const [selected, setSelected] = useState<ChargerLocation | null>(null)

  useEffect(() => {
    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const existing = document.getElementById('charger-map')
      if (!existing) return

      const mapEl = existing as any
      if (mapEl._leaflet_id) {
        mapEl._leaflet_map?.remove()
      }

      const map = L.map('charger-map', { zoomControl: true }).setView([-0.2295, -78.5243], 12)
      mapEl._leaflet_map = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      chargers.forEach((c) => {
        const st = (c.status || '').toLowerCase()
        const color = STATUS_COLOR[st] || '#6b7280'

        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        })

        L.marker([c.lat, c.lng], { icon })
          .addTo(map)
          .on('click', () => {
            // Update React state — need to dispatch a custom event since we're in a non-React context
            const ev = new CustomEvent('charger-selected', { detail: c })
            document.dispatchEvent(ev)
          })
      })
    })

    return () => {
      const el = document.getElementById('charger-map') as any
      if (el?._leaflet_map) {
        el._leaflet_map.remove()
        delete el._leaflet_map
      }
    }
  }, [chargers])

  useEffect(() => {
    const handler = (e: Event) => {
      setSelected((e as CustomEvent).detail)
    }
    document.addEventListener('charger-selected', handler)
    return () => document.removeEventListener('charger-selected', handler)
  }, [])

  const openDirections = () => {
    if (!selected) return
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`,
      '_blank'
    )
    setSelected(null)
  }

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
      <div id="charger-map" style={{ height: '360px', width: '100%', borderRadius: '12px', zIndex: 0 }} />

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl p-6 pb-10"
            style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Status dot + name */}
            <div className="flex items-center gap-3 mb-1">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: STATUS_COLOR[(selected.status || '').toLowerCase()] || '#6b7280' }}
              />
              <p className="text-white font-bold text-lg">{selected.name || selected.id}</p>
            </div>
            <p className="text-gray-400 text-sm mb-1 pl-6">
              {STATUS_LABEL[(selected.status || '').toLowerCase()] || selected.status}
            </p>
            {selected.location && (
              <p className="text-gray-500 text-xs mb-5 pl-6">{selected.location}</p>
            )}

            <div className="mt-5 bg-gray-800/60 rounded-2xl px-4 py-3 mb-5">
              <p className="text-white text-sm font-medium">¿Quieres que te dirijamos para allá?</p>
              <p className="text-gray-500 text-xs mt-0.5">Se abrirá Google Maps con la ruta</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 py-3.5 rounded-2xl text-sm font-medium text-gray-400"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancelar
              </button>
              <button
                onClick={openDirections}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Llevarme allá
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
