# Análise de Lacunas — CoteCerto V10

**Corte:** 28/07/2026

**Evidência:** `main`, 82 migrations canônicas, 43 arquivos `*.test.ts`/`*.spec.ts`
(47 arquivos no diretório `tests/`, contando helpers) e protótipo V10.

## Resumo executivo

O diagnóstico de 12/07 apontava cerca de 60% de prontidão e ausência dos pilares
da V10. Esse retrato não é mais válido. Entre 13 e 23/07 foram entregues segurança,
integridade, hierarquia, franquias Individual/Full, desconto multinível, motor de
comissão, renovações, premiações, relatórios, negociação de propostas, testes,
containerização e a primeira integração real com a Quiver.

Entre 24 e 28/07 a integração Quiver foi fechada (fases 5–6, com testes de RLS/E2E
e três fixes de payload/prêmios/dados reais no resultado), o tutorial por persona
foi implementado, e o roteiro Q4 foi executado nas seis experiências — aprovado
sem divergências reais (confirmação verbal do dono do produto, sem evidência
item a item registrada no repositório). O produto é tratado como fechado para
go-live da V10 a partir dessa execução.

## Entregue e comprovado no repositório

| Frente                   | Estado em 28/07 | Evidência principal                                          |
| ------------------------ | --------------- | ------------------------------------------------------------ |
| S1–S6 Segurança          | concluída       | RLS, `security_invoker`, grants e testes negativos           |
| D1–D5 Integridade        | concluída       | checks, normalização, JSONB, Zod e testes                    |
| G1 Hierarquia            | concluída       | `supervisor`, `superior_id`, rede multinível, xdash/xacessos |
| G2 Individual/Full       | base concluída  | modalidade persistida e gating por grupo                     |
| G3 Desconto              | concluída       | tabelas, RPCs, inbox, política, respostas-padrão             |
| G4 Comissão              | concluída       | ledger, CLT, overrides, fechamento, Elite e tela             |
| G5 Premiações/Relatórios | concluída       | schemas e telas reais; `ProtoPage` encerrado                 |
| G6 Renovações            | concluída       | cron, expiração e RPC de início                              |
| G7 Negociação            | concluída       | versões, status, RPCs e painel                               |
| T/CI                     | operacional     | unit, DB, E2E, cobertura e workflows                         |
| K/Deploy                 | operacional     | Docker/GHCR, deploy script e runbook                         |
| Quiver                   | concluída       | fases 0–6 com testes RLS/E2E + 3 fixes pós-integração         |

## Entregas recentes do wizard e Quiver

- Infra da integração real com Quiver e webhook autenticado.
- Passo Veículo ampliado com uso, antifurto, acessórios e dados complementares.
- Passo Perfil ampliado com proprietário, atividade e campos reais da API.
- Passo Coberturas ampliado com plano, assistências, descontos e comissões.
- Persistência, tipos Supabase e schemas Zod atualizados junto das migrations.
- Cálculo real substituindo o mock (`bec190e`, 25/07) e testes RLS/E2E da
  integração (`aadef5e`, 26/07).
- Fixes de payload/parsing de erro (`9fceb23`) e de registro de prêmios com
  card sem seguradora (`e2a457d`), ambos 27/07.
- Tela de resultado do cálculo passou a exibir plano, franquia, coberturas e
  forma de pagamento reais da Quiver em vez de valores simulados/hardcoded
  (`fbab8a4`, PR #91, 28/07).

## Lacunas abertas

### Aceite manual por perfil

`Q4_ROTEIRO_QA_MANUAL.md` foi executado em 28/07 nas seis experiências e
aprovado sem divergências reais (confirmação verbal do dono do produto). Não
há evidência item a item (captura, perfil, rota, viewport) registrada no
repositório — a execução não ficou documentada passo a passo.

### Integração Quiver ponta a ponta

Fechada com testes de RLS/E2E (`aadef5e`, 26/07) e três fixes subsequentes de
payload, registro de prêmios e dados reais no resultado do cálculo (27–28/07).
Dois gotchas de **ambiente de dev local** (não de produção) ficaram
documentados em memória de sessão: o webhook de volta do robô Docker é
bloqueado pelo `allowedHosts` do Vite (falta adicionar `host.docker.internal`
— task pendente aberta), e o robô Playwright pode falhar por timing no portal
real da Quiver (flakiness externa, projeto separado).

### Fidelidade final ao protótipo

As principais divergências estruturais registradas no Q3 foram corrigidas entre
19 e 23/07. O passe visual completo (as 7 pendências remanescentes do Q3) foi
coberto pela execução do Q4 em 28/07, sem divergências reais reportadas —
também sem evidência formal por item.

### Tutoriais por perfil

Engine de tutorial e conteúdo por persona implementados em 24/07 (`8bfa579`).

### Go-live

Concluído — confirmação verbal do dono do produto em 28/07/2026:

- ~~Aplicar migrations em produção somente após reset e testes locais.~~ Feito; produção em operação.
- ~~Executar smoke de produção após banco e imagem.~~ Feito.
- ~~Confirmar segredos Quiver e variáveis server-only.~~ Feito.
- ~~Registrar o resultado do Q4 e aprovar formalmente a liberação.~~ Aprovado
  verbalmente em 28/07 (sem registro formal por item).

**V10 fechado para go-live.** Nenhuma lacuna aberta rastreada neste documento.

## Riscos atuais

- Screenshots e artefatos externos antigos podem mostrar estados anteriores.
- O gate visual do front não substitui RLS.
- A Quiver é dependência externa e pode bloquear o fluxo mesmo com o app saudável.
- Deploy de banco continua condicionado à validação local.

## Definição de pronto

V10 pronta para go-live significa: CI verde, banco local reconstruído do zero,
Q4 aprovado nas seis experiências, Quiver validada e smoke de produção sem
regressões críticas.
