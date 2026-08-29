self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'ev-notification',
    data: { url: data.url || '/mobile' },
    actions: [
      { action: 'open', title: 'Ver detalle' }
    ]
  }
  event.waitUntil(self.registration.showNotification(data.title || 'EV Charging', options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/mobile'
  event.waitUntil(clients.matchAll({ type: 'window' }).then(clientList => {
    for (const client of clientList) {
      if (client.url.includes('/mobile') && 'focus' in client) return client.focus()
    }
    if (clients.openWindow) return clients.openWindow(url)
  }))
})

self.addEventListener('install', e => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))
