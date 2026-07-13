# Plano de Tasks — CoteCerto V10 (ClickUp)

**Arquivo de importação:** `clickup_tasks_v10.csv` (78 tasks) · Importar em ClickUp: Settings → Import/Export → CSV, mapeando as colunas Task Name, Description, List, Priority, Time Estimate e Tags.

## Estrutura de listas (fases)

| Lista | Tasks | Esforço | Depende de |
|---|---:|---:|---|
| 0 · Pré-obra | 14 | ~13 d | — |
| S · Segurança | 6 | ~6 d | — (paralelo à pré-obra) |
| D · Integridade | 5 | ~7,5 d | C3/C4 (drift e limpeza de dados) |
| 1 · Hierarquia | 7 | ~11 d | Pré-obra (staging, migrations CLI) |
| 2 · Franquia Ind/Full | 5 | ~7 d | Lista 1 |
| 3 · Desconto multinível | 8 | ~14 d | Listas 1–2 |
| 4 · Comissão | 6 | ~10 d | Lista 1 |
| 5 · Telas pendentes | 4 | ~7 d | — (paralelo às listas 3–4) |
| 6 · Renovações e tutoriais | 4 | ~6,5 d | G6.2 depende de G4.2 |
| 7 · Qualidade final | 4 | ~9 d | Todas |
| T · Testes (todos os tipos) | 9 | ~11,5 d | T1/T4 cedo; T2–T3 após listas 1–3; T8 após S5 |
| K · Docker e deploy | 6 | ~5,5 d | junto com a pré-obra (staging já nasce em Docker); K3 integra com S5 |

Total ≈ **108 dias-tarefa** (com paralelismo real: 87–129 dias úteis p/ 1 dev · 9,5–14 semanas p/ 2 devs).

## Containerização (lista K)

O deploy atual é desconhecido (task C5 da pré-obra o documenta) e o front não é containerizado. A lista K entrega: Dockerfile do front (K1), ambiente de dev com um comando (K2), stack de produção com proxy/TLS/rate-limit (K3), o compose do Supabase self-hosted versionado no repositório (K4), build de imagem no CI (K5) e a migração do deploy — staging primeiro — com runbook de rollback (K6). Recomendação: executar K1–K2 já na pré-obra, para que o staging da task "Criar ambiente de staging" já nasça em Docker.

## Estratégia de testes (lista T — pirâmide completa)

| Tipo | Task | Quando |
|---|---|---|
| Unitário (regras de negócio) | Setup Vitest (pré-obra) + G4.6 golden tests de comissão | desde a pré-obra |
| Unitário (front) | T6 — máscaras, zod, canSee, KPIs | paralelo às listas 1–4 |
| Integração (RPCs × banco) | T7 + G3.8 (alçada/escalonamento) | junto com listas 3–4 |
| Segurança (RLS) | T4 + G1.7 (visibilidade por perfil) — **rodar a cada migration** | começa na lista S |
| Integridade (constraints) | T5 — banco rejeita dado inválido | junto com lista D |
| E2E (Playwright) | T1 setup → T2 fluxo de venda → T3 navegação das 6 personas | após lista 1 |
| Carga | T8 — endpoints críticos + valida rate limiting | após S5 |
| Processo | T9 — gate de cobertura no CI + Q4 QA manual final | T9 cedo; Q4 no fim |

## Regras de dependência (ordem de execução)

1. **C1, C2 (revogar acessos/credenciais) → imediato, antes de tudo.**
2. Pré-obra e Segurança rodam em paralelo na(s) primeira(s) semana(s).
3. Integridade (D1–D4) exige o levantamento de dados (C4/C5) — constraints só entram após limpeza.
4. Lista 1 (Hierarquia) é pré-requisito estrutural das listas 2, 3 e 4.
5. Lista 3 usa as telas refatoradas em Q1/Q2 — se houver 2 devs, antecipar Q1/Q2.
6. Toda migration nova: staging primeiro, com teste de RLS correspondente.

## Convenções sugeridas no ClickUp

- **Tags:** `banco`, `front`, `seguranca`, `infra`, `testes`, `processo` — permitem filtrar por especialidade.
- **Estimativas:** em horas (1 d = 8 h). Somas por lista acima.
- **Prioridades:** Urgent = fazer antes de qualquer dev; High = caminho crítico V10; Normal/Low = paralelizável.
- **Definition of Done por task de banco:** migration versionada + policy RLS + teste + aplicada em staging.
- **Definition of Done por task de front:** tela conforme protótipo V10 + validação zod + sem `any` novos.

O detalhe funcional de cada task está na **Análise de Lacunas** (`ANALISE_LACUNAS_V10.md`, seções 2, 3 — status por perfil —, 6, 9 e 10), o desenho técnico em `DOC_TECNICA_V10.md` e o comportamento exato por perfil (telas iniciais, escopo de dados, campos condicionais do modal de classificação, política de alçada e tutoriais) em `MAPA_PROTOTIPO_PERFIS.md` — leitura obrigatória antes das tasks G1.4–G1.6, G2.2, G3.4–G3.5 e G6.3–G6.4.
