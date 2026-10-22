-- Progreso por usuario (#53). Pégalo una vez en Supabase → SQL Editor → Run.
-- Cada fila es una clave del ProgressStore del frontend: pet, visits o collection.
create table if not exists public.user_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key in ('pet', 'visits', 'collection')),
  value jsonb not null check (pg_column_size(value) <= 65536),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- RLS: cada usuario solo ve y cambia sus filas. La API usa el token del usuario, nunca la service key.
alter table public.user_progress enable row level security;

drop policy if exists "progreso propio: leer" on public.user_progress;
create policy "progreso propio: leer" on public.user_progress
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "progreso propio: crear" on public.user_progress;
create policy "progreso propio: crear" on public.user_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "progreso propio: actualizar" on public.user_progress;
create policy "progreso propio: actualizar" on public.user_progress
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.touch_user_progress() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists user_progress_touch on public.user_progress;
create trigger user_progress_touch before update on public.user_progress
  for each row execute function public.touch_user_progress();
