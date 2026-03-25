/* coi-serviceworker v0.1.7 - https://github.com/gzuidhof/coi-serviceworker */
/* Injects COOP/COEP headers via service worker to enable cross-origin isolation
   (required for SharedArrayBuffer, MediaStreamTrackGenerator, VideoFrame transfer) */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function isCrossOriginIsolationRequired(request) {
  if (request.mode === "navigate") return true;
  return false;
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response.status === 0) {
          return response;
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
        newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      })
      .catch(function (e) {
        throw e;
      })
  );
});
