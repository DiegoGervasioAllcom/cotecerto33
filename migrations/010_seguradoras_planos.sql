-- Seguradoras e Planos (sem tela ainda; alimenta o select do step 2 do lead)

create table if not exists public.seguradoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  codigo text unique,
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

grant select on public.seguradoras to anon, authenticated;
grant all on public.seguradoras to service_role;

alter table public.seguradoras enable row level security;

drop policy if exists "seguradoras_read_all" on public.seguradoras;
create policy "seguradoras_read_all" on public.seguradoras
  for select to anon, authenticated using (true);

drop policy if exists "seguradoras_matriz_write" on public.seguradoras;
create policy "seguradoras_matriz_write" on public.seguradoras
  for all to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));

create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  seguradora_id uuid not null references public.seguradoras(id) on delete cascade,
  nome text not null,
  codigo text,
  descricao text,
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  unique (seguradora_id, nome)
);

create index if not exists planos_seguradora_idx on public.planos(seguradora_id);

grant select on public.planos to anon, authenticated;
grant all on public.planos to service_role;

alter table public.planos enable row level security;

drop policy if exists "planos_read_all" on public.planos;
create policy "planos_read_all" on public.planos
  for select to anon, authenticated using (true);

drop policy if exists "planos_matriz_write" on public.planos;
create policy "planos_matriz_write" on public.planos
  for all to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));

-- Seed inicial (espelha SEG_HABILITADAS do protótipo)
insert into public.seguradoras (nome, ordem) values
  ('Mapfre', 1), ('Aliro', 2), ('Yelum', 3), ('HDI', 4), ('Suhai', 5),
  ('Porto', 6), ('Azul', 7), ('Itaú', 8), ('Tokio', 9),
  ('Allianz', 10), ('Bradesco', 11), ('Ezze', 12), ('Zurich', 13),
  ('Alfa', 14), ('Darwin', 15), ('Pier', 16), ('Indiana', 17), ('Sompo', 18)
on conflict (nome) do nothing;
