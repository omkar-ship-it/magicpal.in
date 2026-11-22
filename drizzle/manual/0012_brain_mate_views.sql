-- Brain-Mate v3: the friend's view. Additive — two nullable columns.
alter table brain_mate_links add column if not exists view_of_sender jsonb;
alter table brain_mate_links add column if not exists view_of_recipient jsonb;
