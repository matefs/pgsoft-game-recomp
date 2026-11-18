// Local compatibility worker. Requests use the browser's normal network path.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
