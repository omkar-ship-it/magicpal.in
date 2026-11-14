-- Activity emails and the daily matches digest: two cadence columns.
--
-- Additive only, both nullable, safe to apply while the old code runs.
--
-- Why columns rather than hooks in `sendMessage` and `requestConnection`:
-- the failure mode of per-event email is ten messages producing ten
-- emails and one unsubscribe. Both jobs are batched and read these to
-- decide "has this person already been told", which makes the debounce
-- structural instead of something every future caller has to remember.
-- It also keeps the send off the request path, so nobody waits on MSG91
-- to see their own message appear.

-- Last time we told them somebody is waiting on them — a connection
-- request, or unread messages. Short cadence, minutes not days.
alter table users add column if not exists activity_emailed_at timestamptz;

-- Last time we sent the daily "people worth meeting" link. Separate from
-- activity and from reengaged_at because all three run on different
-- clocks and one shared stamp would let the loudest suppress the rest.
alter table users add column if not exists digest_emailed_at timestamptz;

-- Both jobs select on "opted in, and not told recently".
create index if not exists users_notify_idx
  on users (activity_emailed_at, digest_emailed_at)
  where email_optout_at is null;
