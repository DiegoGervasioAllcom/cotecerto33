# Plano — Escopo de leitura do time de apoio (Marketing / Assistente Comercial)

**Status:** ✅ implementado e concluído — V11.I.1 a V11.I.5 entregues no mesmo commit
que abriu este plano (`7f8cb78`), migration `20260804120000_v11_i_escopo_interno_matriz.sql`
e `tests/db/rls-escopo-interno-matriz.test.ts`. As tasks abaixo ficam marcadas "propostas"
por não terem sido riscadas depois — ver as notas inline em cada uma.

**Aberto em:** 04/08/2026 · **Gatilho:** resposta da Lis ao item 6 de
`docs/PERGUNTAS_PARA_LIS.md`, decidindo o que faltava desde a Hierarquia V11
(28/07/2026, gap registrado em `docs/ANALISE_LACUNAS_V11.md`, seção "O que segue
aberto: escopo de dados do time de apoio").

## O problema (recapitulando o gap já registrado)

O perfil `interno` (Assistente Comercial, Marketing) **não** entra no braço amplo de
`empresas_visiveis()`, de propósito: essa função também decide **18 policies de
escrita** (leads, clientes, oportunidades, cotacao_\*, metas, canais) — abrir
visibilidade abriria escrita na rede toda pra quem não deveria escrever. Resultado:
Marketing tem Leads/Distribuição/Relatórios no menu (preset `marketing` em
`cargo_areas`), mas as telas abrem sem dado.

## Decisão da Lis (03/08/2026)

> "Marketing e Assistente Comercial enxergam apenas a operação interna da Matriz
> (leads, distribuição e relatórios da operação própria), sem os dados das franquias
> Full. Sem escrita além do que os presets já dão. Se o Marketing precisar de visão
> consolidada de captação das Fulls mais adiante, tratamos como relatório agregado —
> não como leitura ampla nas policies."

**Interpretação adotada** (a confirmar se for ambígua): "operação própria da Matriz"
= só o que pertence à empresa com `empresas.tipo = 'matriz'` (a única linha com esse
tipo, já usada em toda a lógica de distribuição pra excluir franquias — ver
`distribuicao_automatica.sql`, `e.tipo <> 'matriz'`) — **não só Full**, qualquer rede
externa (Master, Individual, Full) fica de fora. A frase cita "Full" porque é o caso
mais autônomo, mas "operação própria"/"interna da Matriz" não deixa margem pra
Individual/Master entrarem.

## Escopo real por cargo (conferido em `cargo_areas`, H2)

- **Marketing:** `mdash, mleads, mdist, mrel, mkt` (Leads, Distribuição, Relatórios,
  Marketing — este último "em breve", sem rota, fora de escopo aqui).
- **Assistente Comercial:** `mdash, mvendas, mpipe` (Vendas, Pipeline geral) — **áreas
  diferentes** das de Marketing. Preciso confirmar durante a investigação se
  Vendas/Pipeline já funcionam pra `interno` hoje (podem já ter policy própria não
  amarrada a `empresas_visiveis`) ou se têm o mesmo gap.

## Tasks propostas

| Task | Tag | Descrição |
| --- | --- | --- |
| V11.I.1 | banco | ✅ Função `fn_empresa_matriz()` (ou inline) que resolve a empresa com `tipo='matriz'` — fonte única, reusada nas policies novas |
| V11.I.2 | banco | ✅ Split das policies de SELECT em `leads`/`oportunidades`/`clientes`/`cotacao_*`/`metas`/`canais`: adicionar `or (has_role(auth.uid(),'interno') and empresa_id in (select id from empresas where tipo='matriz'))`, sem tocar nas policies de escrita (`for all`/`for insert/update/delete`) — mais `propostas`/`cotacoes` (V11.I.3) e `premiacao_lancamentos`/`comissao_lancamentos` (Relatórios, Risco #2) |
| V11.I.3 | banco | ✅ Investigar se Vendas/Pipeline geral (áreas do Assistente Comercial) têm o mesmo gap ou já funcionam — **resposta: tinham o mesmo gap, entraram nesta mesma migration** (`propostas`/`cotacoes`, usadas por `/operacao/vendas` e `/operacao/pipeline-geral`) |
| V11.I.4 | front | ✅ Verificar no navegador que Marketing loga e vê dado real em Leads/Distribuição/Relatórios (não só menu vazio); mesmo pra Assistente Comercial em Vendas/Pipeline |
| V11.I.5 | testes | ✅ RLS: `interno` vê leads/etc. da Matriz, não vê de nenhuma franquia (Master/Individual/Full); escrita continua bloqueada pra `interno` em todas essas tabelas; Marketing e Assistente Comercial cada um só com as próprias áreas — `tests/db/rls-escopo-interno-matriz.test.ts` (455 linhas, positivo+negativo) |

## Riscos

1. **Não é 1 função nova por tabela — é o MESMO padrão repetido em ~6-8 policies.**
   Cuidado pra não duplicar a subquery `select id from empresas where tipo='matriz'`
   em cada uma sem uma function; prefira `security definer stable` function única.
   *(Confirmado: `fn_empresa_matriz()` única, reusada em todas.)*
2. **"Relatórios" pode ler mais tabelas do que as 6 nomeadas no gap.** A tela consome
   `src/lib/relatorios/registro.ts` (registro de relatórios), não uma tabela única —
   preciso investigar quais RPCs/tabelas cada relatório do Marketing usa antes de saber
   se a lista de 6 tabelas é completa ou se falta mais alguma. *(Resposta: sim, lia
   mais — a migration final também tocou `propostas`, `premiacao_lancamentos` e
   `comissao_lancamentos` (base do relatório de Comissão), além das 6 originais.)*
3. **`cotacao_*` hoje são policies `for all` (leitura+escrita juntas)** — abrir leitura
   pra `interno` SEM abrir escrita exige separar em duas policies (`for select` /
   `for insert, update, delete`), não só adicionar uma condição na policy única.
   *(A técnica final foi outra: `cotacoes` (tabela-mãe) já tinha uma policy de SELECT
   própria — não era `for all`; para as 6 tabelas-filha que são `for all`
   (`cotacao_coberturas/perfil/premios/segurado/seguro/veiculo`), a solução foi criar
   uma policy NOVA só de SELECT ao lado da `_rw` existente — RLS combina com OR — em
   vez de separar a policy `for all` original em duas. Resultado equivalente, técnica
   diferente da prevista aqui.)*
