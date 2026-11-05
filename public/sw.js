/**
 * The smallest service worker that makes this installable, and no smaller.
 *
 * A service worker with a fetch handler is what Chrome requires before it
 * will offer "install"; everything past that is a decision about what to
 * serve when the network is gone, and on this product most of the obvious
 * answers are wrong.
 *
 * What is deliberately NOT cached:
 *
 *   HTML documents. Every page here is rendered for whoever is signed in.
 *   A cached document is one account's page waiting to be served to the
 *   next person who opens the app on a shared phone, and no amount of
 *   offline polish is worth that.
 *
 *   /api/*. This is a map of where people are right now. A stale answer is
 *   not a degraded answer, it is a wrong one — somebody shown at a café
 *   they left an hour ago.
 *
 *   Anything cross-origin. Map tiles have their own caching and their own
 *   terms; proxying them through here would be both slower and rude.
 *
 * What is cached is the build's own static output, which is content-hashed
 * and therefore safe forever, plus one offline page.
 */
const VERSION = "v2";
const SHELL = `onw-shell-${VERSION}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll([OFFLINE, "/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Documents: always the network, with a page to show when there isn't one.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const hit = await caches.match(OFFLINE);
        return hit ?? new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      })
    );
    return;
  }

  // Build output only. The filenames carry a content hash, so a hit is by
  // definition the right bytes and never needs revalidating.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});

/* ── push ──────────────────────────────────────────────────────────────
   The last hop of a proximity alert.

   The payload is built on the server and has already been through the
   same `place()` the map uses, so there is nothing to decide here and
   nothing to look up — rendering it is the whole job. No fetch, because a
   push handler that calls the network is a push handler that sometimes
   shows nothing.

   The fallback text matters more than it looks: a push with no readable
   payload still has to show *something*, or some browsers post their own
   "This site has been updated in the background" on our behalf, which is
   both meaningless and ours to answer for. */
self.addEventListener("push", (event) => {
  let note = {};
  try {
    note = event.data ? event.data.json() : {};
  } catch {
    note = {};
  }

  const title = note.title || "Someone worth meeting is nearby";
  const body = note.body || "Open the map to see who.";
  const url = typeof note.url === "string" && note.url.startsWith("/") ? note.url : "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Same tag replaces the previous unread one rather than stacking: a
      // lock screen with four of these on it is how somebody decides to
      // turn the whole thing off.
      tag: note.tag || "nearby",
      renotify: true,
      data: { url },
    })
  );
});

/* Tapping it should land in the app that is already open, if one is — a
   second window of a map the person is already looking at is a worse
   answer than the window they already had. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          if ("navigate" in w) w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

/* The push service can rotate an endpoint on its own. Without this the
   subscription silently dies and the person simply stops hearing from us,
   which is indistinguishable from the feature not working. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((sub) =>
        fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON(), tzOffsetMinutes: -new Date().getTimezoneOffset() }),
        })
      )
      .catch(() => {})
  );
});
