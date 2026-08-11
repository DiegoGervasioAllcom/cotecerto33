# Auditoria — "Classificar acesso" / "Reclassificar" · 10/08/2026

Verificação da tela **Classificar acesso** (e o botão **Reclassificar**) em todas as personas
que a usam, comparando com o protótipo (`cotecerto_prototipo_v11.html`, `buildClassifyModal`).

## Onde a tela aparece

`ClassificarAcessoModal` (`src/components/acessos/classificar-acesso-modal.tsx`) é reaproveitado
em dois lugares:

- `src/routes/_authenticated/operacao/acessos.tsx` — **Matriz** (e Supervisor Operacional, que
  administra Acessos igual à Matriz) classificam pendentes dos dois blocos: **Interno** (time da
  Matriz) e **Externo** (rede — Master, Franquia, Vendedor).
- `src/routes/_authenticated/operacao/xacessos.tsx` — **Franquia Full** classifica (aprova) o
  próprio vendedor, que sempre chega pelo bloco Externo.

## Achado: pills de "Reclassificar" não filtravam por bloco

O protótipo filtra as opções de tipo por `p.escopo` (linha 7755-7756 de
`cotecerto_prototipo_v11.html`):

```js
if(p.escopo==='interno') tipoOpts = filter to vendedor_clt|interno;
if(p.escopo==='externo' && !isPJ) tipoOpts = filter to vendedor_franquia;
```

O app **não fazia esse filtro**: ao clicar em "Reclassificar" em um pendente PF, os três pills
apareciam sempre juntos — **Vendedor Matriz**, **Vendedor de franquia** e **Time interno | cargo**
— independente do pendente ser do bloco Interno ou Externo. Isso permitia, por exemplo:

- Reclassificar um vendedor da rede externa (convidado por um Master) para **Time interno |
  cargo** — dando a ele cargo e áreas do time da Matriz, o que não faz sentido para alguém que
  entrou pela rede externa.
- Reclassificar um pendente do time interno da Matriz para **Vendedor de franquia** — pedindo um
  vínculo de franquia que não existe nesse fluxo.
- Na tela da **Franquia Full** (`xacessos.tsx`), que só deveria aprovar o próprio vendedor,
  "Reclassificar" abria também **Vendedor Matriz** e **Time interno | cargo** — dois tipos que
  não fazem parte do escopo da Full.

Isso divergia do protótipo e não tinha proteção correspondente no servidor além do que
`aprovar_acesso` já valida por perfil — ou seja, a tela deixava escolher um caminho que não devia
nem aparecer.

## Correção

`src/components/acessos/classificar-acesso-modal.tsx` — os pills de tipo (PF) agora usam
`pendente.bloco` (já existia no tipo `Pendente`, só não era consultado aqui) para decidir quais
opções mostrar, igual ao protótipo:

- `bloco === "interno"` → **Vendedor Matriz** e **Time interno | cargo**.
- `bloco === "externo"` (default sem convite) → só **Vendedor de franquia**.

PJ (Franquia / Master franqueado) não precisou de filtro — pendente PJ é sempre do bloco Externo.

## Verificação por persona

- **Matriz**, pendente do bloco **Interno** (convite `Matriz | Marketing`): Reclassificar mostra
  só "Vendedor Matriz" e "Time interno | cargo" — confirmado visualmente.
- **Matriz**, pendente do bloco **Externo** (convite `Vendedor | Master`, vínculo com uma
  Franquia Full): Reclassificar mostra só "Vendedor de franquia" — confirmado visualmente.
- **Franquia Full** (`xacessos.tsx`): usa o mesmo componente; pendente do próprio vendedor é
  sempre bloco Externo, então o mesmo filtro se aplica — só "Vendedor de franquia" aparece.
- **Supervisor Operacional**: mesma tela da Matriz (`acessos.tsx`), mesmo comportamento.

## Verificação automatizada

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros (warnings preexistentes, não relacionados).
- `vitest run tests/unit`: 353/353.
- `playwright test tests/e2e/personas.spec.ts`: 7/7.
- Sem teste automatizado prévio cobrindo os pills de "Reclassificar" (só há testes de RLS/RPC em
  `tests/db/classificar-acesso-role.test.ts`) — a verificação desta rodada foi manual, criando
  pendentes reais nos dois blocos via Convite Supper e abrindo "Reclassificar" em cada um.
