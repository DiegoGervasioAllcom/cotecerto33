# Plano — Hierarquia V11 (primeira etapa)

**Aberto em:** 28/07/2026 · **Status:** H1–H10 implementados e testados em 28/07/2026
(migrations `20260729014448`–`20260729014452`, `tests/db/rls-hierarquia-v11-areas.test.ts`)

**Escopo:** as tasks de hierarquia da Frente 0 (V11.0.2, V11.0.3, V11.0.8) e a Frente 8
inteira do `PLANO_TASKS_V11.md`. Não inclui canais, diretor, histórico, convite nem e-mail.

**Fontes:** `docs/v11/FLUXOS_OPERACIONAIS.html` (fluxo "Hierarquia" e `const MENUS`) ·
`docs/v11/RELATORIO_DEPARA_V10_V11.html` (Etapa 1, 7 cargos) · `cotecerto_prototipo_v11.html`

## A decisão que trava tudo: enum ou cargo?

Recomendação: **híbrido**. `coordenador` entra no enum; Supervisor de Vendas × Operacional
× Backoffice são **cargo**, não perfil.

### Por que `coordenador` no enum

É nível estrutural da cadeia, não recorte de escopo. Ele aparece no caminho de
escalonamento (Master → Coordenador → Matriz, conforme o fluxo de desconto) e precisa de
linha própria de alçada. Somar um valor ao enum é barato e o projeto já tem o padrão
idempotente pronto, usado duas vezes (`20240101000035_user_admin.sql` para `franqueado`,
`20260716201626_g1_1_*` para `supervisor`).

### Por que os supervisores NÃO no enum

Três razões concretas, todas verificadas no código:

1. **A V11 exige áreas ajustáveis por pessoa.** O modal de aprovação dá "cargo (preset) +
   **áreas ajustáveis**", e os Fluxos dizem que cada cargo "recebe o menu recortado pelas
   áreas marcadas no seu cargo". Um enum não expressa recorte por pessoa — e a tela
   Configurações › Cargos existe justamente para isso mudar sem migration.
2. **A alçada já é um eixo separado do perfil.** `desconto_politicas.modelo` é `text` com
   check `('franquia_individual','franquia_full','master','supervisor')` — não é o enum
   `perfil`. Quem faz a ponte é `fn_modelo_alcada_desconto(profile_id)`, que hoje deriva de
   `has_role()`. Para distinguir Vendas de Operacional basta essa função passar a ler
   **cargo**. Nenhum valor de enum é necessário para isso.
3. **Valor de enum não se remove no Postgres.** Os 7 cargos são explicitamente
   configuráveis; vão mudar. Cargo em tabela muda com `update`.

### O que ganhamos de graça

`fn_desconto_pode_aprovar` resolve a cadeia com um `with recursive` sobre
`profiles.superior_id` — **é agnóstico de rótulo**. Como o Supervisor Operacional é *irmão*
do Supervisor de Vendas (ambos sob o Coordenador) e não ancestral de vendedor nenhum, ele
já fica fora das aprovações de desconto **pela topologia**, sem nenhuma regra nova. A
cadeia faz o trabalho.

Por simetria, vale trocar o valor `'supervisor'` de `desconto_politicas.modelo` por
`'supervisor_vendas'` e somar `'coordenador'`: assim a ausência de alçada do Operacional é
**estrutural**, não acidental. Isso é seguro porque o sistema não está em uso em produção
(`AGENTS.md`, decisões de 13/07 — modo agressivo permitido).

## As 17 áreas

Extraídas de `const MENUS` nos Fluxos. Achado que reduz o trabalho: **as 17 áreas da
Matriz batem uma a uma com as rotas que já existem** em `src/routes/_authenticated/`.
Só `Canais` (do menu da Full) é nova, e ela é da Frente 5, não desta etapa.

