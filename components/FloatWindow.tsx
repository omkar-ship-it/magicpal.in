"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX } from "./Icons";

export type WindowState = {
  open: boolean;
  min: boolean;
  max: boolean;
  x: number;
  y: number;
  z: number;
};

export const DEFAULT_WINDOW: WindowState = { open: false, min: false, max: false, x: 0, y: 0, z: 1 };

/**
 * A panel that floats over the map instead of hanging off the dock.
 *
 * The dock opens windows; it doesn't own them. Several can be up at once —
 * the point of a map with people on it is comparing things side by side,
 * and a single slot that swaps content makes you close the thing you were
 * reading to look at the thing you want to compare it with.
 *
 * Dragged by pointer events rather than a library: this needs about forty
 * lines, and pointer events already unify mouse, touch and pen, which is
 * most of what a drag library is for.
 */
export default function FloatWindow({
  title,
  state,
  onChange,
  onClose,
  onFocus,
  children,
  width = 380,
}: {
  title: React.ReactNode;
  state: WindowState;
  onChange: (next: Partial<WindowState>) => void;
  onClose: () => void;
  onFocus: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Buttons in the title bar must not start a drag, or the close
      // control becomes a one-pixel nudge instead of a close.
      if ((e.target as HTMLElement).closest("button")) return;
      if (state.max) return;
      onFocus();
      drag.current = { dx: e.clientX - state.x, dy: e.clientY - state.y };
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [state.x, state.y, state.max, onFocus]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      const w = ref.current?.offsetWidth ?? width;
      // Clamped so a window can always be grabbed again: at least part of
      // the title bar stays on screen in every direction.
      const x = Math.min(Math.max(e.clientX - drag.current.dx, -(w - 120)), window.innerWidth - 120);
      const y = Math.min(Math.max(e.clientY - drag.current.dy, 0), window.innerHeight - 90);
      onChange({ x, y });
    },
    [onChange, width]
  );

  const endDrag = useCallback(() => {
    drag.current = null;
    setDragging(false);
  }, []);

  // A window dropped off-screen by a resize is unreachable, so pull it back.
  useEffect(() => {
    const onResize = () => {
      const x = Math.min(state.x, window.innerWidth - 140);
      const y = Math.min(state.y, window.innerHeight - 90);
      if (x !== state.x || y !== state.y) onChange({ x, y });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [state.x, state.y, onChange]);

  if (!state.open) return null;

  const maximised = state.max;

  return (
    <div
      ref={ref}
      className="floating-panel panel-enter pointer-events-auto absolute flex flex-col overflow-hidden"
      role="dialog"
      aria-label={typeof title === "string" ? title : undefined}
      onMouseDown={onFocus}
      style={
        maximised
          ? { left: 8, right: 8, top: 60, bottom: 86, zIndex: 30 + state.z }
          : {
              left: state.x,
              top: state.y,
              width,
              maxWidth: "calc(100vw - 16px)",
              maxHeight: state.min ? undefined : "min(62dvh, 540px)",
              zIndex: 30 + state.z,
              // Dropped while dragging so a fast pointer doesn't lag the
              // window behind it.
              transition: dragging ? "none" : undefined,
            }
      }
    >
      <div
        className="flex flex-none cursor-grab items-center gap-2 border-b border-[var(--line)] px-2.5 py-2 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: "none" }}
      >
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{title}</span>

        <button
          type="button"
          className="win-dot"
          onClick={() => onChange({ min: !state.min, max: false })}
          aria-label={state.min ? "Restore" : "Minimise"}
          title={state.min ? "Restore" : "Minimise"}
        >
          <span className="block h-[2px] w-[9px] rounded-full" style={{ background: "currentColor" }} />
        </button>
        <button
          type="button"
          className="win-dot"
          onClick={() => onChange({ max: !state.max, min: false })}
          aria-label={state.max ? "Restore down" : "Maximise"}
          title={state.max ? "Restore down" : "Maximise"}
        >
          <span
            className="block h-[9px] w-[9px] rounded-[2px]"
            style={{ border: "1.5px solid currentColor" }}
          />
        </button>
        <button type="button" className="win-dot" onClick={onClose} aria-label="Close" title="Close">
          <IconX size={11} />
        </button>
      </div>

      {!state.min && <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">{children}</div>}
    </div>
  );
}
