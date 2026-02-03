import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ROTC GSMS';
  const options = {
    body: data.body || 'New notification',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (let client of windowClients) {
        // Simple check for matching origin, ideally match full URL path if possible
        // But for SPA, focusing the app is often enough, then navigating
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(windowClient => {
              if (windowClient.navigate) {
                  return windowClient.navigate(event.notification.data.url);
              }
          });
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
