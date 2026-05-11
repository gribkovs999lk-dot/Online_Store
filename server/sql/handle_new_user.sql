create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'buyer')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = excluded.role;

  return new;
end;
$$;
