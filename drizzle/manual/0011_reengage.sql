-- Re-engagement email: the opt-out, and the frequency cap.
--
-- Additive only. Three nullable-or-defaulted columns on an existing
-- table, safe to apply while the old code is running — nothing reads
-- them until the deploy that does.
--
-- An OTP is transactional: you asked for it two seconds ago and it is
-- the only way in. A "here is what you missed" email is not, and the
-- difference is the whole reason these columns exist. It needs a way out
-- that costs one click and no login, and it needs to be incapable of
-- arriving twice in a week even if somebody runs the job twice.

-- One click, no login, from a link in the footer of every one of these.
-- A random token rather than the user id: the id appears in URLs the
-- person's own browser history and any forwarded email would carry, and
-- an unsubscribe endpoint keyed on a guessable value is an endpoint
-- anybody can use to silence anybody.
alter table users add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

-- Set the moment somebody unsubscribes. Null means they have not.
-- Checked on every send, never cleared by the sender — only the person
-- themselves can undo it, from their own settings.
alter table users add column if not exists email_optout_at timestamptz;

-- When we last sent one. The frequency cap reads this and nothing else,
-- so a job that runs twice, or two jobs racing, cannot double-send: the
-- row is stamped in the same statement that selects it.
alter table users add column if not exists reengaged_at timestamptz;

-- The selection query: onboarded, not opted out, idle, and not recently
-- mailed. Partial on the opt-out because that half never needs scanning.
create index if not exists users_reengage_idx
  on users (last_active_at, reengaged_at)
  where email_optout_at is null;

create unique index if not exists users_unsubscribe_token_idx
  on users (unsubscribe_token);
