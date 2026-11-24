-- Brain-Mate: lift the one-a-day Wavelength limit (2026-11-24).
-- The unique (sender, day) index *was* the limit. Replace it with a plain
-- index, kept for the daily spam-ceiling count in createLink.
drop index if exists brain_mate_links_daily;
create index if not exists brain_mate_links_sender_day_idx on brain_mate_links (sender_id, sender_day);
