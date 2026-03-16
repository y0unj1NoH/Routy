do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'place_list_items'
      and column_name = 'item_label'
  ) then
    execute $sql$
      update public.places as places
      set category = 'STAY'
      from public.place_list_items as items
      where items.place_id = places.id
        and upper(coalesce(items.item_label, '')) = 'STAY'
        and places.category is distinct from 'STAY'
    $sql$;
  end if;
end $$;

with classified as (
  select
    places.id,
    upper(nullif(trim(coalesce(places.category, '')), '')) as existing_category,
    lower(coalesce(places.name, '')) as name_text,
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(places.types_raw, '[]'::jsonb)) as type(value)
      where lower(type.value) ~ '^(lodging|hotel|hostel|guest_house|motel|resort_hotel|japanese_inn|budget_japanese_inn|extended_stay_hotel|private_guest_room|bed_and_breakfast|farmstay|cottage|campground|camping_cabin|rv_park|mobile_home_park|inn)$'
    ) as has_stay_type,
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(places.types_raw, '[]'::jsonb)) as type(value)
      where lower(type.value) ~ '^(tourist_attraction|museum|art_gallery|park|historical_place|monument|castle|temple|church|mosque|synagogue|monastery|plaza|national_park|zoo)$'
    ) as has_landmark_type,
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(places.types_raw, '[]'::jsonb)) as type(value)
      where lower(type.value) ~ '^(restaurant|cafe|bar|bakery|meal_takeaway|meal_delivery|food_court|dessert|pastry|patisserie|cake_shop|ice_cream_shop|ice_cream|coffee_shop|tea_house|juice_shop|donut_shop|chocolate_shop|confectionery)$'
    ) as has_foodie_type,
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(places.types_raw, '[]'::jsonb)) as type(value)
      where lower(type.value) = 'food_store'
    ) as has_food_store_type,
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(places.types_raw, '[]'::jsonb)) as type(value)
      where lower(type.value) ~ '^(shopping_mall|department_store|clothing_store|electronics_store|furniture_store|gift_shop|book_store|jewelry_store|shoe_store|discount_store|drugstore|convenience_store|market|outlet_mall|home_goods_store|sporting_goods_store|toy_store)$'
    ) as has_strong_shopping_type,
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(places.types_raw, '[]'::jsonb)) as type(value)
      where lower(type.value) = 'store'
    ) as has_generic_store_type
  from public.places as places
),
resolved as (
  select
    id,
    case
      when existing_category = 'STAY' or has_stay_type then 'STAY'
      when has_landmark_type then 'LANDMARK'
      when has_foodie_type then 'FOODIE'
      when (has_generic_store_type or has_food_store_type)
        and name_text ~ '(cheesecake|pudding|dessert|sweet|sweets|cake|tart|pie|gelato|ice[[:space:]-]*cream|donut|macaron|chocolate|cookie|치즈케이크|푸딩|디저트|케이크|타르트|젤라또|아이스크림|도넛|마카롱|초콜릿|プリン|チーズケーキ|デザート|スイーツ|ケーキ|タルト|ジェラート|アイス|ドーナツ|マカロン|ショコラ|洋菓子)'
        then 'FOODIE'
      when has_strong_shopping_type then 'SHOPPING'
      when (has_generic_store_type or has_food_store_type)
        then case
          when existing_category in ('STAY', 'LANDMARK', 'FOODIE', 'NATURE', 'VIEW') then existing_category
          else null
        end
      when existing_category in ('STAY', 'LANDMARK', 'FOODIE', 'SHOPPING', 'NATURE', 'VIEW') then existing_category
      else null
    end as next_category
  from classified
)
update public.places as places
set category = resolved.next_category
from resolved
where places.id = resolved.id
  and places.category is distinct from resolved.next_category;

alter table if exists public.place_list_items
  drop constraint if exists place_list_items_item_label_check;

alter table if exists public.place_list_items
  drop column if exists item_label;
