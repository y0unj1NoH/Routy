with izakaya_places as (
  select
    p.id,
    lower(coalesce(p.name, '')) as name_text,
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(p.types_raw, '[]'::jsonb)) as type(value)
      where lower(type.value) in ('japanese_izakaya_restaurant', 'izakaya')
    ) as has_izakaya_type,
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(p.types_raw, '[]'::jsonb)) as type(value)
      where lower(type.value) in (
        'bakery',
        'dessert',
        'dessert_shop',
        'dessert_restaurant',
        'pastry',
        'pastry_shop',
        'patisserie',
        'cake_shop',
        'ice_cream_shop',
        'ice_cream',
        'juice_shop',
        'donut_shop',
        'chocolate_shop',
        'confectionery',
        'creperie',
        'meal_takeaway'
      )
    ) as has_snack_type,
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(p.types_raw, '[]'::jsonb)) as type(value)
      where lower(type.value) in (
        'ramen_restaurant',
        'sushi_restaurant',
        'yakiniku_restaurant',
        'steak_house',
        'seafood_restaurant',
        'korean_restaurant',
        'italian_restaurant',
        'french_restaurant',
        'pizza_restaurant',
        'burger_restaurant',
        'udon_restaurant',
        'soba_restaurant',
        'tempura_restaurant',
        'shabu_shabu_restaurant',
        'tonkatsu_restaurant',
        'curry_restaurant',
        'western_restaurant',
        'chicken_restaurant',
        'hot_pot_restaurant'
      )
    ) as has_strong_meal_type
  from public.places as p
),
resolved as (
  select
    id,
    case
      when has_snack_type
        or name_text ~ '(cheesecake|pudding|dessert|sweet|sweets|cake|tart|pie|gelato|ice[[:space:]]*cream|donut|macaron|chocolate|cookie|치즈케이크|푸딩|디저트|케이크|타르트|젤라또|아이스크림|도넛|마카롱|초콜릿|プリン|チーズケーキ|デザート|スイーツ|ケーキ|タルト|ジェラート|アイス|ドーナツ|マカロン|ショコラ|洋菓子)'
        then 'SNACK'
      when has_strong_meal_type
        or name_text ~ '(ramen|sushi|yakiniku|gyukatsu|tonkatsu|katsu|udon|soba|tempura|okonomiyaki|shabu|sukiyaki|steak|burger|pizza|pasta|seafood|오코노미야키|규카츠|돈카츠|카츠|우동|소바|샤브|스키야키|스테이크|초밥|스시|라멘|해산물|쿠시카츠|くしかつ|串カツ|牛かつ|とんかつ|寿司|すし|ラーメン|うどん|そば|天ぷら|しゃぶ|すき焼き)'
        then 'MEAL'
      else 'NIGHT'
    end as next_category
  from izakaya_places
  where has_izakaya_type
)
update public.places as p
set category = resolved.next_category
from resolved
where p.id = resolved.id
  and p.category is distinct from resolved.next_category;
