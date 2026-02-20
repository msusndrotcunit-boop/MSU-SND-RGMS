import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

// Enhanced caching strategies for mobile performance

// Always fetch fresh for critical real-time endpoints
registerRoute(
  ({ url, request }) => (
    url.origin === self.location.origin &&
    request.method === 'GET' &&
    (url.pathname === '/api/cadet/my-grades' || url.pathname === '/api/cadet/my-merit-logs')
  ),
  new NetworkOnly()
);

// Cache API responses with safer, same-origin-only network-first strategy
registerRoute(
  ({ url, request }) => (
    url.origin === self.location.origin &&
    request.method === 'GET' &&
    url.pathname.startsWith('/api/')
  ),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 8,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Cache images with cache-first strategy and mobile optimizations
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache CSS and JS files with stale-while-revalidate
registerRoute(
  ({ request }) => 
    request.destination === 'style' || 
    request.destination === 'script',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
);

// Cache fonts with cache-first strategy
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  })
);

// Handle offline fallback for navigation requests
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  })
);

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Global catch handler to avoid "no-response" unhandled promise rejections
setCatchHandler(async ({ event }) => {
  const req = event.request;
  try {
    // For navigation requests, return a simple offline notice
    if (req.mode === 'navigate') {
      return new Response('You appear to be offline. Please check your connection.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
      });
    }
    // For API GET requests, return a graceful 503 JSON
    const url = new URL(req.url);
    if (req.method === 'GET' && url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ ok: false, offline: true, message: 'Service unavailable (offline or server unreachable)' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch {}
  // Default: empty error response to suppress noisy console errors
  return Response.error();
});

async function doBackgroundSync() {
  try {
    const cache = await caches.open('failed-requests');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        await fetch(request);
        await cache.delete(request);
      } catch (error) {
        console.log('Background sync failed for:', request.url);
      }
    }
  } catch (error) {
    console.log('Background sync error:', error);
  }
}

// Mobile-specific fetch optimizations
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Optimize image requests for mobile
  if (request.destination === 'image') {
    const url = new URL(request.url);
    
    // Add mobile optimizations to Cloudinary URLs
    if (url.hostname.includes('cloudinary.com')) {
      const userAgent = request.headers.get('user-agent') || '';
      const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
      
      if (isMobile && !url.pathname.includes('q_auto')) {
        url.pathname = url.pathname.replace('/upload/', '/upload/q_auto,f_auto,dpr_auto/');
        const optimizedRequest = new Request(url.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body,
          mode: request.mode,
          credentials: request.credentials,
          cache: request.cache,
          redirect: request.redirect,
          referrer: request.referrer
        });
        
        event.respondWith(fetch(optimizedRequest));
        return;
      }
    }
  }
  
  // Handle offline scenarios
  if (!self.navigator.onLine && request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        
        // Return offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Offline - ROTC GSMS</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: system-ui; text-align: center; padding: 2rem; }
                .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
                .offline-message { color: #666; margin-bottom: 2rem; }
                .retry-button { 
                  background: #354f32; color: white; border: none; 
                  padding: 0.75rem 1.5rem; border-radius: 0.5rem; 
                  font-size: 1rem; cursor: pointer; 
                }
              </style>
            </head>
            <body>
              <div class="offline-icon">📱</div>
              <h1>You're Offline</h1>
              <p class="offline-message">
                Please check your internet connection and try again.
              </p>
              <button class="retry-button" onclick="window.location.reload()">
                Retry
              </button>
            </body>
            </html>
          `, { 
            status: 200, 
            headers: { 'Content-Type': 'text/html' } 
          });
        }
        
        return new Response('Offline', { status: 503 });
      })
    );
  }
});

// Enhanced push notification handling
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ROTC GSMS';
  const options = {
    body: data.body || 'New notification',
    icon: data.icon || '/pwa-192x192.webp',
    badge: '/pwa-192x192.webp',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Enhanced notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action) {
    // Handle action buttons
    switch (event.action) {
      case 'view':
        event.waitUntil(clients.openWindow(event.notification.data.url));
        break;
      case 'dismiss':
        // Just close the notification
        break;
      default:
        event.waitUntil(clients.openWindow(event.notification.data.url));
    }
  } else {
    // Handle main notification click
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // If a window is already open, focus it
        for (let client of windowClients) {
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
  }
});

// Handle service worker messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '1.0.0' });
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open('runtime-cache').then(cache => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});
