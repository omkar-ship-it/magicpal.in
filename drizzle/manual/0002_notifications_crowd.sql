-- `drizzle-kit push` adds new CHECK constraints but does not diff edits to
-- existing ones: it reported "Changes applied" and left notifications_kind
-- exactly as it was, so every crowd_nearby insert failed at runtime with a
-- constraint violation. Same trap as 0001. See AGENT_HANDOFF.md §6.2.
alter table notifications drop constraint if exists notifications_kind;
alter table notifications add constraint notifications_kind
  check (kind in ('connection_nearby','match_nearby','interest_nearby','crowd_nearby'));
