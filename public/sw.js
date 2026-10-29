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
const VERSION = "v1";
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
