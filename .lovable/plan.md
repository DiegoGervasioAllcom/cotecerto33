
# CoteCerto 3.3 — Base navegável + Auth multi-tenant

Esta entrega cria a estrutura completa do SaaS seguindo 100% o protótipo visual anexado, conectada ao Supabase self-hosted já existente (`https://supabase-cotecerto.sandboxallcom.com`). Telas internas ficam como placeholders, exceto os Dashboards por perfil (que já vêm funcionais).

## 1. Configuração e identidade visual

- Cadastrar as credenciais como secrets do projeto:
  - `VITE_SUPABASE_URL` = `https://supabase-cotecerto.sandboxallcom.com`
  - `VITE_SUPABASE_ANON_KEY` = (chave fornecida)
- Extrair o logo embutido no HTML anexado (`<img class="auth-logo" src="data:image/png;base64,...">`) e publicá-lo como asset CDN (`src/assets/cotecerto-logo.png.asset.json`).
- Replicar o design system exato do protótipo em `src/styles.css`:
  - Cores: `--slate #425563`, `--slate-dark #2F3D48`, `--yellow #FFB600`, `--offwhite #F6F4EE`, `--cream #FCF1D6`, `--ink #1E2A33`, etc.
  - Fontes: **Heebo** (300/400/500/700/900) + **Kalam** (400/700), carregadas via `<link>` no `__root.tsx`.
  - Raios, sombras, scrollbars e tokens semânticos idênticos ao `:root` do protótipo.

## 2. Backend Supabase — SQL inicial (entregue para você rodar)

Será entregue um único arquivo `supabase-migration.sql` com:

- `create type perfil as enum ('matriz','master','vendedor');`
- `create type empresa_tipo as enum ('pj','pf');`
- `create type empresa_status as enum ('pendente','aprovada','recusada','suspensa');`
- Tabelas (todas com RLS habilitada e GRANTs):
  - `empresas` (id, nome, tipo, documento, status, parent_id self-ref p/ Master→Franquia, created_at)
  - `profiles` (id = auth.users.id, empresa_id, nome, email, avatar_url, status)
  - `user_roles` (user_id, role perfil) — **separada do profile** (anti-escalada)
  - `leads` (empresa_id, responsavel_id nullable, origem, dados, status_pipeline, criado_em)
  - `clientes`, `oportunidades`, `pipeline_stages` (compartilhado global), `propostas`
- Função `has_role(uuid, perfil) returns boolean security definer`.
- Função `empresas_visiveis(uuid) returns setof uuid security definer` — devolve, conforme o perfil:
  - matriz → toda rede; master → própria + filhas; vendedor → própria.
- Políticas RLS de SELECT/INSERT/UPDATE usando `has_role` e `empresas_visiveis` para garantir visibilidade por hierarquia.
- Trigger `on auth.users insert` cria `profiles` com `status='pendente'`.
- Função RPC `aprovar_empresa(empresa_id uuid)` restrita à Matriz.

## 3. Estrutura do frontend (TanStack Start)

### Cliente Supabase
- `src/integrations/supabase/client.ts` — cliente browser com `localStorage`, persistência e auto-refresh.
- `src/integrations/supabase/types.ts` — placeholder (você poderá gerar via CLI depois).

### Hooks/Contexto
- `useAuth()` — sessão, `profile`, `role`, `empresa`, `signOut`. Listener único `onAuthStateChange` no root.
- `useEmpresasVisiveis()` — chama RPC e cacheia.

### Roteamento (file-based)
```
src/routes/
  __root.tsx                 ← shell (carrega fontes, providers)
  auth.tsx                   ← Login (público)
  auth.cadastro.tsx          ← Escolha PJ/PF + formulário (público)
  auth.pendente.tsx          ← Tela "aguardando aprovação"
  _authenticated/
    route.tsx                ← Gate (managed); bloqueia se status≠aprovada
    index.tsx                ← redireciona para /inicio
    inicio.tsx               ← Dashboard por perfil (FUNCIONAL)
    venda/
      atender.tsx pipeline.tsx novo-lead.tsx cotacoes.tsx
      propostas.tsx aceite.tsx extrato.tsx mensagens-prontas.tsx
    comando/
      visao-geral.tsx leads.tsx distribuicao.tsx
    operacao/
      franquias.tsx vendedores.tsx supervisao.tsx pipeline-geral.tsx
      vendas.tsx comissoes.tsx (badge "Em formulação")
      premiacoes.tsx estornos.tsx renovacoes.tsx
      relatorios.tsx mensagens.tsx acessos.tsx configuracoes.tsx
```
Todas as rotas internas usam o mesmo `AppShell`; as não-Dashboard renderizam `<PagePlaceholder title="..." />`.

