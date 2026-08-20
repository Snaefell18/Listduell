/* List Duell — Service Worker
   1. Push entgegennehmen und nur dann als Systemmeldung zeigen,
      wenn kein Fenster der App gerade sichtbar ist.
   2. Beim Antippen die App öffnen bzw. nach vorne holen.
   Es wird bewusst nichts zwischengespeichert — die App soll immer
   die aktuelle Version vom Server laden. */

const VERSION = "listduell-sw-2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let payload = {};
  try {
    const raw = event.data ? event.data.json() : {};
    payload = raw.data || raw;            // FCM verpackt Datenfelder in "data"
  } catch(_){
    payload = { title: "List Duell", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "List Duell";
  const body  = payload.body  || "";
  const tag   = payload.tag   || "listduell";
  const url   = payload.url   || "/";

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const sichtbar = clients.some(c => c.visibilityState === "visible");

    // Liegt die App vorn, zusätzlich einen Hinweis in der Oberfläche zeigen.
    if (sichtbar) clients.forEach(c => c.postMessage({ type: "push", title, body, tag, url }));

    /* Die Meldung wird IMMER angelegt. Safari auf iOS verlangt, dass jedes
       Push-Ereignis in einer Benachrichtigung endet — wer das überspringt,
       riskiert, dass das Abo stillschweigend gekündigt wird. Liegt die App
       vorn, kommt sie lautlos. */
    await self.registration.showNotification(title, {
      body,
      tag,
      renotify: !sichtbar,
      silent: sichtbar,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
      vibrate: sichtbar ? undefined : [60, 40, 60]
    });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients){
      if ("focus" in c){ await c.focus(); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
