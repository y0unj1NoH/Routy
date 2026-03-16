alter table if exists public.place_list_items
  add column if not exists sort_order integer;

with ranked_items as (
  select
    id,
    row_number() over (
      partition by list_id
      order by is_must_visit desc, created_at asc, id asc
    ) as next_sort_order
  from public.place_list_items
)
update public.place_list_items as items
set sort_order = ranked_items.next_sort_order
from ranked_items
where items.id = ranked_items.id
  and items.sort_order is null;

alter table if exists public.place_list_items
  alter column sort_order set not null;

create index if not exists place_list_items_list_sort_idx
  on public.place_list_items(list_id, sort_order);
