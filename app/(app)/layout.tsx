import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import Avatar from "@/components/Avatar";

/** The normal website chrome — header + padded content — for everything that isn't a map. */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span
              className="grid h-8 w-8 place-items-center rounded-full text-white"
              style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-deep))" }}
            >
              ✦
            </span>
            <span className="text-[15px]">MagicPal</span>
          </Link>

          <nav className="flex items-center gap-1 text-[13px]">
            <Link href="/" className="rounded-full px-3 py-1.5 hover:bg-[var(--sunk)]">
              Map
            </Link>
            <Link href="/boards" className="rounded-full px-3 py-1.5 hover:bg-[var(--sunk)]">
              Boards
            </Link>
            {user ? (
              <Link href="/you" className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-[var(--sunk)]">
                <Avatar name={user.name ?? user.email} photoUrl={user.photoUrl} size={26} />
                <span className="hidden sm:inline">{user.name ? user.name.split(" ")[0] : "You"}</span>
              </Link>
            ) : (
              <Link href="/login" className="btn btn-primary btn-sm ml-1">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-57px)] max-w-5xl px-5 py-8">{children}</main>
    </>
  );
}
