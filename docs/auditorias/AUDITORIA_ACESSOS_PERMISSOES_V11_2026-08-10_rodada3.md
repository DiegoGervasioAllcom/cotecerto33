# Auditoria de "Acessos e permissões" V11 — 10/08/2026 (rodada 3)

Continuação de [`AUDITORIA_ACESSOS_PERMISSOES_V11_2026-08-10.md`](AUDITORIA_ACESSOS_PERMISSOES_V11_2026-08-10.md) e [`AUDITORIA_ACESSOS_PERMISSOES_V11_2026-08-10_rodada2.md`](AUDITORIA_ACESSOS_PERMISSOES_V11_2026-08-10_rodada2.md) — desta vez testando **cada funcionalidade** de cada persona de ponta a ponta (não só a navegação/estrutura visual), com dados reais de pendência criados localmente (`convites` + `empresas` pendentes, no mesmo padrão de `tests/db/filas-aprovacao-v11.test.ts`).

## Escopo e ambiente

- Checkout: `main` em `cde9ba1` (PR #143 já mergeado).
- Personas testadas: Matriz, Master, Supervisor de Vendas, Franquia Full, Franquia Individual, Vendedor.
- Método: para cada persona, exercitar todos os botões da tela (Convidar, Cadastro manual/direto, Analisar → Liberar/Recusar, Ver, Configurar, Excluir/Solicitar desligamento, Personalização geral, Performance), não só abrir a tela.

## Resultado executivo

| Persona/fluxo | Achado | Status |
| --- | --- | --- |
| Matriz — Convidar, Cadastro manual, Analisar | Todos abrem e funcionam. | OK |
| Master — Ver, Solicitar desligamento, Convidar | Todos funcionam. | OK |
| Master — "Cadastros enviados, aguardando a Matriz" | Confirmado com dado real após o fix de RLS da rodada 2 (a seção não era mais dead code). | OK |
| Supervisor — Ver, escopo por hierarquia | Confirmado com vendedor vinculado e não vinculado. | OK |
| Franquia Full — Ver, Configurar, Cadastro direto | Todos funcionam. | OK |
| Franquia Full — Analisar → Liberar acesso (vendedor) | **Bug crítico**: o vendedor aprovado nunca podia ser desligado depois. | Corrigido |
| Franquia Full — Analisar → Liberar acesso | **Bug**: `enfileirar_boas_vindas` deixava de achar o perfil aprovado depois do fix acima, e tinha um erro de cast de enum. | Corrigido |
| Matriz — visibilidade de pendente de Full | **Regressão introduzida por mim mesma na rodada 2**: a nova policy de leitura deixava a Matriz ver pendente de vendedor de Full (furava a regra do F2). | Corrigido |
| Franquia Full — Meu time depois de aprovar | "Meu time" não atualizava sem recarregar a página manualmente. | Corrigido |
| Franquia Individual / Vendedor | Sem acesso a nenhuma tela de Acessos, nem por menu nem por URL direta (confirmado outra vez). | OK |

## Achados e correções

### 1. Vendedor de Franquia Full aprovado nunca podia ser desligado

Ao completar o ciclo real "Analisar → Liberar acesso" na tela da Full e depois clicar "Excluir", a RPC `fn_desligar_vendedor_full` sempre falhava com "Vendedor não pertence à sua Franquia Full". Causa raiz: `aprovar_acesso` (usada pelo Convite Supper) nunca atualizava `profiles.empresa_id` do vendedor — só `superior_id`. O vendedor ficava para sempre com a empresa "pendente" criada no próprio cadastro (signup), nunca com a empresa compartilhada da Full, que é exatamente o que `fn_full_dona_vendedor` exige (`v.empresa_id = f.empresa_id`). O "Cadastro direto" (`fn_cadastrar_vendedor_full`) já fazia essa atribuição certo — só o caminho por convite estava com a lacuna.

**Correção:** `supabase/migrations/20260810140000_aprovar_acesso_empresa_vendedor_full.sql` — `aprovar_acesso` agora reatribui `empresa_id` para a empresa do superior quando `p_perfil='vendedor'` e o superior é uma Franquia Full.

### 2. `enfileirar_boas_vindas` parou de achar o perfil aprovado

Depois do fix #1, `enfileirar_boas_vindas` (chamada por `aprovar_acesso_com_boas_vindas`, a RPC do botão "Liberar acesso") passou a falhar com "empresa e usuário precisam estar aprovados antes das boas-vindas" — ela procurava o perfil por `profiles.empresa_id = empresas.id`, que deixou de bater porque o empresa_id do vendedor agora aponta para a empresa da Full.

**Correção:** `supabase/migrations/20260810150000_enfileirar_boas_vindas_vendedor_full.sql` — adiciona um fallback que acha o perfil pelo `convites.usado_por` quando a busca normal não encontra ninguém.

Nessa mesma correção, um erro de digitação (`coalesce(status_enum, '')`) causava `invalid input value for enum empresa_status: ""` — `profiles.status` é do tipo `empresa_status` (compartilhado com `empresas.status`), e comparar com uma string vazia força um cast inválido. Corrigido para `is distinct from 'aprovada'::empresa_status`.

### 3. Regressão: Matriz voltou a ver o pendente de vendedor de Full

Ao testar a correção #1/#2, a suíte `tests/db` (`bun run test:db`) pegou uma regressão que eu mesma introduzi na rodada 2: a policy `empresas_visualizacao_convite_proprio` (pensada para o Master acompanhar o próprio convite) é uma policy PERMISSIVA adicional — e no Postgres, políticas permissivas se combinam com OR. Como o fixture de teste do F2 (`filas-aprovacao-v11.test.ts`) usa `criadoPor: matrizId` em qualquer cenário de pendente, a condição `criado_por = auth.uid()` também batia para a Matriz, reabrindo a visibilidade que a regra do F2 proíbe deliberadamente (Matriz nunca administra o pendente do vendedor de uma Full).

**Correção:** a policy agora exclui explicitamente `matriz`/`coordenador` — eles já têm acesso total via a policy `empresas_select` e não precisam (nem devem) herdar visibilidade por esse caminho.

### 4. "Meu time" da Full não atualizava após aprovar um pendente

Depois de "Liberar acesso", a aba "Meu time" continuava mostrando a contagem antiga até recarregar a página manualmente — `fila.liberar` não disparava o `reloadEquipe` que alimenta `useTeamData`.

**Correção:** `xacessos.tsx` — o `onLiberar` do modal agora incrementa `reloadEquipe` depois de `fila.liberar` resolver.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 348/348.
- `bun run test:db` (suíte completa, não só o arquivo isolado): 65/65 arquivos, 579/579 testes — incluindo a suíte `filas-aprovacao-v11.test.ts` que pegou a regressão do item 3.
- `playwright test tests/e2e/personas.spec.ts`: 7/7.
- Verificação manual no browser e via RPC direta (bypassando a UI para isolar cada causa) para os achados 1–4, com o ciclo completo Analisar → Liberar → Excluir confirmado funcionando de ponta a ponta.

## Arquivos alterados

- `supabase/migrations/20260810140000_aprovar_acesso_empresa_vendedor_full.sql` — novo.
- `supabase/migrations/20260810150000_enfileirar_boas_vindas_vendedor_full.sql` — novo.
- `supabase/migrations/20260810130000_visualizacao_convite_proprio.sql` — corrigido (exclui matriz/coordenador).
- `src/routes/_authenticated/operacao/xacessos.tsx` — `onLiberar` recarrega "Meu time".
