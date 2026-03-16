update public.places
set category = case upper(coalesce(category, ''))
  when 'FOODIE' then 'MEAL'
  when 'SHOPPING' then 'SHOP'
  when 'VIEW' then 'NIGHT'
  else category
end
where upper(coalesce(category, '')) in ('FOODIE', 'SHOPPING', 'VIEW');
