-- Your own words beside the fixed vocabulary, and a mark for a board.
--
-- Written by hand rather than left to `drizzle-kit push` because this
-- machine's resolver intermittently REFUSES the Neon endpoint host, and a
-- push that cannot connect still exits quietly — the columns were simply
-- absent afterwards. Checking the catalogue, not the command's output, is
-- the only way to know a schema change landed (see §6.2 and §8).
--
-- Additive and idempotent: every statement is IF NOT EXISTS, the arrays
-- default to empty so existing rows need no backfill, and nothing here
-- rewrites a row.

alter table users add column if not exists custom_looking_for  text[] not null default '{}'::text[];
alter table users add column if not exists custom_can_help_with text[] not null default '{}'::text[];
alter table users add column if not exists custom_interests     text[] not null default '{}'::text[];

alter table boards add column if not exists logo_url text;
