import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listThreads } from "@/lib/messages";

/** Every conversation you're in, including requests still waiting on you. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ threads: await listThreads(user.id) });
}
