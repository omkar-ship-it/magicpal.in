"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconX } from "./Icons";

/**
 * "This changed" — shown once, dismissed forever, blocking nothing.
 *
 * The privacy policy promises that nothing is edited silently and that a
 * change which does not alter what somebody agreed to gets a notice
 * rather than a fresh consent prompt. This is that notice, and it is the
 * whole of the product's side of that promise, so it has to actually be
 * seen: it sits above the map rather than inside a panel somebody may
 * never open.
 *
 * It is not a cookie banner and deliberately does not behave like one.
 * There is no "accept" — agreeing is not being asked for, and a button
 * that says Accept on something nobody is consenting to is the dark
 * pattern this is trying not to be. Dismissing it means "I have seen
 * this", which is exactly what it claims.
 *
 * Dismissal lives in localStorage keyed by the version, so a later
 * change shows a new notice rather than being swallowed by an old
 * dismissal. Losing that key only costs somebody seeing a true statement
 * twice, which is the right way for this to fail.
 */
export default function LegalNotice({ version }: { version: string }) {
  const key = `legal-seen-${version}`;
  // Starts hidden and is revealed by the effect: rendering it on the
  // server would flash the notice for a moment on every load for people
  // who dismissed it months ago.
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) setShow(true);
    } catch {
      // Private mode, blocked storage. Showing it is the safe failure.
      setShow(true);
    }
  }, [key]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-2 pt-2">
      <div
        role="status"
        className="pointer-events-auto flex max-w-[560px] items-start gap-2 rounded-2xl border px-3 py-2.5 backdrop-blur"
        style={{
          background: "color-mix(in srgb, var(--card) 96%, transparent)",
          borderColor: "var(--line)",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        <p className="min-w-0 flex-1 text-[12.5px] leading-[1.5]">
          We&rsquo;ve updated our{" "}
          <Link href="/privacy" className="font-semibold underline">
            privacy policy
          </Link>
          . We now use Google Analytics to count how the map is used — what that involves, and how to stop it,
          is in §10. Nothing you need to do.
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          className="tap -mr-0.5 flex-none rounded-lg p-1"
          style={{ color: "var(--ink-soft)" }}
          onClick={() => {
            try {
              localStorage.setItem(key, "1");
            } catch {
              // Can't remember it; it will show again. Still dismiss now.
            }
            setShow(false);
          }}
        >
          <IconX size={13} />
        </button>
      </div>
    </div>
  );
}
