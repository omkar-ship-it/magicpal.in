"use client";

import { IconCheck, IconSearch } from "./Icons";

/**
 * The shape every list in this app wants: search at the top, a row of
 * filters, one honest line about what you're looking at, then the list.
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
  filters?: Array<{ id: string; label: string; count?: number }>;
  activeFilter?: string;
  onFilter?: (id: string) => void;
  note?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none pb-2.5">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]">
            <IconSearch size={14} />
          </span>
          <input
            className="input pl-9"
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>

        {filters && filters.length > 1 && (
          // Wraps rather than scrolling sideways: a horizontal strip hides
          // its own tail, and the filter you want is always the hidden one.
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.map((f) => {
              const on = f.id === activeFilter;
              return (
                <button
                  key={f.id}
                  type="button"
                  className="chip-toggle tap"
                  data-on={on ? "true" : "false"}
                  aria-pressed={on}
                  onClick={() => onFilter?.(f.id)}
                >
                  {on && <IconCheck size={11} />}
                  {f.label}
                  {f.count != null && f.count > 0 && (
                    <span className="opacity-60">{f.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {note && (
          <p className="mt-2 text-[12px] leading-[1.45] text-[var(--ink-soft)]">{note}</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      {footer && <div className="flex-none pt-2.5">{footer}</div>}
    </div>
  );
}
