-- Jobs on the open network.
--
-- Additive only: one new empty table and nothing else touched, so this is
-- safe to apply to a live database while the old code is still running.
-- Nothing reads it until the deploy that does.
--
-- Two invariants live here rather than in application code, because they
-- are the ones that make a job drawable on a map and there is no safe way
-- to recover from a row that breaks them:
--
--   * a remote role has no coordinates, and a placed role has them. Half a
--     coordinate, or a remote job sitting at Null Island, is the same class
--     of bug as a profile with a longitude and no latitude — the map draws
--     something confidently wrong.
--   * latitude and longitude arrive together or not at all.
--
-- There is no cron and nothing to sweep. A job stops being returned when
-- `expires_at` passes or `closed_at` is set, exactly as a pin does, so
-- "live" is a read-time condition and can never drift from a stored flag.

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  title text not null,
  -- Denormalised from the poster's profile at post time, deliberately: the
  -- advert should still read correctly after they change jobs.
  company text not null,
  blurb text,

  -- onsite | hybrid | remote
  work_mode text not null,

  lat double precision,
  lng double precision,
  place_label text,

  -- Where to apply, when there is somewhere. Most posts here won't have
  -- one; the fallback is messaging the person, which is the product.
  apply_url text,

  -- Optional, from the shared vocabulary in lib/intents.
  topic text,

  expires_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint jobs_work_mode_ck check (work_mode in ('onsite', 'hybrid', 'remote')),
  constraint jobs_latlng_together_ck check ((lat is null) = (lng is null)),
  constraint jobs_remote_has_no_place_ck check ((work_mode = 'remote') = (lat is null))
);

-- The live list, which is every read on the panel: open rows, newest first.
create index if not exists jobs_live_idx
  on jobs (expires_at desc)
  where closed_at is null;

-- "My posts", and the cascade on delete.
create index if not exists jobs_user_idx
  on jobs (user_id);
