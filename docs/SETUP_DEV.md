# Guia de Instalação — Ambiente de Desenvolvimento CoteCerto

**v1.1 · 23/07/2026** · Validado em macOS. Tempo estimado: ~15 min (primeira vez).

## Pré-requisitos

| Ferramenta     | Para quê                  | Instalação                                  |
| -------------- | ------------------------- | ------------------------------------------- |
| Docker Desktop | roda o Supabase local     | https://docker.com (deixar aberto)          |
| Supabase CLI   | banco local + migrations  | `brew install supabase/tap/supabase`        |
| Bun            | dependências e dev server | `curl -fsSL https://bun.sh/install \| bash` |

## Passo a passo

Tudo é executado na **raiz do projeto** (`~/Documents/cotecerto33`):

```bash
cd ~/Documents/cotecerto33

# 1. Subir o Supabase local (primeira vez baixa as imagens Docker)
supabase start

# 2. Criar o .env com as chaves que o comando acima imprimiu
cp .env.example .env
```

Preencher o `.env` com o mapeamento (a CLI atual chama as chaves de Publishable/Secret):

| Painel do `supabase start`             | Variável no `.env`                        |
| -------------------------------------- | ----------------------------------------- |
| Project URL (`http://127.0.0.1:54321`) | `VITE_SUPABASE_URL` e `SELF_SUPABASE_URL` |
| **Publishable** key                    | `VITE_SUPABASE_ANON_KEY`                  |
| **Secret** key                         | `SELF_SUPABASE_SERVICE_ROLE_KEY`          |

```bash
# 3. Aplicar as 82 migrations atuais + seed num banco limpo
supabase db reset

# 4. Instalar dependências e subir o app
bun install
bun run dev
```

Abrir a URL que o vite imprimir (ex.: `http://localhost:3000`).

## Login de desenvolvimento

- **E-mail:** `desenvolvimento@suppercerto.com.br`
- **Senha:** `Supper@123!`
- Perfil: Matriz (admin). ⚠️ Senha apenas do ambiente local — nunca usar em produção.

## Comandos do dia a dia

| Comando                        | O que faz                                                                |
| ------------------------------ | ------------------------------------------------------------------------ |
| `bun run db:start` / `db:stop` | sobe/para o Supabase local                                               |
| `bun run db:reset`             | recria o banco do zero (migrations + seed) — descartável, use à vontade  |
| `bun run db:new <nome>`        | cria uma migration nova em `supabase/migrations/`                        |
| `bun run db:diff`              | compara o schema com a produção (`$PROD_DB_URL` no ambiente)             |
| `bun run db:push`              | aplica migrations na produção (`$PROD_DB_URL`) — só após passar no local |
| Studio local                   | `http://127.0.0.1:54323` (visualizar tabelas/dados no navegador)         |
| `bun run test:unit`            | testes unitários (rodam offline)                                         |
| `bun run test:db`              | testes de integração (exigem o Supabase local rodando)                   |
| `bun run test:e2e`             | testes Playwright das jornadas e personas                                |
| `bun run test:coverage`        | cobertura da lógica unitária                                             |
| `bun run lint`                 | lint do repositório                                                      |
| `bun run build`                | build de produção                                                        |
| `bun run typecheck`            | checagem de tipos — deve passar antes de qualquer commit                 |

## Notas e soluções de problemas

- **`vite: command not found`** → faltou `bun install`.
- **NOTICEs "does not exist, skipping" no `db reset`** → normais: são os `drop ... if exists` das migrations rodando em banco limpo.
- **Aviso "shared defaults / do not use in production"** → esperado: as chaves locais são padrão da CLI, valem só na sua máquina.
- As migrations históricas (`/migrations`, 000–039) são **read-only**; a fonte canônica é `supabase/migrations/`. O seed vive em `supabase/seed.sql`.
- Regras completas para desenvolvimento: `AGENTS.md` na raiz.
- A contagem muda com o projeto; confirme com
  `find supabase/migrations -name '*.sql' | wc -l`.
