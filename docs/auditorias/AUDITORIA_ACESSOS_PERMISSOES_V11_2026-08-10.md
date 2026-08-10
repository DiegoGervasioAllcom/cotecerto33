# Auditoria de "Acessos e permissões" V11 — 10/08/2026

## Escopo e ambiente

- Checkout: `main` em `074b432` (após fast-forward de 28 commits do trabalho feito com o Codex).
- Ambiente: front e Supabase locais.
- Fonte: `cotecerto_prototipo_v11.html` (funções `render_macessos`/`render_xacessos`), `docs/MAPA_PROTOTIPO_PERFIS.md`.
- Personas testadas: Matriz, Master, Supervisor de Vendas (`sup_vendas`) e Franquia Full — criadas via `tests/e2e/provision.ts` (`criarPersona`).
- Método: login real por persona, comparação visual e de comportamento contra o protótipo, tela "Acessos e permissões" (`/operacao/acessos` para Matriz/Supervisor, `/operacao/xacessos` para Master/Franquia Full).

## Resultado executivo

| Persona                | Achado                                                                                                                                                             | Status    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Matriz                  | Bate com o protótipo — dois blocos (MATRIZ·TIME INTERNO / EXTERNOS·REDE), mesmas 4 abas cada.                                                                     | OK        |
| Franquia Full           | Bate com o protótipo — bloco "MINHA FRANQUIA" com Meu time/Pendentes/Desligamentos/Personalização/Performance.                                                     | OK        |
| Master                  | `/operacao/xacessos` mostrava só uma tabela única "Equipe", sem separar pendentes de ativos e sem ação "Ver".                                                       | Corrigido |
| Supervisor de Vendas    | Cargo `sup_vendas` não tinha a área `macessos` liberada → redirecionado para Visão geral ao tentar abrir a tela.                                                     | Corrigido |
| Supervisor de Vendas    | Depois de liberar a área, passou a ver a tela **completa de admin da Matriz** (Convidar, Cadastro manual, Analisar) — muito além do que o protótipo previa para ele. | Corrigido |

## Achados e correções

### 1. Master em `xacessos.tsx` sem separação pendentes/ativos

No protótipo (`render_xacessos` → `masterAcompCard()`), o Master vê duas tabelas: cadastros que ele convidou e que aguardam a Matriz classificar, e os vendedores já ativos — com ação "Ver" por linha. A implementação tinha só a tabela de ativos.

**Correção:**
- Passou a habilitar `useFilaFranquiaData` também para `role === "master"` (antes só para Franquia Full).
- Nova seção "Cadastros enviados, aguardando a Matriz" reaproveitando `PendentesTab`, sem a ação "Analisar" (o Master não classifica — só acompanha).
- `PendentesTab` ganhou `onAnalisar` opcional: quando ausente, a última coluna mostra um chip "Aguardando matriz" em vez do botão.
- `GenericTeamTable` ganhou `onVer` opcional, abrindo um modal novo e dedicado (`MasterMemberModal`), só-leitura — não reaproveita o `FullMemberModal` da Franquia Full (que tem modos de edição/exclusão sem sentido para o Master).

### 2. Supervisor de Vendas sem acesso à tela

O cargo `sup_vendas` não tinha a área `macessos` no preset (`cargo_areas`), então `/operacao/acessos` redirecionava para "Visão geral" sem mostrar nada.

**Correção:** migration `20260810120000_sup_vendas_macessos.sql` adicionando `('sup_vendas', 'macessos')` a `cargo_areas`, seguindo o padrão da migration H8 (`20260803130000_v11_h8_sup_vendas_estornos.sql`).

### 3. Supervisor com admin completo em vez de visão de acompanhamento

Como `podeAdministrarAcessos` já incluía `role === "supervisor"`, liberar a área deu a ele o mesmo nível de admin da Matriz (Convidar, Cadastro manual, Analisar, Desligar) sobre a rede inteira — muito diferente do protótipo, onde o Supervisor só acompanha ("você não cadastra nem desliga — acompanha o desempenho e aciona a Matriz").

**Correção:**
- `podeAdministrarAcessos` não inclui mais `supervisor` (só `matriz`/`coordenador`).
- Nova view dedicada e somente-leitura, `SupervisorAcessosView`: nota de "Papel de supervisão" + tabela única "Vendedores" com botão "Ver" (reaproveita `MasterMemberModal`), sem tabs, sem os blocos Interno/Externo, sem qualquer ação de escrita.
- O escopo da tabela não precisou de filtro manual: a RLS de `empresas_visiveis`/`profiles` (subárvore por `superior_id`) já limita o resultado aos vendedores que reportam a esse Supervisor — confirmado testando com um vendedor vinculado (`superior_id` = supervisor) e outro sem vínculo (não aparece).

### 4. Bug pré-existente encontrado de passagem: classe CSS `.modal-overlay` inexistente

Ao construir o `MasterMemberModal`, copiei o padrão do `FullMemberModal` e reproduzi um bug: a classe `modal-overlay` não existe em `proto.css` (a classe real do overlay fixo é `.modal-host`, confirmada em `SolicitarDesligamentoModal`, que funciona). Sem ela, o modal renderiza inline no fluxo da página em vez de como overlay centralizado.

**Correção:** troquei `modal-overlay` → `modal-host` nos 3 lugares que usavam a classe errada:
- `full-direct-modal.tsx` (Cadastro direto, Franquia Full)
- `full-member-modal.tsx` (Ver/Configurar/Excluir vendedor, Franquia Full)
- `atender.tsx` (Ver lead, tela de atendimento do vendedor)

## Verificação

- `tsc --noEmit`: limpo.
- `vitest run tests/unit`: 348/348 (32 arquivos).
- `playwright test tests/e2e/personas.spec.ts`: 6/6.
- Verificação visual manual no browser com personas reais (`criarPersona`) para cada achado: Matriz, Master (pendente + ativo + modal Ver), Supervisor (sem vínculo → lista vazia; com vínculo → aparece só o subordinado; modal Ver), Franquia Full (Ver/Configurar/Cadastro direto após o fix do `.modal-host`).

## Arquivos alterados

- `src/lib/route-access.ts` — `podeAdministrarAcessos` sem `supervisor`.
- `src/routes/_authenticated/operacao/acessos.tsx` — ramo read-only do Supervisor.
- `src/routes/_authenticated/operacao/xacessos.tsx` — pendentes + "Ver" para o Master.
- `src/components/operacao/acessos/pendentes-tab.tsx` — `onAnalisar` opcional.
- `src/components/operacao/acessos/full/team-panels.tsx` — `onVer` opcional em `GenericTeamTable`.
- `src/components/operacao/acessos/full/master-member-modal.tsx` — novo, modal só-leitura do Master.
- `src/components/operacao/acessos/supervisor-acessos-view.tsx` — novo, view read-only do Supervisor.
- `src/components/operacao/acessos/full/full-direct-modal.tsx`, `full-member-modal.tsx`, `src/routes/_authenticated/venda/atender.tsx` — fix `.modal-overlay` → `.modal-host`.
- `supabase/migrations/20260810120000_sup_vendas_macessos.sql` — nova área do cargo.
- `tests/unit/route-access.test.ts` — ajustado à nova regra de `podeAdministrarAcessos`.
