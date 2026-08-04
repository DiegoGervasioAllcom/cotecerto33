-- ===========================================================================
-- V11.I.1 + V11.I.2 — Escopo de leitura do time de apoio (Marketing /
-- Assistente Comercial), plano `docs/PLANO_ESCOPO_INTERNO_V11.md`.
--
-- CONTEXTO. `interno` (Marketing, Assistente Comercial) tem menu (áreas) mas
-- não tinha dado: nenhuma policy de SELECT das tabelas abaixo o alcançava,
-- porque todas usam `empresas_visiveis(auth.uid())`, que pra `interno` só
-- devolve a própria "empresa" (o shell pessoal criado em `cadastrar_franquia_admin`
-- no fluxo de convite — cada pessoa aprovada tem sua própria linha em
-- `empresas`, não a linha da Matriz). Decisão da Lis (03/08): interno vê a
-- operação PRÓPRIA da Matriz (empresa com `tipo='matriz'`), nunca rede externa
-- (Master/Individual/Full). Sem escrita além do que os presets já dão.
--
-- V11.I.1 — fonte única do id da Matriz: `fn_empresa_matriz()`, reusada em
-- todas as policies abaixo em vez de repetir `select id from empresas where
-- tipo='matriz'` em cada uma. Segue o mesmo shape de `empresas_visiveis()`
-- (table function) para caber no mesmo `... in (select empresa_id from ...)`
-- já usado por todas as policies do projeto.
--
-- V11.I.2 — por tabela, ESTENDI a policy de SELECT já existente (nunca toquei
-- em insert/update/delete/for-all):
--   - leads / clientes / oportunidades / propostas: cada uma já tinha policy de
--     SELECT separada da de escrita (confirmado direto no `pg_policies` do banco
--     local, não só nos migrations — `oportunidades` tinha DUAS policies de
--     SELECT coexistindo por um esquecimento antigo: `oportunidades_select`
--     de 001_init e `oport_select` de 002, este último mais completo. Estendi
--     só `oport_select`; a duplicada continua inofensiva — RLS combina
--     policies do mesmo comando com OR, então ela nunca restringe nada além
--     do que `oport_select` já cobre).
--   - cotacoes: TAMBÉM tem policy de SELECT própria (`cot_select`), separada da
--     de escrita (`cot_iud`, restrita a `responsavel_id = auth.uid()`, sem
--     ramo de empresa). Não estava na lista original de 6 `cotacao_*`, mas é
--     pré-requisito: `/operacao/vendas` e `/operacao/pipeline-geral` fazem
--     `propostas(...).select(..., cotacoes(segurado:cotacao_segurado(...),
--     seguro:cotacao_seguro(...)))` — se `cot_select` não alcançar o interno,
--     o embed de `cotacoes` volta vazio mesmo com `cotacao_segurado`/`cotacao_seguro`
--     liberados. Estendida também.
--   - cotacao_coberturas/perfil/premios/segurado/seguro/veiculo: são `for all`
--     (USING cobre select+update+delete; WITH CHECK só permite
--     `responsavel_id = auth.uid()`, mais restrito). Adicionar leitura ali
--     abriria DELETE pro interno também. Em vez disso, criei uma policy NOVA
--     só de SELECT em cada uma (RLS soma policies do mesmo comando com OR) —
--     não risco nada da `_rw` existente.
--   - metas / canais: já tinham policy de SELECT própria (`metas_select`,
--     `canais_select_escopo`). Estendidas.
--   - premiacao_lancamentos: policy de SELECT própria (`premiacao_lancamentos_select`),
--     separada da de escrita (`premiacao_lancamentos_admin`, restrita a
--     `has_role(matriz)`). Estendida.
--   - v_comissao_por_competencia: view com `security_invoker=true` (já estava
--     correto) sobre `comissao_lancamentos` — sem policy própria, herda a RLS
--     da tabela base. `comissao_lancamentos` só tem UMA policy, de SELECT
--     (`"cc lanc select self or rede"`); não há policy de escrita concedida a
--     `authenticated` nessa tabela (grants de INSERT/UPDATE/DELETE existem a
--     nível de tabela, mas sem NENHUMA policy pra esses comandos o RLS nega por
--     padrão — escrita só entra via RPC security definer). Estendi a policy de
--     SELECT da tabela; a view repassa automaticamente.
--
-- NÃO tocado (fora do escopo desta migration, ver relatório da task):
--   - `empresas`/`profiles` (nomes de franquia/vendedor nos relatórios/telas)
--     continuam com o mesmo escopo de sempre — interno não vê o nome "Matriz
--     CoteCerto" nem nomes de outros colegas fora do próprio perfil. É um gap
--     de UX (mostra "—" onde devia mostrar o nome), não de segurança; não
--     estava na lista de tabelas do plano e envolve decidir quanto de PII de
--     colegas o interno deveria ver — decisão de produto, não RLS mecânica.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- V11.I.1 — fn_empresa_matriz()
-- ---------------------------------------------------------------------------
create or replace function public.fn_empresa_matriz()
returns table (empresa_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select id from public.empresas where tipo = 'matriz'::empresa_tipo
$$;

comment on function public.fn_empresa_matriz() is
  'V11.I.1: id(s) da empresa com tipo=''matriz'' — fonte única reusada pelas
   policies de leitura do time de apoio (Marketing/Assistente Comercial).
   Shape de table function (como empresas_visiveis) pra caber em
   "empresa_id in (select empresa_id from fn_empresa_matriz())" nas policies.';

revoke all on function public.fn_empresa_matriz() from public, anon;
grant execute on function public.fn_empresa_matriz() to authenticated;

-- ---------------------------------------------------------------------------
-- leads / clientes / oportunidades / propostas
-- ---------------------------------------------------------------------------
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated using (
  responsavel_id = auth.uid()
  or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  or has_role(auth.uid(), 'matriz'::perfil)
  or (
    has_role(auth.uid(), 'interno'::perfil)
    and empresa_id in (select empresa_id from public.fn_empresa_matriz())
  )
);

drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes for select to authenticated using (
  has_role(auth.uid(), 'matriz'::perfil)
  or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  or (
    has_role(auth.uid(), 'interno'::perfil)
    and empresa_id in (select empresa_id from public.fn_empresa_matriz())
  )
);

drop policy if exists oport_select on public.oportunidades;
create policy oport_select on public.oportunidades for select to authenticated using (
  responsavel_id = auth.uid()
  or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  or (
    has_role(auth.uid(), 'interno'::perfil)
    and empresa_id in (select empresa_id from public.fn_empresa_matriz())
  )
);

drop policy if exists prop_select on public.propostas;
create policy prop_select on public.propostas for select to authenticated using (
  (responsavel_id = auth.uid())
  or (empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid()))
  or has_role(auth.uid(), 'matriz'::perfil)
  or (has_role(auth.uid(), 'master'::perfil) and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
  or (
    has_role(auth.uid(), 'interno'::perfil)
    and empresa_id in (select empresa_id from public.fn_empresa_matriz())
  )
);

-- ---------------------------------------------------------------------------
-- cotacoes (pré-requisito pro embed usado por /operacao/vendas e
-- /operacao/pipeline-geral — ver nota no cabeçalho)
-- ---------------------------------------------------------------------------
drop policy if exists cot_select on public.cotacoes;
create policy cot_select on public.cotacoes for select to authenticated using (
  (responsavel_id = auth.uid())
  or (empresa_id in (select profiles.empresa_id from public.profiles where profiles.id = auth.uid()))
  or has_role(auth.uid(), 'matriz'::perfil)
  or (has_role(auth.uid(), 'master'::perfil) and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
  or (
    has_role(auth.uid(), 'interno'::perfil)
    and empresa_id in (select empresa_id from public.fn_empresa_matriz())
  )
);

-- ---------------------------------------------------------------------------
-- cotacao_coberturas/perfil/premios/segurado/seguro/veiculo — policies NOVAS,
-- só SELECT (as `_rw` existentes, for all, não são tocadas: risco de abrir
-- DELETE via USING, ver cabeçalho).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'cotacao_coberturas', 'cotacao_perfil', 'cotacao_premios',
    'cotacao_segurado', 'cotacao_seguro', 'cotacao_veiculo'
  ] loop
    execute format('drop policy if exists "%1$s_select_interno_matriz" on public.%1$s', t);
    execute format($f$
      create policy "%1$s_select_interno_matriz" on public.%1$s
      for select to authenticated using (
        exists (
          select 1 from public.cotacoes c
          where c.id = %1$s.cotacao_id
            and has_role(auth.uid(), 'interno'::perfil)
            and c.empresa_id in (select empresa_id from public.fn_empresa_matriz())
        )
      )
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- metas / canais
-- ---------------------------------------------------------------------------
drop policy if exists metas_select on public.metas;
create policy metas_select on public.metas
  for select
  to authenticated
  using (
    has_role(auth.uid(), 'matriz'::perfil)
    or (has_role(auth.uid(), 'master'::perfil) and (
      (escopo = 'empresa' and ref_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      or (escopo = 'usuario' and ref_id in (
        select id from public.profiles
        where empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
      ))
    ))
    or (escopo = 'usuario' and ref_id = auth.uid())
    or (escopo = 'empresa' and ref_id in (
      select empresa_id from public.profiles where id = auth.uid()
    ))
    or (
      has_role(auth.uid(), 'interno'::perfil)
      and escopo = 'empresa'
      and ref_id in (select empresa_id from public.fn_empresa_matriz())
    )
  );

drop policy if exists canais_select_escopo on public.canais;
create policy canais_select_escopo on public.canais
  for select to authenticated using (
    empresa_id is null
    or empresa_id in (select empresas_visiveis(auth.uid()))
    or (
      has_role(auth.uid(), 'interno'::perfil)
      and empresa_id in (select empresa_id from public.fn_empresa_matriz())
    )
  );

-- ---------------------------------------------------------------------------
-- premiacao_lancamentos
-- ---------------------------------------------------------------------------
drop policy if exists premiacao_lancamentos_select on public.premiacao_lancamentos;
create policy premiacao_lancamentos_select on public.premiacao_lancamentos
  for select to authenticated using (
    has_role(auth.uid(), 'matriz'::perfil)
    or vendedor_id = auth.uid()
    or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
    or (
      has_role(auth.uid(), 'interno'::perfil)
      and empresa_id in (select empresa_id from public.fn_empresa_matriz())
    )
  );

-- ---------------------------------------------------------------------------
-- comissao_lancamentos (base de v_comissao_por_competencia, security_invoker;
-- relatório "Comissão" em /operacao/relatorios)
-- ---------------------------------------------------------------------------
drop policy if exists "cc lanc select self or rede" on public.comissao_lancamentos;
create policy "cc lanc select self or rede" on public.comissao_lancamentos
  for select to authenticated using (
    vendedor_id = auth.uid()
    or beneficiario_id = auth.uid()
    or has_role(auth.uid(), 'matriz'::perfil)
    or empresa_id in (select empresas_visiveis(auth.uid()))
    or (
      has_role(auth.uid(), 'interno'::perfil)
      and empresa_id in (select empresa_id from public.fn_empresa_matriz())
    )
  );
