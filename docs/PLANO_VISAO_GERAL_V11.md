# Plano — Frente 7 · Visão geral com período único

## O que já existe hoje (achado ao investigar, plano oficial estava desatualizado)

`docs/PLANO_TASKS_V11.md` lista V11.7.1 a V11.7.6 sem marcar nenhuma como ✅, mas boa parte
já foi implementada em 29/07/2026, antes de a numeração de frentes virar prática (commits
`10e8bdd`, `1d34317`, `576bc43`):

- **V11.7.1 — pronto.** `normalizar_periodo_visao_geral` (RPC) resolve dia/semana/quinzena
  móveis, mês e personalizado em `[inicio,fim)` America/Sao_Paulo
  (`supabase/migrations/20260729043000_v11_7_1_periodo_unico.sql`). Testado (banco + unit).
- **V11.7.2 — parcial.** Todos os widgets já leem a mesma `normalizedPeriod`. Mas o cálculo
  do KPI grid, ranking de franquias/vendedores e gráfico "Evolução no período" continua
  100% client-side, buscando até 5000 linhas cruas de `leads`/`propostas`/`empresas`/
  `profiles` e recalculando no `useMemo` (`src/routes/_authenticated/comando/visao-geral.tsx:122-359`)
  — diferente de Funis por canal e Comissão do grupo, que já são RPC.
- **V11.7.3 — pronto.** `funis_por_canal_visao_geral` (RPC), componente `ChannelFunnels`,
  testado.
- **V11.7.4 — parcial.** 5 alertas reais e clicáveis já existem (sem-atendimento,
  sla-estourado, vendas-não-pagas, estornos, renovações) em `src/lib/dashboard-alerts.ts` +
  `use-dashboard-alert-counts.ts`. Faltam exatamente os 3 que o próprio plano já rastreava
  como bloqueados: pendência da seguradora, franquia abaixo da meta, vendedor em atenção.

**Bugs ao vivo encontrados durante a investigação** (não é regressão desta frente, é o
problema que V11.7.5 existe para resolver, só que também aparece em outro lugar):
- `visao-geral.tsx:275` — `propostasMes.filter(x => x.status === "gerada")` como heurística
  de "em transmissão". `status='gerada'` é só "ainda não enviada à seguradora", não pendência.
- `operacao/vendas.tsx` `classify()` — joga na aba "Em transmissão" tanto proposta nem
  enviada quanto proposta genuinamente pendente da seguradora, porque não checa
  `transmitida_em`.
- A fórmula CERTA já existe, mas só dentro do CTE de `funis_por_canal_visao_geral`:
  `transmitida_em is not null and emitida_em is null and cancelada_em is null`.

## O que falta de fato (escopo desta rodada)

| Task | Tag | Descrição | Depende de |
| --- | --- | --- | --- |
| V7.5 | banco | Função/view canônica `esta_pendente_seguradora` (mesma fórmula já usada nos funis) — reaproveitável, com teste dedicado (hoje só é testada indiretamente via funis) | — |
| V7.5b | front | Aplicar a função canônica no cálculo do alerta da Visão Geral (troca a heurística `status==='gerada'` de `visao-geral.tsx:275`) | V7.5 |
| V7.6a | banco | Régua "franquia abaixo da meta" por período flexível: RPC análoga ao pró-rata de `fn_calcular_performance_pessoa` (D3), mas por `empresa_id` — pró-rata de `metas.meta_vendas` (escopo `'empresa'`) pela janela normalizada de V11.7.1, sobre `propostas.emitida_em` (não a view legada `v_franquia_kpis`/`oportunidades`) | V11.7.1 |
| V7.6b | front | 2 novos alertas na Visão Geral: "N franquias abaixo da meta no período" (usa V7.6a) e "N vendedores em atenção/travado" (usa `profiles.performance_status`, já existe desde a Frente 4 — é só consumo, sem trabalho de banco) | V7.6a, D4 |
| V7.6c | front | Alerta "N vendas pendentes da seguradora" reaproveitando V7.5 | V7.5 |
| V7.7 | testes | Testes de banco para V7.5 (positivo/negativo) e V7.6a (pró-rata correto, RLS por empresa visível); testes unitários dos 3 novos alertas em `dashboard-alerts.ts` | V7.5, V7.6a |
| V7.8 | docs | Atualiza `docs/PLANO_TASKS_V11.md` marcando V11.7.1/V11.7.3 como ✅ (bookkeeping — já estavam prontas, só não documentadas) | — |

## Decisões que estou tomando, para você contestar

1. **V11.7.2 (mover KPI grid/rankings/gráfico para RPC/view) fica FORA desta rodada.**
   É uma refatoração de performance, não um requisito funcional novo — os widgets já
   respeitam o período único (o objetivo real da task), só o *onde* calcula que diverge do
   padrão dos outros dois widgets. Não é bloqueante para nenhum alerta novo. Registro como
   dívida técnica consciente, igual ao que o próprio plano já faz em outros pontos.
2. **"Destinos por perfil novo" (a 4ª linha da tabela de pendências do plano) fica FORA.**
   Ela depende da Frente 8 (menus por perfil), que ainda não foi auditada/fechada. Os 3
   alertas novos apontam para destinos que já existem hoje para os perfis que já enxergam a
   Visão Geral (Matriz/interno) — não invento navegação nova.
3. **"Franquia abaixo da meta" usa `propostas.emitida_em`, não `oportunidades`/`v_franquia_kpis`.**
   A view legada é mês-fixo e lê uma tabela que a V11 não usa mais como fonte de venda real;
   replicar o padrão que D3 já validou (pró-rata sobre a fonte real) é mais consistente do
   que ressuscitar a view antiga.
4. **Persistir `pendencia_seguradora` como coluna, ou manter derivado numa function?**
   Vou manter **derivado** (function/view), não coluna nova. Não precisa de índice dedicado
   pro volume atual, e evita mais um lugar pra manter sincronizado com `transmitir_proposta`/
   `marcar_apolice_emitida`. Se o volume crescer e isso ficar lento, dá pra materializar depois
   sem mudar a assinatura pra quem consome.

## Riscos

1. **`operacao/vendas.tsx` NÃO entra nesta rodada, de propósito.** Confirmei: a aba
   "Transmissão" ali é um bucket único de acompanhamento (tudo que não é cancelada/paga/
   emitida — `classify()`, linhas 70-74), não distingue "ainda não enviada" de "pendente da
   seguradora" hoje, e não precisa distinguir para servir seu propósito operacional (fila de
   acompanhamento da equipe de vendas). Separar isso é uma mudança de produto (nova aba/filtro),
   não uma correção de bug — fica fora do escopo desta frente.
2. **Pró-rata de meta por franquia é heurística, igual ao pró-rata por pessoa da D3** — meta
   é mensal, período pode ser diário/semanal/personalizado; a mesma limitação que D3 já aceitou
   (proporcionalização por dias corridos, não por dia útil) se aplica aqui.

## Sequência

V7.5 (banco) → V7.5b (front, corrige os 2 lugares com heurística errada) → V7.6a (banco) →
V7.6b + V7.6c (front, em paralelo) → V7.7 (testes) → V7.8 (docs, pode ser feito em qualquer
momento).
