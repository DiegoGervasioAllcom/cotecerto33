<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# CoteCerto

Sistema da Supper para o ciclo completo do corretor de seguros: **lead → cotação
→ proposta → apólice → comissão**. Multi-tenant por franquia, com hierarquia de
rede (Matriz, Master, Supervisor, Franquia Individual/Full, Vendedor) e
integração real com a Quiver (cotação automática de seguro auto via robô
Playwright).

**Estado atual:** V11 implementada na `main`. O que está mergeado, validado
localmente e comprovado em produção é registrado separadamente no
[`docs/PLANO_TASKS_V11.md`](docs/PLANO_TASKS_V11.md); não use apenas o status de
um plano ou do CI como evidência de go-live.

## Stack

- **Front:** React 19, TanStack Start/Router, React Query, Tailwind v4, shadcn/ui, Zod.
- **Backend:** Supabase/Postgres self-hosted — RLS em toda tabela nova, regras
  monetárias e de alçada em RPCs `security definer`, nunca no navegador.
- **Runtime:** Bun.
- **Deploy:** imagem Docker publicada no GHCR a cada push na `main`, atrás de
  nginx + Cloudflare, integrada a um Supabase self-hosted já existente no servidor.
- **Integração externa:** Quiver (cotação de seguro auto) via robô Playwright
  (projeto separado) + webhook autenticado.

## Início rápido

```bash
cd cotecerto33

# 1. Sobe o Supabase local (Docker precisa estar rodando)
supabase start

# 2. Cria o .env com as chaves impressas pelo comando acima
cp .env.example .env
# preencher VITE_SUPABASE_URL/SELF_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# (Publishable key) e SELF_SUPABASE_SERVICE_ROLE_KEY (Secret key)

# 3. Aplica as migrations + seed num banco limpo
supabase db reset

# 4. Instala dependências e sobe o app
bun install
bun run dev
```

As contas locais de teste são criadas pelo seed. Consulte o arquivo
`supabase/seed.sql` no checkout local; não copie credenciais para documentação,
issues ou logs.

Passo a passo completo, variáveis de ambiente e troubleshooting: **[docs/SETUP_DEV.md](docs/SETUP_DEV.md)**.

## Comandos principais

| Comando                 | O que faz                                                |
| ----------------------- | -------------------------------------------------------- |
| `bun run dev`           | sobe o app em modo dev (Vite)                            |
| `bun run build`         | build de produção                                        |
| `bun run typecheck`     | checagem de tipos — deve passar antes de qualquer commit |
| `bun run lint`          | lint do repositório                                      |
| `bun run test:unit`     | testes unitários (offline)                               |
| `bun run test:db`       | testes de integração/RLS (exigem Supabase local rodando) |
| `bun run test:e2e`      | testes Playwright de jornadas e personas                 |
| `bun run test:coverage` | cobertura da lógica unitária (gate no CI)                |
| `bun run db:reset`      | recria o banco local do zero (migrations + seed)         |
| `bun run db:new <nome>` | cria uma migration nova em `supabase/migrations/`        |
| `bun run db:types`      | regera `src/integrations/supabase/database.types.ts`     |

## Arquitetura em resumo

- Perfis: `matriz`, `master`, `supervisor`, `vendedor`, `franqueado`. A cadeia de
  reporte vive em `profiles.superior_id`; o escopo multinível é resolvido por
  `empresas_visiveis()` e aplicado via RLS — a UI (`canSee`, guards de rota)
  melhora a experiência, mas quem autoriza de fato é o banco.
- Franquia bifurca por modalidade persistida `individual|full` (nunca por
  heurística de nome).
- Fluxos de negócio com regras server-side e testes golden: desconto
  multinível (com escalonamento até a Matriz), motor de comissão (ledger,
  competência, CLT, Elite), renovações (cron), negociação de propostas
  (versões/status), premiações.
- Integração Quiver: `src/lib/quiver.functions.ts` (server) +
  `src/lib/quiver-webhook.ts` (callback autenticado). O payload bruto do
  webhook fica em `cotacoes.quiver_resultado_raw`; o front lê os cards direto
  de lá para exibir o resultado do cálculo.

Detalhes completos: **[docs/DOC_TECNICA_V11.md](docs/DOC_TECNICA_V11.md)**.

## Documentação

Tudo em `docs/` é fonte viva — o estado real do produto deve sempre ser
confirmado pelo código, migrations e testes da `main`, não só pelos docs.

| Documento                                                      | Finalidade                                        |
| -------------------------------------------------------------- | ------------------------------------------------- |
| [`docs/SETUP_DEV.md`](docs/SETUP_DEV.md)                       | preparar o ambiente local passo a passo           |
| [`docs/DOC_TECNICA_V11.md`](docs/DOC_TECNICA_V11.md)           | arquitetura, regras, testes, deploy e banco V11   |
| [`docs/ANALISE_LACUNAS_V11.md`](docs/ANALISE_LACUNAS_V11.md)   | auditoria datada; preservar como histórico        |
| [`docs/PLANO_TASKS_V11.md`](docs/PLANO_TASKS_V11.md)           | plano canônico e evidências por frente            |
| [`docs/GUIA_CLIENTE_V11.md`](docs/GUIA_CLIENTE_V11.md)         | operação do sistema em linguagem não técnica      |
| [`docs/Q4_ROTEIRO_QA_MANUAL.md`](docs/Q4_ROTEIRO_QA_MANUAL.md) | roteiro de aceite manual antes do go-live         |
| [`docs/RUNBOOK_DEPLOY.md`](docs/RUNBOOK_DEPLOY.md)             | operação e deploy da produção self-hosted         |
| [`docs/README.md`](docs/README.md)                             | índice completo, incluindo fontes históricas      |
| [`cotecerto_prototipo_v11.html`](cotecerto_prototipo_v11.html) | referência de UX da V11 r40                       |
| [`AGENTS.md`](AGENTS.md)                                       | regras obrigatórias para qualquer mudança no repo |

## Produção

Servidor único (AWS EC2, atrás de Cloudflare) rodando Supabase self-hosted +
o container do app (imagem GHCR, publicada a cada push na `main`) + nginx/certbot.
CI (`ci` + `db-tests`) roda em todo push/PR. Procedimento completo de deploy,
topologia e troubleshooting em **[docs/RUNBOOK_DEPLOY.md](docs/RUNBOOK_DEPLOY.md)**.

## Contribuindo

Antes de qualquer mudança, leia **[AGENTS.md](AGENTS.md)** — define o fluxo
obrigatório (migration + RLS + teste para mudanças de banco, lint/typecheck/build
antes de commit, revisão do diff) e as regras que agentes e desenvolvedores
devem seguir neste repositório.
