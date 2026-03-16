update public.places
set category = 'NIGHT'
where exists (
  select 1
  from jsonb_array_elements_text(coalesce(public.places.types_raw, '[]'::jsonb)) as type(value)
  where lower(type.value) in ('japanese_izakaya_restaurant', 'izakaya')
)
  and category is distinct from 'NIGHT';
