-- ===========================================================================
-- V11 · F3/F4 (Frente 2) — produtos, padrão por bloco e escopo do acesso
--
-- Etapa 2 do DE/PARA: "produtos e canais logo abaixo do modelo/supervisão, com
-- botão Todos (alterna tudo/nada)" e "**produtos padrão por bloco** (interno:
-- todos · externo: só Auto) herdados na aprovação".
--
-- Do protótipo r40:
--   PRODUTOS      = auto (fixo), moto, vida, resid, celular
--   PROD_PADRAO   = { int: todos, ext: ['auto'] }
--   prodPadrao(s) = a lista do bloco, garantindo 'auto' sempre presente
--   produtoTemJornada(id) -> só 'auto' tem jornada pronta ("· em breve" nos demais)
--
-- `auto` é FIXO: o protótipo não deixa desmarcá-lo (`fixo:true`, rótulo "· base",
-- e o toggleProdPad ignora o clique nele). Isso vira constraint aqui, não
-- convenção de tela — senão a primeira chamada de API tira o Auto de alguém.
--
-- Canais já vêm da V11.0.4 (`canais` + `profile_canais`), cargo e áreas da
-- Frente 0 (`profiles.cargo_id`, `profile_areas`) e a supervisão do Master de
-- `profiles.superior_id`. Aqui só falta o eixo de produtos — a aprovação (F5) é
-- que passa a POPULAR tudo isso.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Catálogo de produtos
-- ---------------------------------------------------------------------------
create table if not exists public.produtos (
  id           text primary key check (char_length(id) between 2 and 40),
  nome         text not null check (char_length(nome) between 2 and 60),
  -- `auto` é o único fixo: entra em todo acesso e não pode ser desmarcado.
  fixo         boolean not null default false,
  ativo        boolean not null default true,
  -- Só Auto tem jornada de cotação pronta; os demais aparecem como "em breve".
  tem_jornada  boolean not null default false,
  ordem        smallint not null default 0 check (ordem >= 0)
);

comment on table public.produtos is
  'F3: catálogo de produtos (ramos) comercializáveis. `fixo` marca o que entra em
   todo acesso — hoje só Auto. `tem_jornada` separa o que já tem wizard de
   cotação do que a tela mostra como "em breve".';

alter table public.produtos enable row level security;
revoke all on public.produtos from public, anon, authenticated;
grant select on public.produtos to authenticated;
grant all on public.produtos to service_role;

drop policy if exists produtos_select_autenticado on public.produtos;
create policy produtos_select_autenticado on public.produtos
  for select to authenticated using (true);

insert into public.produtos (id, nome, fixo, ativo, tem_jornada, ordem) values
  ('auto',    'Auto',        true,  true, true,  1),
  ('moto',    'Moto',        false, true, false, 2),
  ('vida',    'Vida',        false, true, false, 3),
  ('resid',   'Residencial', false, true, false, 4),
  ('celular', 'Celular',     false, true, false, 5)
on conflict (id) do update
  set nome = excluded.nome, fixo = excluded.fixo, ativo = excluded.ativo,
      tem_jornada = excluded.tem_jornada, ordem = excluded.ordem;

-- ---------------------------------------------------------------------------
-- 2) Produtos padrão por bloco (o PROD_PADRAO)
--
-- Tabela e não constante porque a tela Personalização geral edita esses padrões
-- ("salva junto com o botão acima", no protótipo).
-- ---------------------------------------------------------------------------
create table if not exists public.produtos_padrao (
  bloco      text not null check (bloco in ('interno', 'externo')),
  produto_id text not null references public.produtos(id) on delete cascade,
  primary key (bloco, produto_id)
);

comment on table public.produtos_padrao is
  'F3: produtos que cada bloco herda na aprovação — interno todos, externo só
   Auto. Editável na Personalização geral, por isso é tabela.';

alter table public.produtos_padrao enable row level security;
revoke all on public.produtos_padrao from public, anon, authenticated;
grant select on public.produtos_padrao to authenticated;
grant insert, update, delete on public.produtos_padrao to authenticated;
grant all on public.produtos_padrao to service_role;

