-- Separate "am I on the public network" from "how precise is my location".
--
-- They were one column. That made a board member who wanted a pin on their
-- own board set a visibility, and setting a visibility published them to the
-- open map of strangers — a consent they were never asked for and could not
-- decline without leaving the board.
--
-- Additive and safe: the column defaults to false, so nobody is published by
-- having this run.
alter table users add column if not exists public_opt_in boolean not null default false;

-- Preserve the choice people actually made. Until now the control was headed
-- "On the public map, show", so anybody who moved it off 'off' was answering
-- precisely this question and answering yes. Everyone else — the far larger
-- group, who simply never reached the location step — stays false.
update users set public_opt_in = true where visibility <> 'off';
