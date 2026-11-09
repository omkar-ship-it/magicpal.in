-- Sign in with LinkedIn.
--
-- The subject claim, not the profile URL: `sub` is LinkedIn's stable,
-- opaque id for a member and is the only thing that survives a name
-- change, a vanity-URL change or a second account. Nullable because the
-- email flow predates it and most rows will never have one.
--
-- Unique so two accounts can never claim the same LinkedIn member —
-- which is the whole security property of linking by it rather than by
-- a name match.
alter table users add column if not exists linkedin_sub text;

create unique index if not exists users_linkedin_sub_idx
  on users (linkedin_sub)
  where linkedin_sub is not null;
