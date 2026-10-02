// SERVICE WORKER: permite instalar Scouteando como app y que abra rápido.
// Estrategia "primero la red": siempre intenta traer lo último; si no hay internet, usa la copia guardada.
const CACHE = "scouteando-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", function (e) {
  const url = new URL(e.request.url);
  // Solo guardamos los archivos de nuestra página (no fotos ni escudos de otros sitios)
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(function (respuesta) {
        const copia = respuesta.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(e.request))
  );
});
