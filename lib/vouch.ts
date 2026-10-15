import { sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { memberships } from "./db/schema";
import { MEMBER_ACTIVE } from "./membership";

/**
 * Who, among these people, a community you're both in has vouched for.
 *
 * The badge has one meaning everywhere it appears: *a group you both
 * belong to says this person is who they claim to be*. That is why it is
 * computed against the viewer rather than read off a single board — on the
 * open map there is no board in scope, and a tick with no community behind
 * it would be an assertion from nobody.
 *
 * It also means the badge can't be farmed: somebody verified in a group you
 * have never heard of shows you nothing, because the claim is only worth
 * what the claimant is worth to you.
 *
 * One query for the whole page. The alternative — asking per person — is
 * two hundred round trips to render one list.
 */
export async function vouchedBy(viewerId: string | undefined, personIds: string[]): Promise<Set<string>> {
  if (!hasDb || !db || !viewerId || personIds.length === 0) return new Set();

  const rows = await db.execute<{ user_id: string }>(sql`
    select distinct theirs.user_id
      from ${memberships} mine
      join ${memberships} theirs on theirs.board_id = mine.board_id
     where mine.user_id = ${viewerId}
       and mine.status = ${MEMBER_ACTIVE}
       and theirs.status = ${MEMBER_ACTIVE}
       and theirs.verified_at is not null
       and theirs.user_id in ${personIds}
  `);

  // drizzle's execute returns either rows or a {rows} wrapper depending on
  // the driver, so normalise rather than trusting one shape.
  const out = (Array.isArray(rows) ? rows : ((rows as { rows?: Array<{ user_id: string }> }).rows ?? [])) as Array<{
    user_id: string;
  }>;
  return new Set(out.map((r) => r.user_id));
}

/** Stamp `verified` onto whatever list of people is about to be sent out. */
export async function attachVouches<T extends { id: string }>(
  people: T[],
  viewerId: string | undefined
): Promise<Array<T & { verified: boolean }>> {
  const vouched = await vouchedBy(
    viewerId,
    people.map((p) => p.id)
  );
  return people.map((p) => ({ ...p, verified: vouched.has(p.id) }));
}
