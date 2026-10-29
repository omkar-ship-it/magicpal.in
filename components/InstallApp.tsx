"use client";

import { useEffect, useState } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { IconPlus, IconX } from "./Icons";

/**
 * The nudge, because almost nobody finds "Add to Home Screen" on their own.
 *
 * Two platforms, two entirely different facts. Chrome fires an event you
 * can hold onto and replay from a button of your own, so the install is one
 * tap. Safari has no such event and never will, so the only honest thing to
 * offer an iPhone is the three words of instruction — and getting that
 * wrong, by showing a button that cannot do anything, is worse than showing
 * nothing.
 *
 * It renders inside the home panel rather than as a floating bar over the
 * map. An install prompt that covers the product while somebody is still
 * deciding whether they want it has the argument backwards.
 *
 * Safe to read `window` in an initialiser: every caller sits under
 * MapShellLoader, which is ssr:false, so this only ever renders in a
 * browser.
 */

type Installable = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED = "onw_install_dismissed";

export default function InstallApp() {
  const [env] = useState(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // Safari's own, non-standard and still the only one it sets.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    return { standalone, ios };
  });

  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISSED) === "1";
    } catch {
      return false;
    }
  });

  /**
   * Chrome fires this before it would have shown its own banner, and only
   * once. Caught here so the offer can be made somewhere it makes sense
   * instead of over the top of the map.
   */
  const [prompt, setPrompt] = useState<Installable | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Installable);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (env.standalone || dismissed) return null;
  if (!prompt && !env.ios) return null;

  function close() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED, "1");
    } catch {
      // Declining to remember it is survivable; it reappears next visit.
    }
  }

  return (
    <section
      className="reveal relative mt-2 rounded-2xl border p-3.5"
      style={{ borderColor: "var(--brand)", background: "var(--sunk)" }}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Not now"
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--card)]"
      >
        <IconX size={12} />
      </button>

      <p className="pr-6 text-[13px] font-semibold">Keep {BRAND_NAME} on your home screen</p>
      <p className="mt-0.5 max-w-[46ch] text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
        Opens full screen with no address bar, which on a map is about a tenth of the screen back.
      </p>

      {prompt ? (
        <button
          type="button"
          className="btn btn-primary btn-sm mt-2.5"
          onClick={async () => {
            try {
              await prompt.prompt();
              await prompt.userChoice;
            } catch {
              // Chrome refuses a replayed prompt; the browser menu still has it.
            }
            setPrompt(null);
            close();
          }}
        >
          <IconPlus size={13} /> Add to home screen
        </button>
      ) : (
        <p className="mt-2 text-[11.5px] text-[var(--ink)]">
          Tap <span className="font-semibold">Share</span> at the bottom of Safari, then{" "}
          <span className="font-semibold">Add to Home Screen</span>.
        </p>
      )}
    </section>
  );
}
