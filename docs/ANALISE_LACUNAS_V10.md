# Análise de Lacunas — CoteCerto V10

**Corte:** 23/07/2026

**Evidência:** `main`, 82 migrations canônicas, 43 arquivos `*.test.ts`/`*.spec.ts`
(47 arquivos no diretório `tests/`, contando helpers) e protótipo V10.

## Resumo executivo

O diagnóstico de 12/07 apontava cerca de 60% de prontidão e ausência dos pilares
da V10. Esse retrato não é mais válido. Entre 13 e 23/07 foram entregues segurança,
integridade, hierarquia, franquias Individual/Full, desconto multinível, motor de
comissão, renovações, premiações, relatórios, negociação de propostas, testes,
containerização e a primeira integração real com a Quiver.

O produto está em fase de **integração final e QA**, não mais de construção dos
pilares V10. A prontidão não é expressa em percentual até a execução completa do
roteiro Q4; percentual sem aceite por perfil produziria falsa precisão.

## Entregue e comprovado no repositório

| Frente                   | Estado em 23/07 | Evidência principal                                          |
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
| Quiver                   | em integração   | webhook/API, status e expansão do wizard                     |

## Entregas recentes do wizard e Quiver

- Infra da integração real com Quiver e webhook autenticado.
- Passo Veículo ampliado com uso, antifurto, acessórios e dados complementares.
- Passo Perfil ampliado com proprietário, atividade e campos reais da API.
- Passo Coberturas ampliado com plano, assistências, descontos e comissões.
- Persistência, tipos Supabase e schemas Zod atualizados junto das migrations.

## Lacunas abertas

### Aceite manual por perfil

Executar integralmente `Q4_ROTEIRO_QA_MANUAL.md` nas seis experiências: Matriz,
Vendedor, Franquia Individual, Master, Supervisor e Franquia Full. O foco é
isolamento RLS, navegação, escopo da rede e regras financeiras.

### Integração Quiver ponta a ponta

Validar em ambiente integrado: envio, autenticação, callbacks, idempotência,
falhas/retry e atualização da cotação. A infraestrutura existe, mas a conclusão
depende do serviço externo e de credenciais corretas.

### Fidelidade final ao protótipo

As principais divergências estruturais registradas no Q3 foram corrigidas entre
19 e 23/07. Falta um passe visual completo em resoluções reais, incluindo estados
vazios, loading, erro, modais e responsividade.

### Tutoriais por perfil

Existem coach-tips e um modal simples, mas o código não contém os três roteiros
longos descritos no protótipo. Ainda faltam os onboardings completos de
Vendedor/Individual, Matriz e Grupo.

### Go-live

- Aplicar migrations em produção somente após reset e testes locais.
- Executar smoke de produção após banco e imagem.
- Confirmar segredos Quiver e variáveis server-only.
- Registrar o resultado do Q4 e aprovar formalmente a liberação.

## Riscos atuais

- Screenshots e artefatos externos antigos podem mostrar estados anteriores.
- O gate visual do front não substitui RLS.
- A Quiver é dependência externa e pode bloquear o fluxo mesmo com o app saudável.
- Deploy de banco continua condicionado à validação local.

## Definição de pronto

V10 pronta para go-live significa: CI verde, banco local reconstruído do zero,
Q4 aprovado nas seis experiências, Quiver validada e smoke de produção sem
regressões críticas.
