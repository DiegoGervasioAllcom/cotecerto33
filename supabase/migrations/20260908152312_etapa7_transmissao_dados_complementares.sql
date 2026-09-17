-- ============================================================
-- Etapa 7 (Transmissão) — modelo de dados: colunas complementares em
-- `propostas`, tabela 1:1 `proposta_dados_complementares` (RG, endereço de
-- correspondência, PEP…), tabela `proposta_boletos` (histórico de boletos
-- gerados) e permissão `profiles.pode_transmitir`.
-- ============================================================

-- ---------- 1) Ampliar propostas ----------
alter table public.propostas
  add column if not exists parcelas smallint,
  add column if not exists valor_parcela numeric(14,2),
  add column if not exists dia_vencimento smallint,
  add column if not exists protocolo_seguradora text,
  add column if not exists orcamento_cia text,
  add column if not exists vigencia_inicio date,
  add column if not exists vigencia_fim date,
  add column if not exists vigencia_aceita date;

do $$ begin
  alter table public.propostas
    add constraint propostas_parcelas_chk
    check (parcelas is null or parcelas between 1 and 12);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas
    add constraint propostas_valor_parcela_chk
    check (valor_parcela is null or valor_parcela > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas
    add constraint propostas_dia_vencimento_chk
    check (dia_vencimento is null or dia_vencimento between 1 and 31);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas
    add constraint propostas_protocolo_seguradora_chk
    check (char_length(protocolo_seguradora) <= 60);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas
    add constraint propostas_orcamento_cia_chk
    check (char_length(orcamento_cia) <= 60);
exception when duplicate_object then null; end $$;

-- ---------- 2) proposta_dados_complementares (1:1 com propostas) ----------
create table if not exists public.proposta_dados_complementares (
  proposta_id uuid primary key references public.propostas(id) on delete cascade,
  rg text,
  orgao_emissor text,
  endereco_corresp_igual_residencial boolean not null default true,
  endereco_corresp_cep text,
  endereco_corresp_logradouro text,
  endereco_corresp_numero text,
  endereco_corresp_bairro text,
  endereco_corresp_cidade text,
  endereco_corresp_uf text,
  atividade_profissao text,
  renda_mensal numeric(14,2),
  pessoa_exposta_politicamente boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint proposta_dados_complementares_rg_chk check (char_length(rg) <= 20),
  constraint proposta_dados_complementares_orgao_emissor_chk check (char_length(orgao_emissor) <= 15),
  constraint proposta_dados_complementares_atividade_profissao_chk check (char_length(atividade_profissao) <= 120),
  constraint proposta_dados_complementares_renda_mensal_chk check (renda_mensal is null or renda_mensal > 0),
  constraint proposta_dados_complementares_uf_chk check (char_length(endereco_corresp_uf) <= 2)
);

alter table public.proposta_dados_complementares enable row level security;

grant select, insert, update on public.proposta_dados_complementares to authenticated;
grant all on public.proposta_dados_complementares to service_role;

