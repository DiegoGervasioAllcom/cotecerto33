# Documentação do CoteCerto

**Atualizado em:** 04/08/2026

Esta pasta contém fontes vivas e insumos ainda relevantes. O estado do produto
deve ser confirmado pelo código, migrations e testes da `main`.

## V11 — implementada (pacote de análise fechado para o TI em 28/07/2026)

Todas as Frentes 0-8 estão mergeadas; a Frente 9 (fora do caminho crítico) segue com
o item do WhatsApp Business API pendente de conta externa. Detalhe completo em
`PLANO_TASKS_V11.md`.

| Documento                          | Finalidade                                                |
| ---------------------------------- | --------------------------------------------------------- |
| `ANALISE_LACUNAS_V11.md`           | **histórico, fechado em 04/08/2026** — diagnóstico do corte de 28/07, todas as lacunas já entregues (ver `PLANO_TASKS_V11.md`) |
| `PLANO_TASKS_V11.md`               | tasks da V11 por frente, com dependências e bloqueios     |
| `v11/FLUXOS_OPERACIONAIS.html`     | **fonte da verdade das regras** — 5 fluxos navegáveis     |
| `v11/RELATORIO_DEPARA_V10_V11.html`| o que mudou etapa por etapa e onde ver no protótipo       |
| `v11/HANDOFF_PRODUCAO_V11.html`    | 11 itens que o protótipo simula e precisam virar código   |
| `v11/MODELOS_EMAIL_ACESSO.html`    | corpo dos e-mails de acesso                               |
| `../cotecerto_prototipo_v11.html`  | protótipo build 28/07 · r40 — referência de UX da V11     |

### Planos por frente (escritos durante a implementação)

| Documento                       | Finalidade                                                                      | Status                             |
| -------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| `PLANO_HIERARQUIA_V11.md`        | desenho de cargos/áreas da Frente 0 (supervisor Vendas × Operacional como cargo) | ✅ Frente 0 mergeada — PR #97       |
| `PLANO_CONVITE_V11.md`           | Convite Supper da Frente 1 (token, escopos, saídas sem e-mail)                   | ✅ Frente 1 mergeada — PR #100      |
| `PLANO_FILAS_V11.md`             | roteamento das filas de aprovação da Frente 2 (F1-F11)                          | ✅ mergeado — PR #102               |
| `PLANO_CADASTROS_V11.md`         | ciclo de vida de cadastros da Frente 3 (aba Matriz/Rede, desligamento, C1-C15)   | ✅ Frente 3 concluída — 03/08/2026  |
| `PLANO_REGUA_V11.md`             | régua de performance da Frente 4 (D1-D10, interno/rede/full)                     | ✅ concluída (bloco full via 5b)    |
| `PLANO_FRANQUIA_FULL_V11.md`     | Franquia Full como matrizinha da Frente 5/5b (Central da Franquia, Personalização, Performance, Histórico) | ✅ Frente 5 concluída — PR #120 |
| `PLANO_GOVERNANCA_V11.md`        | senha de diretor, dupla aprovação e histórico da Frente 6 (G6.1-G6.6)            | ✅ Frente 6 concluída — 03/08/2026  |
| `PLANO_VISAO_GERAL_V11.md`       | período único e alertas da Frente 7 (V7.5-V7.8)                                 | ✅ Frente 7 concluída — 03/08/2026  |
| `PLANO_ESCOPO_INTERNO_V11.md`    | escopo de leitura do Marketing/Assistente Comercial (V11.I.1-5)                 | ✅ concluído — 04/08/2026           |
| `PERGUNTAS_PARA_LIS.md`          | decisões de produto levadas à Lis (7 itens)                                     | ✅ resolvido — 7/7 itens            |

## Docs vivos, não datados por versão

| Documento                 | Finalidade                                                              |
| -------------------------- | ------------------------------------------------------------------------ |
| `DOC_TECNICA_V11.md`      | **documentação técnica completa** — arquitetura, frontend, domínios de negócio, testes, deploy e o banco (capítulo 10, mesmo conteúdo do `DOC_BANCO_V11.md`). Ponto de entrada único pra quem quiser o sistema inteiro |
| `DOC_BANCO_V11.md`        | documentação do banco isolada — schema completo por domínio (diagramas ER, colunas, RLS, RPCs), gerada por introspecção direta do Postgres. Regenerar após qualquer migration nova relevante — não é mantida à mão |
| `Q4_ROTEIRO_QA_MANUAL.md` | roteiro de QA manual — **reescrito em 04/08/2026** para cobrir tudo da V11 (substitui a versão V10) |
| `SETUP_DEV.md`            | preparação do ambiente local                                            |
| `RUNBOOK_DEPLOY.md`       | operação da produção self-hosted                                        |

## Fontes canônicas da V10 (referência histórica)

A V10 está fechada para go-live. Estes documentos continuam válidos como registro do
que foi entregue e como base de comparação da V11.

| Documento                      | Finalidade                                 |
| ------------------------------ | ------------------------------------------ |
| `ANALISE_LACUNAS_V10.md`       | estado atual, entregas e pendências        |
| `DOC_TECNICA_V10.md`           | arquitetura implementada e regras técnicas |
| `MAPA_PROTOTIPO_PERFIS.md`     | comportamento esperado por perfil (protótipo V10) |
| `PLANO_TASKS_V10.md`           | execução das 78 tasks e próximos gates     |
| `clickup_tasks_v10.csv`        | catálogo original das tasks                |
| `Q3_DIVERGENCIAS_PROTOTIPO.md` | divergências visuais ainda abertas         |

## Outra fonte

- `../cotecerto_prototipo_v10.html`: especificação viva de UX da V10. Mantido porque
  `src/styles/proto.css` e `Q3_DIVERGENCIAS_PROTOTIPO.md` referenciam este arquivo.

DOCX/PDF antigos que duplicavam análises, plano e setup foram removidos. Eles
registravam o diagnóstico de 12–13/07/2026 e contradiziam o produto atual.
