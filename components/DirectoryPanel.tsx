"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconSearch } from "./Icons";

export type DirectoryFilter = {
  id: string;
  label: string;
  count?: number;
  /** Heading this sits under when the filters become a menu. */
  group?: string;
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
      {/* Raised, so the filter menu opens over the list rather than
          under it. The list is a sibling, not a parent, so it cannot
          clip the menu — only stack above it. */}
      <div className="relative z-20 flex-none pb-2.5">
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
 * Chips when there are a few, one menu when there are many.
 *
 * Not inconsistency — a threshold. Three options are faster to read than
 * to open, and a dropdown over them costs a tap to see what you could
 * already see. Eight is the opposite: at panel width they wrapped to
 * four rows of chrome above the list they were filtering, which on a
 * stack of sixteen people left room for one of them.
 *
 * The menu also fixes what shortening the labels could not. A flat row
 * implies every chip is the same kind of question. These are three
 * kinds — is this person worth my time, what can they help with, what
 * are they after — and a heading over each group is the whole
 * explanation, stated once instead of repeated on every chip.
 */
const INLINE_MAX = 4;

function FilterControl({
  filters,
  active,
  onPick,
}: {
  filters: DirectoryFilter[];
  active?: string;
  onPick?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  /** Dismissed by the two gestures everybody already knows. */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (filters.length <= INLINE_MAX) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const on = f.id === active;
          return (
            <button
              key={f.id}
              type="button"
              className="chip-toggle tap"
              data-on={on ? "true" : "false"}
              aria-pressed={on}
              onClick={() => onPick?.(f.id)}
            >
              {on && <IconCheck size={11} />}
              {f.label}
              {f.count != null && f.count > 0 && <span className="opacity-60">{f.count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  const current = filters.find((f) => f.id === active) ?? filters[0];
  /* The first entry is the reset — "Everyone", "Everywhere" — so anything
     else is a narrowing, and the control says so in colour. A filter you
     forgot you set is the one real hazard of putting them behind a menu. */
  const narrowing = current.id !== filters[0].id;

  /** Ungrouped first, then each heading once, in the order given. */
  const groups: Array<{ name: string | null; items: DirectoryFilter[] }> = [];
  for (const f of filters) {
    const name = f.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(f);
    else groups.push({ name, items: [f] });
  }

  return (
    <div ref={box} className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="chip-toggle tap w-full justify-between"
        data-on={narrowing ? "true" : "false"}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {narrowing && <IconCheck size={11} />}
          <span className="truncate">{current.label}</span>
          {current.count != null && current.count > 0 && <span className="opacity-60">{current.count}</span>}
        </span>
        <IconChevronDown size={13} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-[280px] overflow-y-auto rounded-xl border p-1"
          style={{
            background: "var(--card)",
            borderColor: "var(--line)",
            boxShadow: "var(--shadow-lift)",
          }}
        >
          {groups.map((g) => (
            <div key={g.name ?? "_"}>
              {g.name && (
                <p className="px-2 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  {g.name}
                </p>
              )}
              {g.items.map((f) => {
                const on = f.id === current.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      onPick?.(f.id);
                      setOpen(false);
                    }}
                    className="tap flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px]"
                    style={on ? { background: "color-mix(in srgb, var(--brand) 12%, transparent)" } : undefined}
                  >
                    <span className="w-3 flex-none" style={{ color: "var(--brand)" }}>
                      {on && <IconCheck size={12} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{f.label}</span>
                    {f.count != null && f.count > 0 && (
                      <span className="flex-none text-[11.5px] tabular-nums text-[var(--ink-soft)]">{f.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
