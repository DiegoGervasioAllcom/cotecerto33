# Documentação do CoteCerto

**Atualizado em:** 28/07/2026

Esta pasta contém fontes vivas e insumos ainda relevantes. O estado do produto
deve ser confirmado pelo código, migrations e testes da `main`.

## V11 — frente atual (pacote fechado para o TI em 28/07/2026)

| Documento                          | Finalidade                                                |
| ---------------------------------- | --------------------------------------------------------- |
| `ANALISE_LACUNAS_V11.md`           | o que muda da V10 para a V11 e o tamanho de cada lacuna   |
| `PLANO_TASKS_V11.md`               | tasks da V11 por frente, com dependências e bloqueios     |
| `v11/FLUXOS_OPERACIONAIS.html`     | **fonte da verdade das regras** — 5 fluxos navegáveis     |
| `v11/RELATORIO_DEPARA_V10_V11.html`| o que mudou etapa por etapa e onde ver no protótipo       |
| `v11/HANDOFF_PRODUCAO_V11.html`    | 11 itens que o protótipo simula e precisam virar código   |
| `v11/MODELOS_EMAIL_ACESSO.html`    | corpo dos e-mails de acesso                               |
| `../cotecerto_prototipo_v11.html`  | protótipo build 28/07 · r40 — referência de UX da V11     |

## Fontes canônicas da V10 (referência histórica)

A V10 está fechada para go-live. Estes documentos continuam válidos como registro do
que foi entregue e como base de comparação da V11.

| Documento                      | Finalidade                                 |
| ------------------------------ | ------------------------------------------ |
| `ANALISE_LACUNAS_V10.md`       | estado atual, entregas e pendências        |
| `DOC_TECNICA_V10.md`           | arquitetura implementada e regras técnicas |
| `MAPA_PROTOTIPO_PERFIS.md`     | comportamento esperado por perfil          |
| `PLANO_TASKS_V10.md`           | execução das 78 tasks e próximos gates     |
| `clickup_tasks_v10.csv`        | catálogo original das tasks                |
| `Q3_DIVERGENCIAS_PROTOTIPO.md` | divergências visuais ainda abertas         |
| `Q4_ROTEIRO_QA_MANUAL.md`      | aceite manual antes do go-live             |
| `SETUP_DEV.md`                 | preparação do ambiente local               |
| `RUNBOOK_DEPLOY.md`            | operação da produção self-hosted           |

## Outra fonte

- `../cotecerto_prototipo_v10.html`: especificação viva de UX da V10. Mantido porque
  `src/styles/proto.css` e `Q3_DIVERGENCIAS_PROTOTIPO.md` referenciam este arquivo.

DOCX/PDF antigos que duplicavam análises, plano e setup foram removidos. Eles
registravam o diagnóstico de 12–13/07/2026 e contradiziam o produto atual.