| Perfil / cargo         | Nº | Áreas                                                                         |
| ---------------------- | -- | ----------------------------------------------------------------------------- |
| Matriz                 | 17 | todas                                                                         |
| Coordenador Comercial  | 17 | as mesmas 17 — a diferença é não ser diretor, não é o menu                     |
| Supervisor de Vendas   | 11 | Visão geral, Aprovações, Vendedores, Supervisão, Pipeline geral, Vendas, Comissões, Premiações, Estornos, Renovações, Relatórios |
| Supervisor Operacional | 4  | Visão geral, Leads, Distribuição, Acessos e permissões                        |
| Cargo por escopo       | n  | recorte livre (ex.: Marketing = Visão geral, Leads, Distribuição, Relatórios, área "Marketing" ainda sem tela) |
| Master                 | 12 | menu de comando do grupo, sem Configurações                                    |
| Franquia Full          | 16 | quase o da Matriz, sem Franquias e sem Configurações globais (+ Canais)        |
| Vendedor / Individual  | 9  | menu de venda                                                                  |

> **Atualização pós-Frente 5 (04/08/2026):** a linha da Franquia Full acima é a
> projeção original desta etapa (H8, 28/07) — a implementação real (V11.5.2a/2b)
> abriu com 15 áreas e depois **fechou em 14**: além de Franquias e Configurações
> globais, "Mensagens prontas" (`mmsgs`) também saiu do menu da Full por decisão de
> V11.5.2b. `Canais` nunca existiu como área própria no catálogo `areas` — a
> "Central da Franquia" (leads/SLA/canais próprios da Full) é um comportamento das
> áreas Leads/Distribuição existentes, não uma área nova. Fonte da verdade hoje:
> `AREAS_FORA_DA_FULL` em `src/lib/nav-experience.ts`. O exemplo do cargo Marketing
> também mudou: o preset real (`cargo_areas`) dá a ele Visão geral/Leads/Distribuição/
> Relatórios + a área-placeholder "Marketing" (`mkt`, sem rota ainda) — não
> "Mensagens".

## Tasks

| Task | Tag    | Descrição                                                                                          | Depende de |
| ---- | ------ | -------------------------------------------------------------------------------------------------- | ---------- |
| H1   | banco  | `public.perfil += 'coordenador'`, no padrão idempotente da g1_1                                      | —          |
| H2   | banco  | Catálogo `areas` (17 chaves estáveis, seed) com RLS e leitura para `authenticated`                   | —          |
| H3   | banco  | `cargos` (7 presets + Vendedor Matriz fora dos presets) + `cargo_areas`; `profiles.cargo_id`         | H2         |
| H4   | banco  | `profile_areas` (override por pessoa) + `fn_areas_do_usuario(uid)`: override se existir, senão o preset do cargo; e `fn_tem_area(uid, chave)` para policy e menu | H3 |
| H5   | banco  | Cadeia: Master passa a responder ao **Coordenador**; revisar `empresas_visiveis()` e backfill dos masters existentes | H1 |
| H6   | banco  | `fn_modelo_alcada_desconto` deriva de **cargo**; `desconto_politicas.modelo` ganha `'coordenador'` e troca `'supervisor'` por `'supervisor_vendas'` | H3, H5 |
| H7   | front  | `app-shell.tsx`: `canSee` passa a consultar áreas em vez de `role` cru; selo por cargo               | H4         |
| H8   | front  | Menus dos perfis novos: Coordenador (17), Supervisor de Vendas (11), Supervisor Operacional (4), cargo por escopo | H7 |
| H9   | testes | RLS por perfil (skill `teste-rls`): Operacional **não** aprova desconto, Coordenador aprova na alçada dele, escalonamento Master → Coordenador → Matriz | H6 |
| H10  | testes | `fn_areas_do_usuario`: override ganha do preset; sem override, cai no preset; cargo nulo não vaza área | H4 |

## O que muda em código existente

- **`src/components/app-shell.tsx`** — hoje o gate é `role === "vendedor"`, `venLike`,
  `grpLike`, `isMatriz` e um mapa `SELO` por perfil. Passa a depender de áreas. É a
  mudança de front mais sensível desta etapa, e o `AGENTS.md` (regra 7) já avisa: o gate
  visual **não é segurança** — a policy é. As duas coisas mudam juntas.
