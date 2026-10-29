import Link from "next/link";
import { LEGAL, LEGAL_EFFECTIVE } from "@/lib/legal";

/**
 * The two documents, at the bottom of the home panel.
 *
 * Deliberately at the end rather than in a menu: the agreement is taken
 * once at sign-up, and a consent that cannot be found again is one nobody
 * can act on — withdrawing one, or checking what you agreed to, begins
 * with being able to read it without asking anybody where it went.
 */
export default function LegalFooter() {
  return (
    <footer className="reveal mt-2 border-t border-[var(--line)] pt-3 text-[11.5px] text-[var(--ink-soft)]">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href="/terms" className="underline hover:text-[var(--ink)]">
          Terms &amp; Conditions
        </Link>
        <Link href="/privacy" className="underline hover:text-[var(--ink)]">
          Privacy Policy
        </Link>
        <a href={`mailto:${LEGAL.supportEmail}`} className="underline hover:text-[var(--ink)]">
          Contact
        </a>
      </p>
      <p className="mt-1.5 leading-[1.5]">
        In effect from {LEGAL_EFFECTIVE}. {LEGAL.brand} is operated by {LEGAL.operator}.
      </p>
    </footer>
  );
}
