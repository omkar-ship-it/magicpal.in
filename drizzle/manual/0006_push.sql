-- Web push: the address book, and two ways to make it stop.
--
-- Additive only. Every column has a default and the new table is empty, so
-- this is safe to apply to a live database while the old code is running:
-- nothing reads these until the deploy that does.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- The push service's URL for one device. It *is* the identity: the same
  -- person on a laptop and a phone is two rows.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Minutes east of UTC on the device that will actually ring. Quiet hours
  -- are a property of the bedside table, not of the account.
  tz_offset_minutes integer not null default 330,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on push_subscriptions (user_id);

-- "Not now", as one control rather than three switches to turn off and
-- then remember to turn back on.
alter table users add column if not exists alerts_muted_until timestamptz;

-- On by default: the first notification this product ever sends somebody
-- must not arrive at 3am.
alter table users add column if not exists push_quiet_hours boolean not null default true;
