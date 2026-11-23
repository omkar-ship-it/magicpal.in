"use client";

import { useCallback, useEffect, useState } from "react";
import { SECTORS, TOPICS } from "@/lib/intents";
import { MAX_INTERESTS, MAX_TOPICS } from "@/lib/rules";
import { GOALS, MAX_GOALS, fromGoals, suggestFor } from "@/lib/goals";
import { IconCheck } from "./Icons";
import GoalPicker from "./GoalPicker";

/**
 * The rest of the profile, asked later and one question at a time, right
 * where it pays off: at the top of For you. Whatever is still missing —
 * what you're here for, what you can help with, what you're into — comes
 * up as a single tap-to-pick question. Answer it and the next one (if any)
 * takes its place; "Not now" puts that question away until tomorrow.
 */

type Q = "goals" | "help" | "interests";
type Me = { headline: string; company: string; lookingFor: string[]; canHelpWith: string[]; interests: string[]; customLookingFor: string[] };

const SNOOZE = (q: Q) => `qs_snooze_${q}`;
const today = () => new Date().toISOString().slice(0, 10);
const snoozed = (q: Q) => {
  try {
    return localStorage.getItem(SNOOZE(q)) === today();
  } catch {
    return false;
  }
};

export default function QuickSignals({ onSaved, standalone = false }: { onSaved: () => void; standalone?: boolean }) {
  const [me, setMe] = useState<Me | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const json = await fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    const p = json?.profile;
    if (p) setMe({ headline: p.headline ?? "", company: p.company ?? "", lookingFor: p.lookingFor ?? [], canHelpWith: p.canHelpWith ?? [], interests: p.interests ?? [], customLookingFor: p.customLookingFor ?? [] });
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  if (!me) return null;
  const q: Q | null = !me.lookingFor.length && !me.customLookingFor.length && !snoozed("goals") ? "goals" : !me.canHelpWith.length && !snoozed("help") ? "help" : !me.interests.length && !snoozed("interests") ? "interests" : null;
  if (!q) return null;

  const sug = suggestFor(me.headline, me.company, []);
  const options =
    q === "goals"
      ? GOALS.map((g) => ({ id: g.id, label: `${g.emoji} ${g.label}` }))
      : q === "help"
        ? [...new Set([...sug.help, ...TOPICS.map((t) => t.id)])].map((id) => ({ id, label: TOPICS.find((t) => t.id === id)?.offer ?? id }))
        : [...new Set([...sug.interests, ...SECTORS.map((s) => s.id)])].map((id) => ({ id, label: SECTORS.find((s) => s.id === id)?.label ?? id }));
  const max = q === "goals" ? MAX_GOALS : q === "help" ? MAX_TOPICS : MAX_INTERESTS;
  const title = q === "goals" ? "What brings you here?" : q === "help" ? "What could you help people with?" : "What are you into?";
  const sub =
    q === "goals"
      ? "Pick up to three, or add your own — it's how we pick who to show you."
      : q === "help"
        ? "Tap what you'd be glad to be asked about. People who need it will find you."
        : "Tap a few. Two people into the same thing are worth introducing.";

  const save = async () => {
    if (!picked.length && !typed.length) return;
    setBusy(true);
    setError("");
    const goals = fromGoals(picked);
    const body =
      q === "goals"
        ? {
            lookingFor: goals.lookingFor,
            // Merged, never replaced: what they already said stays.
            ...(goals.canHelpWith.length ? { canHelpWith: [...new Set([...me.canHelpWith, ...goals.canHelpWith])] } : {}),
            customLookingFor: [...new Set([...me.customLookingFor, ...goals.phrases, ...typed])],
          }
        : q === "help"
          ? { canHelpWith: picked }
          : { interests: picked };
    try {
      const res = await fetch("/api/profile/signals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save that.");
      setPicked([]);
      setTyped([]);
      await refresh();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`card p-4 ${standalone ? "" : ""}`} style={{ background: "color-mix(in srgb, var(--brand) 6%, var(--card))" }}>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--brand)]">SHARPER INTROS · ONE TAP</p>
      <h3 className="mt-1 text-[15.5px] font-semibold leading-snug">{title}</h3>
      <p className="mt-0.5 text-[12.5px] leading-[1.45] text-[var(--ink-soft)]">{sub}</p>
      {q === "goals" ? (
        <div className="mt-3">
          <GoalPicker
            selected={picked}
            typed={typed}
            max={MAX_GOALS}
            onToggle={(id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length + typed.length >= MAX_GOALS ? p : [...p, id]))}
            onAddTyped={(t) => setTyped((x) => (x.some((y) => y.toLowerCase() === t.toLowerCase()) ? x : [...x, t]))}
            onRemoveTyped={(t) => setTyped((x) => x.filter((y) => y !== t))}
          />
        </div>
      ) : (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = picked.includes(o.id);
          const full = !on && picked.length >= max;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              disabled={full}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== o.id) : [...p, o.id]))}
              className="tap flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: on ? "var(--brand)" : "var(--line)",
                background: on ? "color-mix(in srgb, var(--brand) 12%, var(--card))" : "var(--card)",
                color: on ? "var(--brand-deep)" : "var(--ink)",
              }}
            >
              {on && <IconCheck size={12} />}
              {o.label}
            </button>
          );
        })}
      </div>
      )}
      {error && (
        <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--warn)" }}>
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || (!picked.length && !typed.length)} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            try {
              localStorage.setItem(SNOOZE(q), today());
            } catch {
              /* ignore */
            }
            setPicked([]);
            setTyped([]);
            setTick((t) => t + 1);
          }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}
