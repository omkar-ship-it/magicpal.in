import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listMessages, sendMessage } from "@/lib/messages";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const connectionId = new URL(req.url).searchParams.get("connectionId");
  if (!connectionId) return NextResponse.json({ error: "Which conversation?" }, { status: 400 });

  // Null means the connection doesn't exist *or* this person isn't in it.
  // Deliberately the same 404 for both: distinguishing them would confirm
  // that two other people are connected.
  const messages = await listMessages(connectionId, user.id);
  if (!messages) return NextResponse.json({ error: "No such conversation." }, { status: 404 });
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const connectionId = typeof body?.connectionId === "string" ? body.connectionId : "";
  const text = typeof body?.body === "string" ? body.body : "";
  if (!connectionId) return NextResponse.json({ error: "Which conversation?" }, { status: 400 });

  const result = await sendMessage(connectionId, user.id, text);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
