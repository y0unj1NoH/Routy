create table if not exists public.import_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  usage_month text not null,
  source text not null,
  import_request_count integer not null default 0 check (import_request_count >= 0),
  import_place_count integer not null default 0 check (import_place_count >= 0),
  created_at timestamptz not null default now(),
  constraint import_usage_events_nonzero_check check (import_request_count > 0 or import_place_count > 0)
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'import_usage_events'
      and column_name = 'period_key'
  ) then
    alter table public.import_usage_events rename column period_key to usage_month;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'import_usage_events'
      and column_name = 'request_units'
  ) then
    alter table public.import_usage_events rename column request_units to import_request_count;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'import_usage_events'
      and column_name = 'import_run_count'
  ) then
    alter table public.import_usage_events rename column import_run_count to import_request_count;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'import_usage_events'
      and column_name = 'place_units'
  ) then
    alter table public.import_usage_events rename column place_units to import_place_count;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'import_usage_events_period_idx'
  ) then
    alter index public.import_usage_events_period_idx rename to import_usage_events_usage_month_idx;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'ai_usage_events_user_day_idx'
  ) then
    alter index public.ai_usage_events_user_day_idx rename to ai_usage_events_user_usage_date_idx;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'ai_usage_events_month_idx'
  ) then
    alter index public.ai_usage_events_month_idx rename to ai_usage_events_usage_month_idx;
  end if;
end $$;

alter table public.import_usage_events
  add column if not exists usage_month text not null default '',
  add column if not exists source text not null default '',
  add column if not exists import_request_count integer not null default 0,
  add column if not exists import_place_count integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.import_usage_events
  drop constraint if exists import_usage_events_nonzero_check;

alter table public.import_usage_events
  add constraint import_usage_events_nonzero_check
  check (import_request_count > 0 or import_place_count > 0);

create index if not exists import_usage_events_usage_month_idx on public.import_usage_events(usage_month);
create index if not exists import_usage_events_created_idx on public.import_usage_events(created_at);

alter table public.import_usage_events enable row level security;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  usage_date text not null,
  usage_month text not null,
  source text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_usage_events'
      and column_name = 'day_key'
  ) then
    alter table public.ai_usage_events rename column day_key to usage_date;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_usage_events'
      and column_name = 'month_key'
  ) then
    alter table public.ai_usage_events rename column month_key to usage_month;
  end if;
end $$;

alter table public.ai_usage_events
  add column if not exists usage_date text not null default '',
  add column if not exists usage_month text not null default '',
  add column if not exists source text not null default '',
  add column if not exists created_at timestamptz not null default now();

create index if not exists ai_usage_events_user_usage_date_idx on public.ai_usage_events(user_id, usage_date);
create index if not exists ai_usage_events_usage_month_idx on public.ai_usage_events(usage_month);
create index if not exists ai_usage_events_created_idx on public.ai_usage_events(created_at);

alter table public.ai_usage_events enable row level security;
