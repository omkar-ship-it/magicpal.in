import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { boardsForUser, publicEvents } from "@/lib/boards";
import CreateBoard from "@/components/CreateBoard";
import { IconCalendar, IconPeople, IconPlus } from "@/components/Icons";

export default async function BoardsPage({ searchParams }: { searchParams: Promise<{ create?: string }> }) {
  const { create } = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/boards")}`);
  }

  const mine = await boardsForUser(user.id);
  const myIds = new Set(mine.map((b) => b.id));
  // Public events the viewer isn't already on — the one way to find a board
  // without being handed a link, and the only reason this page isn't purely
  // a list of things you already belong to.
  const open = (await publicEvents()).filter((b) => !myIds.has(b.id));

  const creating = create === "1" || mine.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Boards</h1>
          <p className="mt-1 text-[13.5px] text-[var(--ink-soft)]">
            An event or a community, a QR code, and the people on it.
          </p>
        </div>
        {!creating && (
          <Link href="/boards?create=1" className="btn btn-primary btn-sm">
            <IconPlus size={13} /> New board
          </Link>
        )}
      </header>

      {creating && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold">
            {mine.length === 0 ? "Start with one" : "New board"}
          </h2>
          <CreateBoard />
        </section>
      )}

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold">Yours</h2>
          <ul className="flex flex-col gap-2">
            {mine.map((b) => (
              <li key={b.id}>
                <Link href={`/b/${b.slug}`} className="card flex items-center gap-3 p-3.5 tap">
                  <span
                    className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                    style={{
                      background: "var(--sunk)",
                      color: b.type === "event" ? "var(--layer-event)" : "var(--brand)",
                    }}
                  >
                    {b.type === "event" ? <IconCalendar size={16} /> : <IconPeople size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate text-[14px] font-semibold">{b.name}</span>
                      {b.role === "host" && (
                        <span className="pill" style={{ background: "var(--sunk)", color: "var(--ink-soft)" }}>
                          You host
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[12.5px] text-[var(--ink-soft)]">
                      {b.place ? `${b.place} · ` : ""}
                      {b.startsAt
                        ? `${b.startsAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · `
                        : ""}
                      {b.memberCount} {b.memberCount === 1 ? "member" : "members"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open.length > 0 && (
        <section>
          <h2 className="mb-1 text-[15px] font-semibold">Open to anyone</h2>
          <p className="mb-3 text-[12.5px] text-[var(--ink-soft)]">
            Public events. Community boards are invite-only by design and never listed here.
          </p>
          <ul className="flex flex-col gap-2">
            {open.map((b) => (
              <li key={b.id}>
                <Link href={`/b/${b.slug}`} className="card flex items-center gap-3 p-3.5 tap">
                  <span
                    className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                    style={{ background: "var(--sunk)", color: "var(--layer-event)" }}
                  >
                    <IconCalendar size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{b.name}</span>
                    <span className="block truncate text-[12.5px] text-[var(--ink-soft)]">
                      {b.place ? `${b.place} · ` : ""}
                      {b.startsAt?.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
