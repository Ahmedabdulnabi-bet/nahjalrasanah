// sw.js (في مجلد root الموقع)
const CACHE_NAME = 'nahj-cache-v1';
const OFFLINE_URL = '/offline.html';

const urlsToCache = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/js/app.js',
  '/assets/images/logo-store.png',
  '/assets/images/product-placeholder.png',
  OFFLINE_URL
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then(response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // If offline and trying to navigate to a page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            
            // Return offline image for images
            if (event.request.destination === 'image') {
              return caches.match('/assets/images/product-placeholder.png');
            }
            
            // Return empty response for other requests
            return new Response('', {
              status: 408,
              statusText: 'Offline'
            });
          });
      })
  );
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-forms') {
    event.waitUntil(syncPendingForms());
  }
});

async function syncPendingForms() {
  // Get pending forms from IndexedDB
  const pendingForms = await getPendingForms();
  
  for (const form of pendingForms) {
    try {
      // Send to server
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form.data)
      });
      
      if (response.ok) {
        // Remove from pending
        await removePendingForm(form.id);
        console.log('Synced form:', form.id);
      }
    } catch (error) {
      console.error('Failed to sync form:', form.id, error);
    }
  }
}

// Push notifications
self.addEventListener('push', event => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/assets/images/logo-store.png',
    badge: '/assets/images/badge.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'view',
        title: 'عرض'
      },
      {
        action: 'close',
        title: 'إغلاق'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});