-- Allow `live` as a visibility.
--
-- `drizzle-kit push` adds new CHECK constraints but does not diff changes to
-- an existing one: it created memberships_rsvp happily and left
-- users_visibility alone, so saving visibility='live' failed with a bare 500
-- while the schema file claimed it was legal. Constraint edits have to be
-- applied by hand like this — check pg_constraint after any push that
-- changes one.
alter table users drop constraint if exists users_visibility;
alter table users add constraint users_visibility
  check (visibility in ('off', 'base', 'exact', 'live'));
