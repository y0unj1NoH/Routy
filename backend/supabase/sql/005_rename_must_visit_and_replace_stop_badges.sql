do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'place_list_items'
      and column_name = 'priority'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'place_list_items'
      and column_name = 'is_must_visit'
  ) then
    execute 'alter table public.place_list_items rename column priority to is_must_visit';
  end if;
end $$;

alter table if exists public.place_list_items
  add column if not exists is_must_visit boolean not null default false;

update public.place_list_items
set is_must_visit = false
where is_must_visit is null;

alter table if exists public.schedule_stops
  add column if not exists is_must_visit boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schedule_stops'
      and column_name = 'badges'
  ) then
    execute $sql$
      update public.schedule_stops
      set is_must_visit = exists (
        select 1
        from jsonb_array_elements_text(coalesce(badges, '[]'::jsonb)) as badge(value)
        where upper(regexp_replace(trim(badge.value), '[\s_-]+', '', 'g')) = 'MUSTVISIT'
      )
    $sql$;
  end if;
end $$;

alter table if exists public.schedule_stops
  drop column if exists badges;
