# Auditoria de nomenclatura V11 — 10/08/2026

Comparação da nomenclatura de cargos e perfis com o documento de Fluxos Operacionais enviado pela Lis.

## Cargos internos (perfil Matriz)

Comparei os 7 cargos preset (`cargos.nome`) com a lista "CARGO PRETENDIDO" do autocadastro (`FLOWS.autocadastro`):

| ID | Nome no app | Nome no documento | Bate? |
| --- | --- | --- | --- |
| `matriz_total` | Direção | Matriz (total) | Pendente de decisão |
| `coord_com` | Coordenador Comercial | Coordenador Comercial | ✅ |
| `sup_vendas` | Supervisor de Vendas | Supervisor de Vendas | ✅ |
| `sup_operacional` | Supervisor Operacional | Supervisor Operacional | ✅ |
| `sup_backoffice` | Supervisor Backoffice | Supervisor Backoffice | ✅ |
| `assist_com` | Assistente Comercial | Assistente Comercial | ✅ |
| `marketing` | Marketing | Marketing | ✅ |

6 de 7 batem exatamente. `matriz_total` diverge ("Direção" vs. "Matriz (total)") — usuário optou por não alterar por ora.

## Perfis da rede externa

Comparei com a lista "TIPO DE PERFIL" (`FLOWS.autocadastro`) e os nomes de `modelos_franquia`:

- **TIPO DE PERFIL** (Master, Franquia Full, Franquia Individual, Vendedor): batem literalmente nos seletores de convite/classificação (`convidar-modal.tsx`, `desconto-politica-panel.tsx`).
- **Modelos de franquia** (Smart, Conecta, Light, Link, Flex, Full): batem letra por letra em `modelos_franquia`.
- **A quem se reporta** (Master→Coordenador, Franquia→Master, Vendedor→Master ou Franquia Full): estrutura já compatível (Master→Coordenador corrigido em PR anterior).

Nenhuma divergência de nomenclatura na rede externa.

## Achado e correção: selo "CORRETOR" → "VENDEDOR"

O selo de marca (`SUPPER · <selo>`) do perfil Vendedor mostrava **"CORRETOR"** — nome de uma versão anterior do produto/prototipo (`docs/MAPA_PROTOTIPO_PERFIS.md`). O documento de Fluxos usa **"VENDEDOR"** consistentemente para esse perfil (nos nós do diagrama de hierarquia e no tipo de perfil do autocadastro).

**Correção:** `src/components/app-shell.tsx` — `BRAND_LABEL.vendedor` de `"CORRETOR"` para `"VENDEDOR"`.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 353/353.
- `playwright test tests/e2e/personas.spec.ts`: 7/7.
- Verificação visual: persona Vendedor mostra "SUPPER · VENDEDOR" no selo e no card de conta.
