"use client";

/**
 * The shared furniture every detail page is built from.
 *
 * Event, community and profile pages each grew their own idea of a heading,
 * a stat, a section — so the same information sat at three different sizes
 * with three different spacings, and moving between them felt like moving
 * between products. One kit, used by all of them, is most of what "organised"
 * means here: the reader learns the shape once.
 *
 * Everything is presentational. Each page keeps its own data and decisions;
 * these only agree on how things look and how they arrive.
 */

/** A page's opening block: eyebrow chips, the name, a line about it. */
export function Hero({
  eyebrow,
  title,
  subtitle,
  meta,
  action,
  avatar,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  meta?: React.ReactNode;
  /** Edit, or anything else the owner can do from the top. */
  action?: React.ReactNode;
  /** A face or a mark, when the subject has one. */
  avatar?: React.ReactNode;
}) {
  return (
    <header className="reveal">
      {eyebrow && <div className="mb-2 flex flex-wrap items-center gap-1.5">{eyebrow}</div>}
      <div className="flex items-start gap-3.5">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 text-[19px] font-semibold leading-[1.2] tracking-[-0.02em]">{title}</h2>
            {action && <div className="flex-none">{action}</div>}
          </div>
          {subtitle && <p className="mt-1 text-[13px] leading-[1.5] text-[var(--ink-soft)]">{subtitle}</p>}
          {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">{meta}</div>}
        </div>
      </div>
    </header>
  );
}

/**
 * A labelled block.
 *
 * `quiet` renders the label only — for sections whose content is already
 * self-describing and where a heading would be the loudest thing in it.
 */
export function Section({
  title,
  icon,
  hint,
  aside,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  hint?: string;
  /** A count, a link, anything that belongs on the heading's right. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="reveal">
      <div className="mb-1.5 flex items-baseline gap-2">
        <p className="label label-icon m-0 flex-1">
          {icon}
          {title}
        </p>
        {aside && <span className="flex-none text-[11.5px] text-[var(--ink-soft)]">{aside}</span>}
      </div>
      {hint && <p className="mb-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">{hint}</p>}
      {children}
    </section>
  );
}

/** A sunken block for facts that belong together — when, where, how much. */
export function Facts({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl p-3.5" style={{ background: "var(--sunk)" }}>
      {children}
    </div>
  );
}

/** One line inside `Facts`: an icon, a strong value, a quieter detail. */
export function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-[1px] flex-none text-[var(--ink-soft)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold leading-[1.4]">{label}</p>
        {children && <div className="mt-0.5 flex flex-col gap-0.5">{children}</div>}
      </div>
    </div>
  );
}

/** The number row. Tap-through where a number leads somewhere. */
export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;
}

export function Stat({
  icon,
  value,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  tone?: "good" | "brand";
  onClick?: () => void;
}) {
  const color = tone === "good" ? "var(--good)" : tone === "brand" ? "var(--brand)" : "var(--ink)";
  const inner = (
    <>
      <span className="flex items-center justify-center gap-1.5" style={{ color }}>
        {icon}
        <span className="mono text-[17px] font-bold leading-none">{value}</span>
      </span>
      <span className="mt-1 block text-[11px] text-[var(--ink-soft)]">{label}</span>
    </>
  );
  const cls = "rounded-2xl p-2.5 text-center";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} lift tap`} style={{ background: "var(--sunk)" }}>
      {inner}
    </button>
  ) : (
    <div className={cls} style={{ background: "var(--sunk)" }}>
      {inner}
    </div>
  );
}

/** A tappable row — a person, an event, anything that opens something. */
export function Row({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="row-hit flex w-full items-center gap-2.5 rounded-xl px-1.5 py-2 text-left tap"
    >
      {children}
    </button>
  );
}

/** Wraps a page so its blocks arrive in sequence rather than all at once. */
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="reveal-seq flex flex-col gap-4">{children}</div>;
}
