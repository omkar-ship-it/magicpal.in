-- The public network opts in by default now.
--
-- Only the default changes. Every existing row keeps the value it has, so
-- nobody is published by this running — and because both open-network
-- queries also require users.name, which is only set by saving the profile
-- form the control lives on, the first time this default can matter is a
-- save where the tick was on screen and could have been removed.
alter table users alter column public_opt_in set default true;
