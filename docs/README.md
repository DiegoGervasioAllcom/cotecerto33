# Documentação do CoteCerto

**Atualizado em:** 12/08/2026

Markdown é o formato canônico da documentação. O estado real deve ser
confirmado pelo código, pelas migrations, pelos testes e, quando a afirmação
for sobre produção, por evidência do ambiente publicado. PDFs locais derivados
não são fontes e ficam fora do Git.

## V11 — documentação viva

| Documento                 | Finalidade                                                         |
| ------------------------- | ------------------------------------------------------------------ |
| `PLANO_TASKS_V11.md`      | plano canônico, dependências e evidências por frente               |
| `DOC_TECNICA_V11.md`      | arquitetura, frontend, domínios, testes, deploy e banco            |
| `DOC_BANCO_V11.md`        | schema, RLS e RPCs; conferir sempre contra as migrations canônicas |
| `GUIA_CLIENTE_V11.md`     | guia operacional em linguagem não técnica                          |
| `Q4_ROTEIRO_QA_MANUAL.md` | roteiro de aceite manual V11, sem credenciais incorporadas         |
| `SETUP_DEV.md`            | preparação do ambiente local                                       |
| `RUNBOOK_DEPLOY.md`       | deploy, rollback e prova de produção self-hosted                   |

Em 12/08/2026 o repositório tinha 149 migrations em
`supabase/migrations/`, 67 arquivos de teste de banco, 34 unitários e 16 specs
E2E. Essas contagens são evidência datada e devem ser recalculadas antes de uma
nova publicação.

## Fontes funcionais e de UX da V11

| Documento                           | Finalidade                                                       |
| ----------------------------------- | ---------------------------------------------------------------- |
| `v11/FLUXOS_OPERACIONAIS.html`      | fonte da verdade das regras; 5 fluxos navegáveis                 |
| `v11/RELATORIO_DEPARA_V10_V11.html` | DE/PARA por etapa; a coluna V10 descreve um design intermediário |
| `v11/HANDOFF_PRODUCAO_V11.html`     | itens que o protótipo simulava e exigiam implementação real      |
| `v11/MODELOS_EMAIL_ACESSO.html`     | conteúdo dos e-mails de acesso                                   |
| `../cotecerto_prototipo_v11.html`   | referência de UX V11, build 28/07 r40                            |

## Planos de implementação preservados

`PLANO_HIERARQUIA_V11.md`, `PLANO_CONVITE_V11.md`, `PLANO_FILAS_V11.md`,
`PLANO_CADASTROS_V11.md`, `PLANO_REGUA_V11.md`,
`PLANO_FRANQUIA_FULL_V11.md`, `PLANO_GOVERNANCA_V11.md`,
`PLANO_VISAO_GERAL_V11.md` e `PLANO_ESCOPO_INTERNO_V11.md` registram decisões
e execução por frente. `PERGUNTAS_PARA_LIS.md` registra decisões de produto.
Eles não substituem o plano canônico nem prova atual de produção.

## Auditorias datadas

Os arquivos em `auditorias/` são snapshots históricos: preserve-os e não
reescreva conclusões antigas como se fossem atuais. Para Acessos e Permissões,
`AUDITORIA_ACESSOS_PERMISSOES_V11_2026-08-10_rodada3.md` sucede a `rodada2`,
que sucede `AUDITORIA_ACESSOS_PERMISSOES_V11_2026-08-10.md`. As demais
auditorias tratam recortes distintos; uma correção posterior no código ou no
plano não apaga a evidência da rodada original.

`ANALISE_LACUNAS_V11.md` é o diagnóstico fechado em 04/08/2026 e permanece
como histórico. Para status corrente, use `PLANO_TASKS_V11.md` e confirme as
evidências no repositório e no ambiente correspondente.

## V10 — referência histórica

`ANALISE_LACUNAS_V10.md`, `DOC_TECNICA_V10.md`,
`MAPA_PROTOTIPO_PERFIS.md`, `PLANO_TASKS_V10.md`,
`clickup_tasks_v10.csv`, `Q3_DIVERGENCIAS_PROTOTIPO.md` e
`../cotecerto_prototipo_v10.html` são preservados para rastreabilidade e
comparação. Não são a especificação corrente da V11.
