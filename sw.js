const CACHE_NAME = 'tla-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/data.js',
    './js/calendar.js',
    './js/dashboard.js',
    './js/leave-request.js',
    './js/table.js',
    './js/teachers.js',
    './js/settings.js',
    './manifest.json',
    './icon-app.png',
    'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
    'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
    'https://npmcdn.com/flatpickr/dist/themes/airbnb.css',
    'https://cdn.jsdelivr.net/npm/flatpickr',
    'https://npmcdn.com/flatpickr/dist/l10n/th.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install Event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            );
        })
    );
});

// Fetch Event (Network First, fallback to Cache)
self.addEventListener('fetch', event => {
    // Skip cross-origin POST requests (like Google Apps Script API)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request).then(response => {
            // If request is successful, update cache
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
            });
            return response;
        }).catch(() => {
            // If network fails, try cache
            return caches.match(event.request);
        })
    );
});