drop policy if exists produtos_padrao_select on public.produtos_padrao;
create policy produtos_padrao_select on public.produtos_padrao
  for select to authenticated using (true);

drop policy if exists produtos_padrao_escrita on public.produtos_padrao;
create policy produtos_padrao_escrita on public.produtos_padrao
  for all to authenticated
  using (public.has_role(auth.uid(), 'matriz') or public.has_role(auth.uid(), 'coordenador'))
  with check (public.has_role(auth.uid(), 'matriz') or public.has_role(auth.uid(), 'coordenador'));

-- interno: todos os ativos · externo: só Auto
insert into public.produtos_padrao (bloco, produto_id)
select 'interno', p.id from public.produtos p where p.ativo
on conflict do nothing;
insert into public.produtos_padrao (bloco, produto_id) values ('externo', 'auto')
on conflict do nothing;

-- O produto fixo nunca sai do padrão de bloco nenhum.
create or replace function public.fn_produto_fixo_no_padrao()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
begin
  if exists (select 1 from public.produtos p where p.id = old.produto_id and p.fixo) then
    raise exception 'o produto % é fixo e não pode sair do padrão do bloco %',
      old.produto_id, old.bloco;
  end if;
  return old;
end;
$function$;

drop trigger if exists trg_produto_fixo_no_padrao on public.produtos_padrao;
create trigger trg_produto_fixo_no_padrao
  before delete on public.produtos_padrao
  for each row execute function public.fn_produto_fixo_no_padrao();

-- ---------------------------------------------------------------------------
-- 3) Produtos habilitados por acesso (espelha profile_canais da V11.0.4)
-- ---------------------------------------------------------------------------
create table if not exists public.profile_produtos (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  produto_id text not null references public.produtos(id) on delete cascade,
  primary key (profile_id, produto_id)
);

comment on table public.profile_produtos is
  'F4: produtos que este acesso comercializa, definidos na aprovação. Ausência de
   linhas = nenhum produto; é o caso do Master franqueado, que não vende.';

create index if not exists idx_profile_produtos_produto
  on public.profile_produtos(produto_id);

alter table public.profile_produtos enable row level security;
revoke all on public.profile_produtos from public, anon, authenticated;
grant select on public.profile_produtos to authenticated;
grant insert, update, delete on public.profile_produtos to authenticated;
grant all on public.profile_produtos to service_role;

drop policy if exists profile_produtos_select on public.profile_produtos;
create policy profile_produtos_select on public.profile_produtos
  for select to authenticated
  using (
    profile_id = auth.uid()
    or profile_id in (
      select p.id from public.profiles p
       where p.empresa_id in (select public.empresas_visiveis(auth.uid()))
    )
    or public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  );

drop policy if exists profile_produtos_escrita on public.profile_produtos;
create policy profile_produtos_escrita on public.profile_produtos
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
    or (
      -- A Franquia Full configura o time dela (cadastro direto passa pela
      -- configuração — V11.5.5).
      public.has_role(auth.uid(), 'franqueado')
      and profile_id in (
        select p.id from public.profiles p
         where p.empresa_id in (select public.empresas_visiveis(auth.uid()))
      )
    )
  )
  with check (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
    or (
      public.has_role(auth.uid(), 'franqueado')
      and profile_id in (
        select p.id from public.profiles p
         where p.empresa_id in (select public.empresas_visiveis(auth.uid()))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) O padrão do bloco, pronto para a aprovação herdar
-- ---------------------------------------------------------------------------
create or replace function public.fn_produtos_padrao(_bloco text)
  returns setof text
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  -- union com o fixo garante o Auto mesmo que o padrão do bloco esteja vazio,
  -- como o prodPadrao() do protótipo faz com o unshift.
  select pp.produto_id from public.produtos_padrao pp where pp.bloco = _bloco
  union
  select p.id from public.produtos p where p.fixo and p.ativo;
$function$;

comment on function public.fn_produtos_padrao(text) is
  'F3: produtos que o bloco herda na aprovação, sempre incluindo o produto fixo —
   mesmo comportamento do prodPadrao() do protótipo.';

revoke all on function public.fn_produtos_padrao(text) from public, anon;
grant execute on function public.fn_produtos_padrao(text) to authenticated, service_role;
