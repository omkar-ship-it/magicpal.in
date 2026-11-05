import Link from "next/link";
import { LEGAL, LEGAL_EFFECTIVE, LEGAL_VERSION, copyrightLine } from "@/lib/legal";

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
      <p className="mt-12 border-t border-[var(--line)] pt-4 text-[12px] text-[var(--ink-soft)]">
        {copyrightLine()}
      </p>
    </article>
  );
}

/**
 * A notice that has to be read, not found.
 *
 * Above the numbered clauses and visually separated from them, because the
 * one thing a disclosure of this kind has to be is conspicuous — a term
 * buried at §17 that materially changes what somebody is signing up to is
 * the definition of an unfair one, and a court in any of the jurisdictions
 * here will treat it as such.
 *
 * Unnumbered on purpose. The clauses cross-reference each other by number
 * ("see §12"), so inserting one in the middle would silently point a dozen
 * references at the wrong text.
 */
export function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="mt-6 rounded-2xl p-4"
      id="early"
      style={{
        background: "color-mix(in srgb, var(--brand) 7%, var(--card))",
        border: "1px solid color-mix(in srgb, var(--brand) 35%, transparent)",
      }}
    >
      <h2 className="text-[15px] font-semibold leading-snug" style={{ color: "var(--brand)" }}>
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-2.5 text-[13.5px] leading-[1.6]">{children}</div>
    </section>
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
