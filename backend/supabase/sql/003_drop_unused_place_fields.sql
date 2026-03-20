alter table if exists public.places
  drop column if exists primary_type_display_name,
  drop column if exists reviews,
  drop column if exists phone;
