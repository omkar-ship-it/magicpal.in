-- Brain-Mate: the personality game and its one-a-day Wavelength links.
--
-- Additive only — two new tables, nothing existing is touched — so this can
-- be applied before or after the deploy that reads it. Mirrors the
-- definitions in lib/db/schema.ts; `drizzle-kit push` produces the same.
create table if not exists brain_mates (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text not null,
  answers jsonb not null,
  archetype text not null,
  streak text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brain_mates_archetype_idx on brain_mates (archetype);

create table if not exists brain_mate_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sender_id uuid not null references users(id) on delete cascade,
  recipient_name text not null,
  relation text not null default 'friend',
  sender_day text not null,
  recipient_id uuid references users(id) on delete set null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  nudged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint brain_mate_links_relation check (relation in ('friend','colleague'))
);
create unique index if not exists brain_mate_links_daily on brain_mate_links (sender_id, sender_day);
create index if not exists brain_mate_links_recipient_idx on brain_mate_links (recipient_id);