drop policy if exists proposta_dados_complementares_select on public.proposta_dados_complementares;
create policy proposta_dados_complementares_select on public.proposta_dados_complementares
  for select to authenticated using (
    exists (
      select 1 from public.propostas p where p.id = proposta_dados_complementares.proposta_id and (
        p.responsavel_id = auth.uid()
        or p.empresa_id in (select empresa_id from public.profiles where id = auth.uid())
        or (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master'))
      )
    )
  );

-- Escrita: dono da proposta, Matriz, ou supervisor direto do responsável
-- (cadeia via profiles.superior_id).
drop policy if exists proposta_dados_complementares_write on public.proposta_dados_complementares;
create policy proposta_dados_complementares_write on public.proposta_dados_complementares
  for all to authenticated using (
    exists (
      select 1 from public.propostas p where p.id = proposta_dados_complementares.proposta_id and (
        p.responsavel_id = auth.uid()
        or public.has_role(auth.uid(),'matriz')
        or (
          public.has_role(auth.uid(),'supervisor')
          and exists (
            select 1 from public.profiles resp
            where resp.id = p.responsavel_id and resp.superior_id = auth.uid()
          )
        )
      )
    )
  ) with check (
    exists (
      select 1 from public.propostas p where p.id = proposta_dados_complementares.proposta_id and (
        p.responsavel_id = auth.uid()
        or public.has_role(auth.uid(),'matriz')
        or (
          public.has_role(auth.uid(),'supervisor')
          and exists (
            select 1 from public.profiles resp
            where resp.id = p.responsavel_id and resp.superior_id = auth.uid()
          )
        )
      )
    )
  );

-- ---------- 3) proposta_boletos (histórico de boletos gerados) ----------
create table if not exists public.proposta_boletos (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id) on delete cascade,
  parcela_numero smallint not null,
  linha_digitavel text,
  vencimento date not null,
  valor numeric(14,2) not null,
  status text not null default 'pendente',
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint proposta_boletos_parcela_uniq unique (proposta_id, parcela_numero),
  constraint proposta_boletos_parcela_numero_chk check (parcela_numero between 1 and 12),
  constraint proposta_boletos_valor_chk check (valor > 0),
  constraint proposta_boletos_linha_digitavel_chk check (char_length(linha_digitavel) <= 60),
  constraint proposta_boletos_status_chk
    check (status in ('pendente','gerado','pago','vencido','cancelado'))
);

create index if not exists proposta_boletos_proposta_idx
  on public.proposta_boletos(proposta_id);

alter table public.proposta_boletos enable row level security;

-- Leitura: mesmo padrão de visibilidade acima. Escrita: só service_role
-- (o robô/RPC gera boletos; o vendedor não edita diretamente).
grant select on public.proposta_boletos to authenticated;
grant all on public.proposta_boletos to service_role;

drop policy if exists proposta_boletos_select on public.proposta_boletos;
create policy proposta_boletos_select on public.proposta_boletos
  for select to authenticated using (
    exists (
      select 1 from public.propostas p where p.id = proposta_boletos.proposta_id and (
        p.responsavel_id = auth.uid()
        or p.empresa_id in (select empresa_id from public.profiles where id = auth.uid())
        or (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master'))
      )
    )
  );

-- ---------- 4) profiles.pode_transmitir ----------
alter table public.profiles
  add column if not exists pode_transmitir boolean not null default true;

comment on column public.profiles.pode_transmitir is
  'Permissão universal (todo tipo de cadastro: CLT sem cargo, franquia Full/Individual, corretora parceira) de executar a Etapa 7 (Transmissão). Nasce true; só Matriz/supervisor pode desligar para uma pessoa específica. Diferente de AreaChave (src/lib/use-areas.ts), que é recorte de menu para perfil interno com cargo e explicitamente não é segurança.';

-- Proteção de campo: a policy de update de `profiles` hoje não separa
-- campos por role (qualquer um que possa editar a própria linha poderia
-- ligar/desligar a própria flag). Trigger bloqueia especificamente essa
-- combinação: auto-edição (auth.uid() = id) por quem não é matriz/supervisor.
-- Matriz/supervisor podem mudar a flag de terceiros (e a própria, se fizer
-- sentido no fluxo deles) sem serem barrados por esta regra.
create or replace function public.fn_bloquear_auto_alteracao_pode_transmitir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pode_transmitir is distinct from old.pode_transmitir
     and auth.uid() = old.id
     and not (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'supervisor')) then
    raise exception 'Você não pode alterar sua própria permissão de transmissão. Fale com a Matriz ou seu supervisor.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_auto_alteracao_pode_transmitir on public.profiles;
create trigger trg_bloquear_auto_alteracao_pode_transmitir
  before update on public.profiles
  for each row execute function public.fn_bloquear_auto_alteracao_pode_transmitir();
