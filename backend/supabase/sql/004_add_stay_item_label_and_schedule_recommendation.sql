alter table if exists public.place_list_items
  add column if not exists item_label text;

alter table if exists public.place_list_items
  drop constraint if exists place_list_items_item_label_check;

alter table if exists public.place_list_items
  add constraint place_list_items_item_label_check
  check (item_label is null or item_label in ('STAY'));

update public.place_list_items as items
set item_label = 'STAY'
from public.places as places
where items.place_id = places.id
  and items.item_label is null
  and coalesce(places.types_raw::text, '') ~* 'hotel|lodging|hostel|motel|guest|inn|resort|ryokan|accommodation';

alter table if exists public.schedules
  add column if not exists stay_recommendation jsonb;