- **`fn_modelo_alcada_desconto`** — troca `has_role()` por leitura de cargo.
- **`desconto_politicas`** — check constraint e possíveis linhas existentes.
- **`empresas_visiveis()`** — precisa reconhecer o Coordenador como nível acima do Master.
  A correção de escopo de rede do Master (`20260721150000_s_fix_master_rls_escopo_rede.sql`)
  é a referência de como esse escopo foi resolvido antes.

## Riscos

1. **Backfill dos masters.** Hoje o Master aponta para a Matriz (ou tem `superior_id`
   nulo). Inserir o Coordenador no meio exige criar o registro dele antes e repontar os
   masters. Se o backfill errar, o Master perde visibilidade da rede — que é exatamente o
   bug que a `s_fix_master_rls_escopo_rede` corrigiu. **H5 precisa de teste de RLS antes
   de ir para produção**, não depois.
2. **`ALTER TYPE ... ADD VALUE` e transação.** O padrão idempotente do projeto funciona,
   mas o valor novo não pode ser usado na *mesma* migration em que é criado, em algumas
   versões do Postgres. Separar criação do enum (H1) do uso dele (H5/H6) já resolve — e o
   plano acima está assim por esse motivo.
3. **Regressão de menu.** Trocar `canSee` por áreas toca a navegação de **todos** os
   perfis, inclusive os que não mudaram. Vale rodar o roteiro de QA por perfil
   (`Q4_ROTEIRO_QA_MANUAL.md`) nos 6 perfis existentes depois de H7/H8, não só nos novos.
4. **"Regras Decididas" ainda ausente.** A regra 5 (escopos dos presets) está nesse
   documento, que não veio no pacote. Os escopos de H3 saem de `const MENUS` dos Fluxos,
   que é fonte da verdade — mas se as Regras Decididas contradisserem, H3 volta.

## Dívidas conscientes desta etapa

1. **`isGroupView` ainda trata supervisor como visão de grupo.** A navegação dele já é
   por área (H7/H8), mas 6 telas usam esse mesmo sinal para decidir **conteúdo** —
   `visao-geral.tsx` mostra "Visão geral do grupo" e "Equipe de … · N franquias", e
   `pipeline-geral`, `vendas`, `xacessos` e `aprovacoes` fazem o mesmo tipo de escolha.
   Verificado no navegador: o Supervisor Operacional recebe o menu certo (4 áreas) e cai
   num painel rotulado como de grupo. Separar isso exige decidir **o que o dashboard de
   cada supervisor mostra** — é task de produto, não de refactor, e ficou fora do H7/H8
   de propósito para o diff não virar mudança de 6 telas.

2. **Override de áreas pode tirar Aprovações de quem tem alçada.** `profile_areas`
   substitui o preset por completo, então dá para deixar um Supervisor de Vendas com
   alçada de desconto e sem a área `maprov` — ele mantém autoridade e perde a tela para
   exercê-la. A separação está correta em princípio (alçada é regra de dinheiro atada ao
   cargo, conforme a regra 2 do `AGENTS.md`; menu é apresentação), mas a tela de
   aprovação deveria avisar. Coberto por teste, não tratado na UI.

3. **`/inicio` desvia os perfis internos, não os de grupo.** Matriz, Coordenador e
   supervisores passam a cair em `/comando/visao-geral` (antes só a Matriz), porque
   `/inicio` é a home de venda e não está no menu deles. Master e Franquia Full seguem
   em `/inicio` como na V10 — mudar isso é decisão de produto.

## Fora de escopo desta etapa

Diretor e histórico (V11.0.5, V11.0.6), canais (V11.0.4), convite (Frente 1), filas
(Frente 2), régua (Frente 4), Full como matrizinha (Frente 5) e toda a frente de e-mail.
