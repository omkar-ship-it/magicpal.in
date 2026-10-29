"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which is the one thing standing between a
 * bookmark and an installable app.
 *
 * After load rather than during it: registration competes with the first
 * paint for the same main thread, and nothing here is needed until the
 * second visit anyway.
 */
export default function PWA() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unregistered worker costs the install prompt and nothing else.
        // There is no version of this worth interrupting somebody over.
      });
    };
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
