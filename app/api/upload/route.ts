import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionUser } from "@/lib/session";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * An image for a feed post.
 *
 * Separate from /api/profile/photo, which writes the uploaded URL straight
 * onto the user's row. This one only hands the URL back — the post isn't
 * created until the composer submits, so an abandoned draft leaves a stray
 * blob rather than a half-written row.
 *
 * Signed-in members only. An open upload endpoint is free file hosting for
 * whoever finds it.
 */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Image uploads aren't configured." }, { status: 503 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "That isn't an image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Keep it under 5MB." }, { status: 400 });

  const blob = await put(`posts/${user.id}-${Date.now()}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return NextResponse.json({ ok: true, url: blob.url });
}
