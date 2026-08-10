# Auditoria de Hierarquia V11 — 10/08/2026

Comparação da hierarquia implementada com o documento **"Fluxos Operacionais - Supper Certo · Plataforma Cote Certo"** enviado pela Lis (aba "Hierarquia").

## O que o documento define

```
MATRIZ
├─ Áreas de apoio (direto na Matriz): Assistente Comercial, Marketing,
│  Financeiro/Compras/Facilities (em breve)
└─ Rede comercial:
   └─ Coordenador Comercial (responde à Matriz; vê as 17 áreas do sistema)
      ├─ Supervisor de Vendas (alçada de desconto)
      │  ├─ Vendedor Matriz (interno, CLT)
      │  └─ Franquia Individual (opera como vendedor)
      ├─ Supervisor Operacional (leads, distribuição, liberação de cadastro)
      └─ MASTER (franqueado) — mesmo nível dos 2 Supervisores
         ├─ Vendedor · Master
         ├─ Franquia Individual (do Master)
         └─ Franquia Full → Vendedor · Full
```

Trecho literal: *"cada Master responde ao Coordenador Comercial, ficando no mesmo nível dos dois supervisores. Quem faz essa associação é a Matriz, no momento da aprovação do cadastro."*

## Achado

No modal "Classificar acesso" (`src/components/acessos/classificar-acesso-modal.tsx`), ao aprovar um Master, a Matriz escolhia um **"Supervisor de Vendas responsável"** (busca por `cargo_id` em `sup_vendas`/`sup_operacional`/`sup_backoffice`) — sem nenhuma referência a Coordenador.

Isso não era um esquecimento novo: a migration [`20260729014450_h5_cadeia_master_coordenador.sql`](../../supabase/migrations/20260729014450_h5_cadeia_master_coordenador.sql) já tinha implementado a parte de banco (RLS: Coordenador vê a rede toda, como a Matriz) citando **exatamente** este trecho do documento, e comentava explicitamente: *"a associação é feita na tela de Acessos (V11.2.7, seletor de supervisão)"*. O seletor existia, mas apontava para Supervisor de Vendas em vez de Coordenador Comercial — o backfill único que a migration fez (só quando havia exatamente 1 Coordenador cadastrado) nunca foi reforçado pela UI para Masters aprovados depois.

## Correção

`src/components/acessos/classificar-acesso-modal.tsx`:
- `buscarSupervisoresDeVendas()` → `buscarCoordenadores()`, buscando `cargo_id = 'coord_com'` em vez de `CARGOS_SUPERVISAO`.
- Estado `clMasterSupervisor` → `clMasterCoordenador`.
- Label do seletor: "Supervisor de Vendas responsável" → "Coordenador Comercial responsável".
- Nota de apoio: agora explica que o Master fica no mesmo nível dos dois supervisores e se reporta ao Coordenador Comercial.

Resto da hierarquia (Franquia Individual podendo reportar a Matriz/Supervisor/Master, Franquia Full exigindo Master ativo, Vendedor de franquia vinculado ao dono) já batia com o documento — sem mudanças.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 348/348.
- `bun run test:db`: 65/65 arquivos, 579/579 testes.
- `playwright test tests/e2e/personas.spec.ts`: 7/7.
- Verificação direta via RPC (`aprovar_acesso` com `p_perfil='master'` e `p_superior_id` de um Coordenador real): `superior_id` do Master ficou corretamente apontando para o Coordenador.
- Verificação visual no browser: o seletor mostra "Coordenador Comercial responsável", lista perfis reais com `cargo_id='coord_com'`, e a nota de apoio bate com o texto do documento.
