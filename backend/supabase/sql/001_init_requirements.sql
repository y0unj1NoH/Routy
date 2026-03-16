create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop table if exists public.schedule_stops cascade;
drop table if exists public.schedule_days cascade;
drop table if exists public.schedules cascade;
drop table if exists public.place_list_items cascade;
drop table if exists public.place_lists cascade;
drop table if exists public.places cascade;

create table public.places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text not null unique,
  name text,
  formatted_address text,
  lat double precision,
  lng double precision,
  rating numeric,
  user_rating_count integer,
  price_level smallint check (price_level between 0 and 4),
  types_raw jsonb not null default '[]'::jsonb,
  category text,
  opening_hours jsonb,
  photos jsonb not null default '[]'::jsonb,
  reviews jsonb not null default '[]'::jsonb,
  phone text,
  website text,
  google_maps_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  city text not null,
  language text not null default 'ko' check (language in ('ko', 'en')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.place_lists(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  note text,
  priority boolean not null default false,
  item_label text check (item_label in ('STAY')),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (list_id, place_id)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date not null,
  day_count integer not null check (day_count between 1 and 30),
  place_list_id uuid not null references public.place_lists(id),
  stay_place_id uuid references public.places(id) on delete set null,
  stay_recommendation jsonb,
  companions text,
  pace text,
  themes jsonb not null default '[]'::jsonb,
  output_language text not null default 'ko' check (output_language in ('ko', 'en')),
  generation_input jsonb not null default '{}'::jsonb,
  generation_version text not null default 'mvp_v2_visit_tip',
  is_manual_modified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_date_range_check check (end_date >= start_date)
);

create table public.schedule_days (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  date date,
  created_at timestamptz not null default now(),
  unique (schedule_id, day_number)
);

create table public.schedule_stops (
  id uuid primary key default gen_random_uuid(),
  schedule_day_id uuid not null references public.schedule_days(id) on delete cascade,
  stop_order integer not null check (stop_order > 0),
  place_id uuid not null references public.places(id),
  time time,
  label text,
  badges jsonb not null default '[]'::jsonb,
  note text,
  reason text,
  visit_tip text,
  transport_to_next jsonb,
  is_user_modified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (schedule_day_id, stop_order)
);

create index places_google_place_id_idx on public.places(google_place_id);
create index place_lists_user_idx on public.place_lists(user_id);
create index place_list_items_list_idx on public.place_list_items(list_id);
create index place_list_items_list_sort_idx on public.place_list_items(list_id, sort_order);
create index place_list_items_place_idx on public.place_list_items(place_id);
create index schedules_user_idx on public.schedules(user_id);
create index schedules_place_list_idx on public.schedules(place_list_id);
create index schedule_days_schedule_idx on public.schedule_days(schedule_id);
create index schedule_stops_day_idx on public.schedule_stops(schedule_day_id);
create index schedule_stops_place_idx on public.schedule_stops(place_id);

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
before update on public.places
for each row
execute function public.set_updated_at();

drop trigger if exists place_lists_set_updated_at on public.place_lists;
create trigger place_lists_set_updated_at
before update on public.place_lists
for each row
execute function public.set_updated_at();

drop trigger if exists schedules_set_updated_at on public.schedules;
create trigger schedules_set_updated_at
before update on public.schedules
for each row
execute function public.set_updated_at();

alter table public.places enable row level security;
alter table public.place_lists enable row level security;
alter table public.place_list_items enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_days enable row level security;
alter table public.schedule_stops enable row level security;

create policy places_select_authenticated on public.places
for select to authenticated using (true);

create policy places_insert_authenticated on public.places
for insert to authenticated with check (true);

create policy places_update_authenticated on public.places
for update to authenticated using (true) with check (true);

create policy places_delete_authenticated on public.places
for delete to authenticated using (true);

create policy place_lists_select_own on public.place_lists
for select using (user_id = auth.uid());

create policy place_lists_insert_own on public.place_lists
for insert with check (user_id = auth.uid());

create policy place_lists_update_own on public.place_lists
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy place_lists_delete_own on public.place_lists
for delete using (user_id = auth.uid());

create policy place_list_items_select_own on public.place_list_items
for select using (
  exists (
    select 1
    from public.place_lists l
    where l.id = place_list_items.list_id
      and l.user_id = auth.uid()
  )
);

create policy place_list_items_insert_own on public.place_list_items
for insert with check (
  exists (
    select 1
    from public.place_lists l
    where l.id = place_list_items.list_id
      and l.user_id = auth.uid()
  )
);

create policy place_list_items_update_own on public.place_list_items
for update using (
  exists (
    select 1
    from public.place_lists l
    where l.id = place_list_items.list_id
      and l.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.place_lists l
    where l.id = place_list_items.list_id
      and l.user_id = auth.uid()
  )
);

create policy place_list_items_delete_own on public.place_list_items
for delete using (
  exists (
    select 1
    from public.place_lists l
    where l.id = place_list_items.list_id
      and l.user_id = auth.uid()
  )
);

create policy schedules_select_own on public.schedules
for select using (user_id = auth.uid());

create policy schedules_insert_own on public.schedules
for insert with check (user_id = auth.uid());

create policy schedules_update_own on public.schedules
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy schedules_delete_own on public.schedules
for delete using (user_id = auth.uid());

create policy schedule_days_select_own on public.schedule_days
for select using (
  exists (
    select 1
    from public.schedules s
    where s.id = schedule_days.schedule_id
      and s.user_id = auth.uid()
  )
);

create policy schedule_days_insert_own on public.schedule_days
for insert with check (
  exists (
    select 1
    from public.schedules s
    where s.id = schedule_days.schedule_id
      and s.user_id = auth.uid()
  )
);

create policy schedule_days_update_own on public.schedule_days
for update using (
  exists (
    select 1
    from public.schedules s
    where s.id = schedule_days.schedule_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.schedules s
    where s.id = schedule_days.schedule_id
      and s.user_id = auth.uid()
  )
);

create policy schedule_days_delete_own on public.schedule_days
for delete using (
  exists (
    select 1
    from public.schedules s
    where s.id = schedule_days.schedule_id
      and s.user_id = auth.uid()
  )
);

create policy schedule_stops_select_own on public.schedule_stops
for select using (
  exists (
    select 1
    from public.schedule_days d
    join public.schedules s on s.id = d.schedule_id
    where d.id = schedule_stops.schedule_day_id
      and s.user_id = auth.uid()
  )
);

create policy schedule_stops_insert_own on public.schedule_stops
for insert with check (
  exists (
    select 1
    from public.schedule_days d
    join public.schedules s on s.id = d.schedule_id
    where d.id = schedule_stops.schedule_day_id
      and s.user_id = auth.uid()
  )
);

create policy schedule_stops_update_own on public.schedule_stops
for update using (
  exists (
    select 1
    from public.schedule_days d
    join public.schedules s on s.id = d.schedule_id
    where d.id = schedule_stops.schedule_day_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.schedule_days d
    join public.schedules s on s.id = d.schedule_id
    where d.id = schedule_stops.schedule_day_id
      and s.user_id = auth.uid()
  )
);

create policy schedule_stops_delete_own on public.schedule_stops
for delete using (
  exists (
    select 1
    from public.schedule_days d
    join public.schedules s on s.id = d.schedule_id
    where d.id = schedule_stops.schedule_day_id
      and s.user_id = auth.uid()
  )
);
