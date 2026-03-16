alter table if exists public.place_lists
  add column if not exists language text not null default 'ko';

alter table if exists public.schedules
  add column if not exists output_language text not null default 'ko';

alter table if exists public.schedule_stops
  add column if not exists visit_tip text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'place_lists_language_check'
  ) then
    alter table public.place_lists
      add constraint place_lists_language_check
      check (language in ('ko', 'en'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedules_output_language_check'
  ) then
    alter table public.schedules
      add constraint schedules_output_language_check
      check (output_language in ('ko', 'en'));
  end if;
end $$;
