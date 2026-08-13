# Plano — Frente 2 · Duas filas de aprovação

**Aberto em:** 30/07/2026 · **Status:** ✅ concluído e mergeado — [PR #102](https://github.com/DiegoGervasioAllcom/cotecerto33/pull/102)
(30/07/2026, 9 commits, F1-F11). Typecheck/lint limpos, 20 testes de banco
(`tests/db/filas-aprovacao-v11.test.ts`) e 30 E2E (`tests/e2e/`, incluindo o novo
`filas-aprovacao.spec.ts`) verdes. Worktree e branch já removidos (mergeados).

**Branch:** `feat/v11-filas-aprovacao` (mergeada e apagada; era da `main`, com as Frentes 0 e
1 já mergeadas nos PRs #97 e #100)

**Escopo:** V11.2.3 a V11.2.9. **Fora:** V11.2.1 e V11.2.2 (e-mails e criar senha), adiadas
por decisão de 28/07 — seguem adiadas.

> **Nota de supersessão (12/08/2026):** “seguem adiadas” descreve o recorte histórico
> deste plano. V11.2.1/V11.2.2 foram implementadas posteriormente, e o acesso aprovado
> ganhou reenvio seguro do link ainda não ativado. Consulte `PLANO_TASKS_V11.md` para o
> estado consolidado; esta nota não confirma o estado de produção.

**Fontes:** fluxo "Acesso e visualização" em `docs/v11/FLUXOS_OPERACIONAIS.html` · Etapa 2 do
Relatório DE/PARA · `openClassify`/`buildClassifyModal`/`openFullApprove` e `PROD_PADRAO` no
protótipo r40.

## O que a Frente 1 já deixou pronto

Esta frente é a colheita da anterior. O convite grava o payload estruturado e
`empresas.convite_id` liga o pedido ao convite, então aqui não se adivinha nada:

- **`trilha`** decide o bloco da fila (interno × rede).
- **`perfil` + `vinc_tipo` + `vinc_empresa_id`** decidem _para qual fila_ o pedido vai, e é
  isso que faz o vendedor de Franquia Full nunca chegar à Matriz.
- **`cargo_id`** traz o preset de áreas para o modal já preenchido.
- **`convite_id is null`** distingue Convite Supper de criação manual por exceção — o chip
  de origem que a fila mostra.

## A mudança de conceito

Hoje a fila é uma lista só, e o modal de análise abre em branco: quem aprova escolhe o tipo
do zero. Na V11:

1. **Duas filas por bloco.** Pendentes do time interno no bloco Matriz; da rede no bloco
   Externos. E o vendedor de Franquia Full **não aparece em nenhum dos dois** — cai na fila
   da própria franquia, que aprova sozinha. "A equipe é dela, a aprovação também."
2. **O modal abre travado** no que o convite definiu. Tipo e vínculo são herdados;
   "Reclassificar" existe, mas como **exceção registrada**, não como fluxo normal.
3. **A aprovação passa a gravar escopo de verdade:** cargo + áreas ajustáveis (interno),
   produtos e canais (vendedores e franquias), e o Supervisor de Vendas (no caso do Master).

## Tasks

| Task | Tag    | Descrição                                                                                                                                                                                                                                                                                       | Depende de                                |
| ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| F1   | banco  | **Roteamento da fila** (V11.2.3): função que, do payload do convite, resolve o destino — `matriz_interno`, `matriz_rede` ou `franquia:<empresa_id>`. Vendedor com `vinc_tipo='full'` roteia para a franquia, nunca para a Matriz                                                                | —                                         |
| F2   | banco  | **RLS das duas filas** (V11.2.9): a Matriz/Coordenador vê os dois blocos dela e **não** vê o pendente de uma Full; a Full vê só o dela. Casos negativos são o ponto                                                                                                                             | F1                                        |
| F3   | banco  | **Produtos padrão por bloco** (V11.2.8): `PROD_PADRAO` do protótipo — interno herda todos, externo só Auto. Tabela de configuração, não constante, porque a tela de Personalização edita                                                                                                        | —                                         |
| F4   | banco  | **Persistir o escopo da aprovação**: produtos e canais habilitados por acesso (`profile_canais` já existe da V11.0.4), cargo e áreas (já existem da Frente 0), e o Supervisor de Vendas do Master via `superior_id`                                                                             | F3                                        |
| F5   | banco  | **RPC de aprovação** que grava tudo numa transação e registra reclassificação como exceção no histórico imutável (V11.0.6)                                                                                                                                                                      | F4                                        |
| F6   | front  | **Pendentes em dois blocos** (V11.2.4), com o chip "TÍTULO \| qualificador" do tipo declarado, o vínculo e a origem (Convite Supper × manual)                                                                                                                                                   | F1                                        |
| F7   | front  | **Modal de análise travado** (V11.2.6): tipo e vínculo herdados em texto fixo; "Reclassificar" abre os seletores e marca o pedido como exceção                                                                                                                                                  | F5                                        |
| F8   | front  | **Campos da aprovação** (V11.2.7): cargo (preset) + áreas ajustáveis com "Todos"; produtos e canais com "Todos"; seletor de Supervisor de Vendas quando o pedido é de Master. **Master franqueado não tem produtos nem canais** — não vende nem recebe leads                                    | F7                                        |
| F9   | front  | **Fila da Franquia Full** (V11.2.5): a Full aprova o vendedor dela na tela dela, sem depender da Matriz                                                                                                                                                                                         | F2, F7                                    |
| F10  | testes | E2E: convite de vendedor de Full → o pedido aparece na fila **da franquia** e não na da Matriz; convite interno → bloco Matriz com o cargo certo                                                                                                                                                | F9                                        |
| F11  | front  | **Tela de Leads passa a ler `canal_id`** em vez do texto livre `leads.origem`: filtro vem da tabela `canais` (não mais dos valores distintos das linhas) e o selo de mídia paga sai de `canais.tipo='supper'`, não do regex `/ads\|meta\|google/i`. Fecha a parte pendente do item 9 nesta tela | F10, e o PR de alertas do Codex na `main` |

## Decisões que estou tomando, para você contestar

1. **O roteamento é função de banco, não filtro de tela.** Se a fila fosse recortada no
   front, a Matriz continuaria _podendo_ aprovar o vendedor de uma Full — só não veria. A
   regra "a aprovação é dela" precisa da policy.
2. **"Reclassificar" não apaga o declarado.** Guardo o tipo do convite e o tipo final
   separados, com o motivo. Sobrescrever perderia a informação de que houve exceção, que é
   justamente o que a Etapa 2 quer rastrear.
3. **Reaproveito o que a Frente 0 criou** em vez de tabelas novas: `cargos`/`profile_areas`
   para escopo interno, `profile_canais` para canais, `superior_id` para a supervisão. A
   aprovação passa a ser o lugar que _popula_ isso.
4. **A migração de `leads.origem` para `canal_id` entra, mas por último (F11).** O Codex
   terminou a frente de alertas, então não há mais edição concorrente no arquivo. Só que a
   branch dele **ainda não está na `main`**, e ela mexe em 54 linhas de `leads.tsx` — se eu
   migrar o arquivo antes disso, os dois PRs conflitam nele. Deixando F11 no fim, o PR de
   alertas tende a já ter entrado e eu rebaseio antes de tocar no arquivo. Se ainda não
   tiver entrado quando eu chegar lá, aviso em vez de resolver conflito no escuro.

## Riscos

1. **O banco local é compartilhado com o worktree do Codex.** `db reset` meu interrompe
   teste dele e vice-versa. Vou avisar antes de resetar; se preferir, subimos uma segunda
   instância Supabase numa porta separada.
2. **`empresas` acumula papéis.** O pedido pendente é uma linha de `empresas`, mesmo quando
   se trata de uma pessoa física (vendedor, cargo interno). Já era assim na V10 e não vou
   redesenhar isso agora — mas é a raiz de por que a fila é confusa, e vale registrar como
   dívida de modelagem para a V12.
3. **Risco histórico, já endereçado.** Sem e-mail, a aprovação não completava o ciclo.
   A tela de criar senha e o envio/reenvio do acesso foram entregues depois desta frente;
   a fila permaneceu independente desse transporte.

## Sequência

F1 → F2 (banco e RLS primeiro, com os casos negativos travados) → F3/F4/F5 → F6/F7/F8
(a tela, na ordem fila → modal → campos) → F9 (a fila da Full) → F10 → **F11 por último**,
depois de trazer a `main` com o PR de alertas do Codex.
