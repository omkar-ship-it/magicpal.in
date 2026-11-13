import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { unsubscribeByToken } from "@/lib/reengage";

/* Neutral, because metadata is resolved before the token is: a tab
   reading "Unsubscribed" above a page saying the link was not recognised
   is the one place this flow can contradict itself. */
export const metadata: Metadata = { title: `Email settings · ${BRAND_NAME}`, robots: { index: false } };

/**
 * One click, no login, no confirmation step.
 *
 * An unsubscribe that asks you to sign in first is an unsubscribe that
 * does not work — the people most likely to use it are exactly the ones
 * who no longer remember having an account. So the token in the link is
 * the whole authorisation, which is why it is random rather than the
 * user id (see drizzle/manual/0011).
 *
 * Acting on GET is normally wrong, and is right here: mail clients will
 * not POST, and the alternative is a page with a button that half of
 * them never reach. The cost of a prefetcher firing it is one person
 * stopping emails they asked to stop; the link says what it does.
 */
export default async function Unsubscribe({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const res = t ? await unsubscribeByToken(t) : { ok: false as const };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center gap-3 p-6">
      <h1 className="text-[20px] font-bold">{res.ok ? "Unsubscribed" : "Link not recognised"}</h1>
      <p className="text-[14px] leading-[1.55] text-[var(--ink-soft)]">
        {res.ok ? (
          <>
            We won&rsquo;t email {res.email} about what&rsquo;s happening on the map again. Sign-in codes still
            work — those are the only emails left, and you have to ask for each one.
          </>
        ) : (
          <>
            That link has expired or was already used. If you&rsquo;re still getting these, reply to the email and
            we&rsquo;ll stop them by hand.
          </>
        )}
      </p>
      <Link href="/" className="text-[14px] font-semibold text-[var(--brand)] hover:underline">
        Open {BRAND_NAME}
      </Link>
    </main>
  );
}
