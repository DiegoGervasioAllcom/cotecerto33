# Consultas `.in()` em lotes no módulo de Acessos · 11/08/2026

Correção da tarefa flagrada em `docs/auditorias/AUDITORIA_CONTAGEM_CADASTROS_E_CONVIDAR_V11_2026-08-11.md`:
`.in("id"/"user_id", array)` com listas potencialmente grandes falhava silenciosamente numa base
com muitos usuários.

## Investigação

`supabase-js` v2 não tem paginação automática para `.in()` — todo `select()` do PostgREST sai
como `GET`, e a lista do `.in()` vai inteira na query string (`?id=in.(uuid1,uuid2,...)`). Não há
opção no cliente para forçar `POST`, nem RPC genérica de "buscar por lista de IDs" no banco. A
única forma robusta de evitar a URL crescer sem limite é cortar a lista em lotes menores no
cliente.

Nos 3 pontos citados, o código também tinha o problema descrito na tarefa: várias dessas
consultas nem checavam `error` — só liam `data ?? []`, então uma falha (URL longa, timeout,
qualquer erro de rede) virava silenciosamente "zero registros", sem nenhum aviso.

## Correção

- **`src/lib/supabase-in-batches.ts`** (novo) — `selectInBatches(valores, consultarLote)`: corta
  `valores` em lotes de 100, dispara todos em paralelo (`Promise.all`), junta os dados de todos
  os lotes e devolve o **primeiro erro** encontrado (se algum lote falhar) junto com os dados dos
  lotes que funcionaram — quem chama decide como avisar.
  - 100 por lote é conservador: cada UUID + vírgula tem ~37 bytes, então um lote inteiro fica em
    ~3.7 KB — bem abaixo de limites comuns de URL (proxies/CDNs costumam cortar em 8 KB).
- **`useAcessosData.ts`** — as 4 consultas `.in()` com listas dependentes do volume de dados
  (empresas dos desligados, roles dos desligados, superiores elegíveis — a que já tinha
  quebrado, doado por franquia) passam a usar `selectInBatches`. `classificarDeslig` ganhou um
  parâmetro `onError` para poder chamar `setErr` (antes era uma função solta, sem acesso ao
  estado do hook).
- **`cadastros-matriz-tab.tsx`** — empresas dos colaboradores, roles e overrides de área
  (`profile_areas`) passam a usar `selectInBatches`; erro de qualquer uma vira banner visível.
- **`cadastros-rede-tab.tsx`** — a consulta de `profiles` (a que motivou o achado original — a
  lista de IDs é TODA a rede externa) e a de `empresas` passam a usar `selectInBatches`.
- Consultas com listas sempre pequenas e fixas (nomes de role, `cargo_id` de um preset, status)
  não foram tocadas — não há risco de URL longa ali.

## Teste

`tests/unit/supabase-in-batches.test.ts` cobre, sem depender de fixtures reais:
- lista vazia não dispara nenhuma consulta;
- lista pequena (≤100) vira 1 lote só;
- lista grande (250) vira 3 lotes (100/100/50), resultado junta os 250 registros sem perder
  nenhum;
- os lotes disparam em paralelo (não em série) — mede quantas chamadas ficam "em voo" ao mesmo
  tempo;
- se um lote falha, o erro é propagado e os dados dos lotes que funcionaram não se perdem.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 363/363 (5 novos).
- `playwright test tests/e2e/personas.spec.ts tests/e2e/convite.spec.ts tests/e2e/filas-aprovacao.spec.ts`: 14/14.
- **Verificação com dados reais**: numa base local com centenas de usuários de teste acumulados
  (o cenário que expôs o bug originalmente), abrir "Cadastros Matriz" e "Cadastros Rede" agora
  carrega **946** e **276** cadastros corretamente, sem nenhum banner de erro — antes disso a
  mesma base fazia essas abas silenciosamente mostrarem "(0)".
