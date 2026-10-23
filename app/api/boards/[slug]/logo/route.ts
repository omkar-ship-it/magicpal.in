import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { liveBoardBySlug } from "@/lib/boards";

/**
 * A board's logo. The host only, same rule as every other board edit.
 *
 * Separate from PATCH because this is multipart rather than JSON, and
 * because the old blob has to be deleted after the row is updated — the
 * same shape as the profile-photo route, for the same reasons.
 */
const MAX_BYTES = 2 * 1024 * 1024;

/** Host-only, and the board has to be live — an archived one is gone. */
async function hostedBoard(slug: string) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  const board = await liveBoardBySlug(slug);
  if (!board) return { error: NextResponse.json({ error: "No such board." }, { status: 404 }) };
  if (board.hostUserId !== user.id) {
    return { error: NextResponse.json({ error: "Only the host can change the logo." }, { status: 403 }) };
  }
  return { board };
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Uploads need blob storage configured." }, { status: 503 });
  }
  const { slug } = await ctx.params;
  const { board, error } = await hostedBoard(slug);
  if (error) return error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "That isn't an image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Keep it under 2MB." }, { status: 400 });

  const blob = await put(`board-logos/${board.id}-${Date.now()}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const previous = board.logoUrl;
  await db.update(boards).set({ logoUrl: blob.url }).where(eq(boards.id, board.id));
  // Best-effort: a stranded blob costs pennies, a failed request costs the
  // host their new logo.
  if (previous) await del(previous).catch(() => {});

  return NextResponse.json({ ok: true, logoUrl: blob.url });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  const { slug } = await ctx.params;
  const { board, error } = await hostedBoard(slug);
  if (error) return error;

  const previous = board.logoUrl;
  await db.update(boards).set({ logoUrl: null }).where(eq(boards.id, board.id));
  if (previous) await del(previous).catch(() => {});

  return NextResponse.json({ ok: true });
}
