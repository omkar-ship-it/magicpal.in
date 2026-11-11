"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronLeft, IconChevronRight, IconSearch } from "./Icons";

export type DirectoryFilter = {
  id: string;
  label: string;
  count?: number;
  /** The axis in words, for the chip's accessible name. */
  group?: string;
  /** The axis in colour. See the note on Facet in lib/directory. */
  tone?: "need" | "offer";
};

/**
 * The shape every list in this app wants: search at the top, a way to
 * narrow, one honest line about what you're looking at, then the list.
 *
 * Pulled out rather than repeated because the three windows that need it —
 * People, Events, Chats — had drifted into three different treatments of
 * the same job, and a group of two hundred is unusable without a search box
 * whichever window you're in.
 *
 * The line under the filters is the part that's easy to leave out and
 * shouldn't be: a directory that silently omits the forty people who keep
 * themselves off the map is lying about its own completeness.
 */
export default function DirectoryPanel({
  query,
  onQuery,
  placeholder,
  filters,
  activeFilter,
  onFilter,
  note,
  footer,
  children,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  /** Omitted entirely for Chats, where there is nothing to filter by. */
  filters?: DirectoryFilter[];
  activeFilter?: string;
  onFilter?: (id: string) => void;
  note?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex-none pb-2.5">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]">
            <IconSearch size={14} />
          </span>
          <input
            className="input input-icon"
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>

        {filters && filters.length > 1 && (
          <FilterControl filters={filters} active={activeFilter} onPick={onFilter} />
        )}

        {note && <p className="mt-2 text-[12px] leading-[1.45] text-[var(--ink-soft)]">{note}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      {footer && <div className="flex-none pt-2.5">{footer}</div>}
    </div>
  );
}

/**
 * One row of chips that scrolls sideways, and admits that it does.
 *
 * The standing objection to a horizontal rail is that it hides its own
 * tail, so the filter you want is always the one off-screen. That is a
 * real failure of rails that are built carelessly, and it is a problem
 * with affordances rather than with the idea: a fade at each live edge
 * says there is more that way, arrows move it a screenful at a time
 * where there is a pointer to use them, and the active chip is scrolled
 * back into view so a narrowing you set earlier is never invisible.
 *
 * What the rail buys over a menu is that the options are *there*. A
 * dropdown costs a tap before anything can be read, and on the one
 * surface whose job is "show me these sixteen people" that tap is the
 * whole interaction. Chips are also direct: see it, hit it.
 *
 * The axis is carried in colour instead of a heading, because a heading
 * needs a second row and the row is the point. Green is what somebody
 * can help with, red is what they are after — the same two colours the
 * person cards directly underneath print those words in, so the code is
 * taught on the same screen it is used on. `group` repeats it in words
 * for the accessible name, since colour alone never carries meaning.
 */
function FilterControl({
  filters,
  active,
  onPick,
}: {
  filters: DirectoryFilter[];
  active?: string;
  onPick?: (id: string) => void;
}) {
  const rail = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    // A couple of pixels of slack: sub-pixel widths otherwise leave a
    // fade showing on a rail that is already at its end.
    setEdges({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure, filters.length]);

  /** Bring the current filter back into view, so one set earlier and
   *  scrolled past is never a narrowing you cannot see. */
  useEffect(() => {
    const el = rail.current?.querySelector('[data-on="true"]') as HTMLElement | null;
    el?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [active]);

  const nudge = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth - 72, 120), behavior: "smooth" });
  };

  return (
    <div className="relative mt-2">
      <div ref={rail} className="scroll-none flex gap-1.5 overflow-x-auto scroll-smooth pb-0.5">
        {filters.map((f) => {
          const on = f.id === active;
          const tint = f.tone === "offer" ? "var(--offer)" : f.tone === "need" ? "var(--need)" : null;
          return (
            <button
              key={f.id}
              type="button"
              className="chip-toggle tap flex-none"
              data-on={on ? "true" : "false"}
              aria-pressed={on}
              // Colour never carries the axis on its own.
              aria-label={f.group ? `${f.label} — ${f.group.toLowerCase()}` : f.label}
              title={f.group}
              onClick={() => onPick?.(f.id)}
              /**
               * Selected is a fill; unselected is an outline. Shape, not
               * hue — the default active colour and the "can help with"
               * tone are nearly the same green in dark mode, so a reader
               * could not tell a selected chip from an offer chip by
               * colour alone.
               *
               * The fill's text is `--card`, the panel's own background:
               * the tones are dark in the light theme and light in the
               * dark one, and the surface colour is the only value that
               * is guaranteed to contrast with all of them in both.
               */
              style={
                on
                  ? { borderColor: tint ?? "var(--good)", background: tint ?? "var(--good)", color: "var(--card)" }
                  : tint
                    ? { borderColor: `color-mix(in srgb, ${tint} 38%, var(--line))`, color: tint }
                    : undefined
              }
            >
              {on && <IconCheck size={11} />}
              {f.label}
              {f.count != null && f.count > 0 && <span className="opacity-60">{f.count}</span>}
            </button>
          );
        })}
      </div>

      {/* The tail, made visible. Each edge only appears when there is
          genuinely more that way, so an empty fade never implies content
          that is not there. */}
      <Edge side="left" show={edges.left} onNudge={() => nudge(-1)} />
      <Edge side="right" show={edges.right} onNudge={() => nudge(1)} />
    </div>
  );
}

/**
 * A fade everywhere, plus an arrow where there is a pointer to use it.
 *
 * A phone swipes the rail and needs no button; a laptop with a plain
 * mouse has no horizontal gesture at all, which is the case where a rail
 * genuinely does strand its tail.
 */
function Edge({ side, show, onNudge }: { side: "left" | "right"; show: boolean; onNudge: () => void }) {
  if (!show) return null;
  const isLeft = side === "left";
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-10"
        style={{
          [isLeft ? "left" : "right"]: 0,
          background: `linear-gradient(to ${isLeft ? "right" : "left"}, var(--card), transparent)`,
        }}
      />
      <button
        type="button"
        onClick={onNudge}
        aria-label={isLeft ? "Scroll filters left" : "Scroll filters right"}
        tabIndex={-1}
        className="absolute top-1/2 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full border sm:grid"
        style={{
          [isLeft ? "left" : "right"]: 0,
          background: "var(--card)",
          borderColor: "var(--line)",
          color: "var(--ink-soft)",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        {isLeft ? <IconChevronLeft size={13} /> : <IconChevronRight size={13} />}
      </button>
    </>
  );
}
