import { eq, sql, type SQL } from "drizzle-orm";
import { memberships } from "./db/schema";

/**
 * What it means to be *in* a community, defined exactly once.
 *
 * A membership row is not the same thing as a membership. Somebody who left
 * and somebody the owner removed both still have rows — that is the whole
 * point of the tombstone — so every read that means "is this person in the
 * community" has to say `status = 'active'` and not merely "a row exists".
 *
 * There are eleven such reads across boards, profiles, posts, feed and the
 * pins audience check. Eleven chances to forget, and forgetting any one of
 * them means a removed person keeps seeing the thing they were removed
 * from — including, in the pins case, other members' live locations. So the
 * condition lives here and nothing is allowed to spell it out inline.
 */

export const MEMBER_ACTIVE = "active";
export const MEMBER_LEFT = "left";
export const MEMBER_REMOVED = "removed";

/** For drizzle `where(...)` clauses against the `memberships` table. */
export function isActiveMember(): SQL {
  return eq(memberships.status, MEMBER_ACTIVE)!;
}

/**
 * For raw SQL subqueries, where the table carries an alias.
 *
 * Takes the alias rather than returning a bare fragment so a caller can't
 * accidentally apply it to the wrong side of a self-join — which is exactly
 * the mistake available in the pins audience check, where `mine` and
 * `theirs` are the same table twice and both need gating.
 */
export function activeAliasSql(alias: string): SQL {
  return sql.raw(`${alias}.status = '${MEMBER_ACTIVE}'`);
}

/** Whether a membership row, already loaded, counts as being in the group. */
export function isActive(row: { status?: string | null } | null | undefined): boolean {
  return row?.status === MEMBER_ACTIVE;
}