### Componentes
- `AppShell` — grid 240px + 1fr, sidebar fixa slate, header superior (nome usuário, nome empresa, avatar) — pixel-fiel ao protótipo.
- `Sidebar` — grupos **VENDA / COMANDO / OPERAÇÃO** com itens filtrados pelo perfil (Vendedor só VENDA; Master VENDA+COMANDO; Matriz tudo). Item ativo destacado em amarelo.
- `Header` — saudação, nome da empresa, avatar com menu (Sair).
- `RoleGate` — esconde itens/rotas conforme `role`.
- `PagePlaceholder` — card central com título e texto "Em construção".
- `Badge "Em formulação"` no item Comissões.

### Dashboards funcionais (`/inicio`)
- **Vendedor**: cards "Meus leads" / "Meu pipeline" / "Tarefas do dia" com contagens via Supabase (leads filtrados por `responsavel_id = auth.uid()`).
- **Master**: performance dos vendedores vinculados (lista com contagem de leads/oportunidades), leads distribuídos hoje, funil agregado do grupo.
- **Matriz**: KPIs globais (total franquias, vendedores ativos, leads na rede, oportunidades abertas, conversão).
- Tudo via `useSuspenseQuery` + RLS — sem necessidade de filtro manual no frontend.

## 4. Fluxos de autenticação

- **Login**: email/senha. Em sucesso, checa `profiles.status`:
  - `pendente` → `/auth/pendente`
  - `aprovada` → `/inicio`
  - `recusada/suspensa` → mensagem + signOut.
- **Cadastro externo** (`/auth/cadastro`):
  1. Step 1: escolher PJ (CNPJ) ou PF (CPF).
  2. Step 2: form (nome empresa, documento, nome responsável, email, senha).
  3. `signUp` → trigger cria `profiles` pendente + função RPC cria `empresas` vinculada e atribui role `vendedor` por padrão.
  4. Redireciona para `/auth/pendente`.
- **Aprovação Matriz**: na rota `operacao/franquias`, a Matriz vê empresas pendentes e aprova via RPC `aprovar_empresa`. (Lista funcional mínima; detalhes ficam para próxima iteração.)

## 5. Entregáveis desta tarefa

1. `supabase-migration.sql` na raiz do projeto (para você executar no Supabase self-hosted).
2. Secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configurados.
3. Logo extraído como asset CDN.
4. Design system completo em `src/styles.css` espelhando o protótipo.
5. Shell + sidebar + header pixel-fiéis.
6. Auth (login, cadastro PJ/PF, pendente) + gate multi-tenant.
7. Todas as rotas do menu criadas (placeholder), com visibilidade por perfil.
8. Dashboards `/inicio` funcionais por perfil.

## Detalhes técnicos

- Stack atual mantida (TanStack Start + Vite + Tailwind v4 + shadcn).
- RLS é a única camada de autorização (frontend confia no RLS).
- Sem Edge Functions; lógica sensível em `security definer` functions no Postgres.
- Sem `service_role` no cliente — apenas `anon` key. Aprovação roda como Matriz autenticada chamando RPC protegida por `has_role`.
- Tokens semânticos shadcn permanecem mapeados via `@theme inline` aos tokens do protótipo, para que componentes existentes (`Button`, `Card`, etc.) herdem o visual CoteCerto sem hardcode.

## Fora de escopo (próximas iterações)

- Telas internas detalhadas de cotações, propostas, aceite, comissões etc.
- Importação em massa de leads, distribuição automática.
- Integração com seguradoras.
- Notificações em tempo real.
