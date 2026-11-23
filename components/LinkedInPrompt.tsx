"use client";

import { useEffect, useRef, useState } from "react";
import { LINKEDIN_HELP, normalizeLinkedin } from "@/lib/linkedinProfile";

/**
 * LinkedIn is now required of every member and shown on their profile.
 * People who joined before that are asked once per visit-day, over the map,
 * with one field — they keep their place on the map either way, and
 * "Later" waits until tomorrow.
 */

const LATER_KEY = "li_prompt_later";
const today = () => new Date().toISOString().slice(0, 10);

export default function LinkedInPrompt({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    try {
      if (localStorage.getItem(LATER_KEY) === today()) return;
    } catch {
      /* private mode: ask anyway */
    }
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (alive && json?.profile && !json.profile.linkedinUrl) setOpen(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  if (!open) return null;

  const later = () => {
    try {
      localStorage.setItem(LATER_KEY, today());
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end p-3 sm:place-items-center" role="dialog" aria-modal="true" aria-label="Add your LinkedIn">
      <button type="button" aria-label="Later" className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={later} />
      <form
        className="relative w-full max-w-[24rem] rounded-[22px] bg-[var(--card)] p-5 shadow-[var(--shadow-lift)]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!normalizeLinkedin(value)) {
            setError(LINKEDIN_HELP);
            input.current?.focus();
            return;
          }
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/profile/linkedin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ linkedinUrl: value }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Couldn't save that.");
            setOpen(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save that.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0A66C2] text-[18px] font-bold text-white" aria-hidden="true">
          in
        </span>
        <h2 className="mt-3 text-[18px] font-semibold leading-snug">Add your LinkedIn</h2>
        <p className="mt-1 text-[13px] leading-[1.5] text-[var(--ink-soft)]">
          Everyone&rsquo;s LinkedIn is now on their profile, so people know who they&rsquo;re meeting. Takes ten seconds.
        </p>
        <input
          ref={input}
          className="input mt-4"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
          placeholder="linkedin.com/in/your-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Your LinkedIn profile link"
        />
        {error && (
          <p className="mt-2 text-[12.5px] font-medium" style={{ color: "var(--warn)" }}>
            {error}
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={later}>
            Later
          </button>
        </div>
      </form>
    </div>
  );
}
