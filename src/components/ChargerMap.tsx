'use client'
import { useEffect } from 'react'

interface ChargerLocation {
  id: string
  name: string | null
  status: string
  location: string | null
  lat: number
  lng: number
}

interface Props {
  chargers: ChargerLocation[]
}

export default function ChargerMap({ chargers }: Props) {
  useEffect(() => {
    // Leaflet must be imported client-side only
    import('leaflet').then((L) => {
      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const existing = document.getElementById('charger-map')
      if (!existing) return
      
      // Remove old map if exists
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
        const color = c.status?.toLowerCase() === 'available' ? '#22c55e'
          : c.status?.toLowerCase() === 'charging' ? '#3b82f6' : '#6b7280'

        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })

        L.marker([c.lat, c.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${c.name || c.id}</b><br>Estado: ${c.status}<br>${c.location || ''}`)
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

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div
        id="charger-map"
        style={{ height: '360px', width: '100%', borderRadius: '12px', zIndex: 0 }}
      />
    </>
  )
}
