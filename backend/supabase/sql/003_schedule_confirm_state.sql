alter table public.schedules
  add column if not exists is_confirmed boolean not null default true;

update public.schedules
set is_confirmed = true
where is_confirmed is null;
