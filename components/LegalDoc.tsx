import Link from "next/link";
import { LEGAL, LEGAL_EFFECTIVE, LEGAL_VERSION } from "@/lib/legal";

/**
 * Shared chrome for the two documents nobody reads until they need to.
 *
 * Which is the whole design brief: somebody opens one of these because they
 * are worried about something specific — who can see where I am, how do I
 * delete this, who do I complain to — so the headings are the questions
 * rather than the clause numbers, and the two documents cross-link at every
 * point where one defers to the other.
 */
export default function LegalDoc({
  title,
  summary,
  other,
  children,
}: {
  title: string;
  summary: string;
  other: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <article className="legal mx-auto max-w-[72ch] pb-20">
      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--brand)" }}>
        {LEGAL.brand}
      </p>
      <h1 className="mt-1 text-[30px] font-semibold leading-tight">{title}</h1>
      <p className="mt-2 text-[14px] leading-[1.6] text-[var(--ink-soft)]">{summary}</p>
      <p className="mt-3 text-[12px] text-[var(--ink-soft)]">
        In effect from {LEGAL_EFFECTIVE} · version <span className="mono">{LEGAL_VERSION}</span> ·{" "}
        <Link href={other.href} className="underline">
          {other.label}
        </Link>
      </p>
      <hr className="mt-6 border-[var(--line)]" />
      {children}
    </article>
  );
}

/** One numbered section. The number is for citing it, not for reading order. */
export function Clause({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8" id={`s${n}`}>
      <h2 className="text-[17px] font-semibold leading-snug">
        <span className="mono mr-2 text-[13px] text-[var(--ink-soft)]">{n}</span>
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-[14px] leading-[1.65]">{children}</div>
    </section>
  );
}
