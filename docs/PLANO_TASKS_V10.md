# Plano de Tasks — CoteCerto V10

**Catálogo original:** `clickup_tasks_v10.csv` (78 tasks)

**Estado consolidado:** 23/07/2026

## Situação

O plano original continua válido para rastreabilidade, mas não representa mais
um backlog integral. A maior parte das frentes foi implementada entre 13 e
23/07. Commits e testes são a evidência de conclusão; o CSV não contém o status.

As 78 linhas, dependências e estimativas originais permanecem preservadas em
`clickup_tasks_v10.csv`. A tabela abaixo consolida execução por frente; a matriz
de evidências liga cada grupo de tasks aos artefatos verificáveis.

| Lista         | Estado         | Observação                                        |
| ------------- | -------------- | ------------------------------------------------- |
| 0 Pré-obra    | concluída      | CLI, migrations, tipos e base de testes           |
| S Segurança   | concluída      | S1–S6 e correções adicionais de escopo            |
| D Integridade | concluída      | D1–D5                                             |
| K Infra       | operacional    | CI, Docker, GHCR, deploy e runbook                |
| T Testes      | operacional    | unit, DB, RLS, E2E e cobertura                    |
| G1 Hierarquia | concluída      | supervisor, superior, rede, classificação e grupo |
| G2 Franquias  | base concluída | modalidade e bifurcação Individual/Full           |
| G3 Desconto   | concluída      | persistência, RPCs, UI, política e respostas      |
| G4 Comissão   | concluída      | motor, ledger, fechamento, Elite e tela           |
| G5 Telas      | concluída      | Premiações e Relatórios reais                     |
| G6 Renovação  | concluída      | cron e início de renovação                        |
| G7 Negociação | concluída      | versões, status e painel                          |
| Tutoriais     | parcial        | coach-tips/modal; roteiros completos ausentes     |
| Q Qualidade   | em aceite      | refactors feitos; Q3/Q4 exigem passe final        |
| Quiver        | em integração  | infraestrutura e expansão do wizard em andamento  |

## Matriz de evidências

| Tasks     | Commits de referência                                            | Migration/teste de referência                                                 |
| --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| S1–S4     | `702baf1`, `6e019c2`, `5c120d9`, `eaebecc`                       | `20260714200110_s1_*`; `rls-views-security-invoker.test.ts`                   |
| S5–S6     | `3c59b86`, `94d124f`                                             | `20260714211602_s6_*`; `rls-catalogos-anon.test.ts`                           |
| D1–D2     | `df47964`, `148b569`, `ffa0973`, `df753b2`                       | migrations `d1_*`/`d2_*`; testes `constraints-*`                              |
| D3–D5     | `fc35ad2`, `8a298b4`, `0bd267f`, `2d7242e`–`27fdfb0`             | migrations `d3_*`/`d4_*`; testes de schemas e documentos                      |
| K1/K5     | `0172673`, `51e505d`, `5bf6641`                                  | `Dockerfile`, workflows e `RUNBOOK_DEPLOY.md`                                 |
| T1–T4/T9  | `f20ec34`, `81adbbd`, `fd9fa94`, `aa13790`, `12ad524`            | `tests/e2e/*`, `tests/db/*`, cobertura no CI                                  |
| G1.1–G1.3 | `d4af332`, `db39a99`, `2da7174`                                  | migrations `g1_1_*`, `g1_2_*`; `rls-hierarquia-multinivel.test.ts`            |
| G1.4–G1.6 | `3ae67b5`, `c762da7`, `33657bf`, `c70fbf3`, `c09806c`            | migrations `g1_4_*`, `g1_6c_*`; `solicitar-vendedor.test.ts`                  |
| G2        | `c3bb61f`                                                        | migration `g2_1_modalidade_franquia.sql`; `group-scope.ts`                    |
| G3.1–G3.3 | `da1cab1`, `7f18b13`, `8fee8f5`                                  | migrations `g3_1_*`, `g3_2_*`; `rls-desconto.test.ts`, `rpc-desconto.test.ts` |
| G3.4–G3.6 | `82cd209`, `e978112`, `2776d10`                                  | inbox, política e respostas-padrão no front                                   |
| G4.1–G4.6 | `64e6855`, `70e401f`, `17120e3`, `a74ff41`, `0fd15b6`, `62ccdf6` | migrations `g4_*`; testes `golden-*` e `ledger-competencia.test.ts`           |
| G5        | `0ded4b3`, `c9a6640`, `547e27d`                                  | migration `g5_1_*`; telas Premiações e Relatórios                             |
| G6.1–G6.2 | `569f4d4`, `b4c7e01`                                             | migrations `g6_1_*`, `g6_2_*`; `renovacao-cron.test.ts`                       |
| G6.3–G6.4 | parcial                                                          | modal/coach-tips; roteiros completos não encontrados                          |
| G7        | `1546a21`, `2f9c1a3`                                             | migrations `g7_1_*`; painel de negociação                                     |
| Q1–Q2     | `b854e86`, `005e8ee`, `8cbe210`                                  | extração de hooks/componentes dos arquivos grandes                            |
| Q3–Q4     | `1290cac`, `0394d6e` + correções de 19–23/07                     | `Q3_DIVERGENCIAS_PROTOTIPO.md` e `Q4_ROTEIRO_QA_MANUAL.md`                    |
| Quiver    | `154664c`, `544886e`, `0f2b66e`, `2989a0e`                       | migrations Quiver/wizard de 22–23/07 e schemas Zod                            |

## Sequência restante

1. Fechar o contrato ponta a ponta com a Quiver.
2. Rodar CI completa e reconstrução local do banco.
3. Executar Q4 nas seis experiências.
4. Corrigir divergências reproduzidas.
5. Revisar segurança e segredos.
6. Aplicar banco e imagem em produção.
7. Executar smoke e registrar aceite.

## Regra de atualização

Novas tasks devem apontar para commit, migration e teste correspondentes. Tela
existente não basta: RLS, comportamento por perfil e estados de erro fazem parte
da definição de pronto.
