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

# CoteCerto — instruções para agentes

Sistema da Supper para o ciclo do corretor de seguros (lead → cotação → proposta → apólice → comissão). Estamos evoluindo para a **versão V10** (hierarquia da rede, franquia Individual/Full, desconto multinível, motor de comissão).

## Fontes da verdade (ler antes de qualquer task)

| Documento                                                | O que contém                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `docs/ANALISE_LACUNAS_V10.md`                            | O que está pronto, o que falta (GAPs), status por perfil, segurança, integridade, cronograma      |
| `docs/DOC_TECNICA_V10.md`                                | ER atual e alvo, plano de migrations 040–049, fluxo do desconto, arquitetura do front, convenções |
| `docs/MAPA_PROTOTIPO_PERFIS.md`                          | Comportamento exato por perfil: navegação, escopo de dados, campos condicionais, tutoriais        |
| `docs/PLANO_TASKS_V10.md` + `docs/clickup_tasks_v10.csv` | As 78 tasks com dependências e estimativas                                                        |
| Protótipo `cotecerto_prototipo_v10.html`                 | Especificação viva de UX — abrir no navegador; personas de teste no Handoff TI                    |

## Ambientes (decisões de 13/07/2026)

- **Desenvolvimento:** Supabase **local** via CLI (`supabase start`, roda em Docker). Descartável — use `supabase db reset` à vontade. Env vars: copiar `.env.example` → `.env` (nunca commitar o `.env`).
- **Produção:** `https://supabase-cotecerto.sandboxallcom.com` (self-hosted). **O sistema NÃO está em uso** — modo agressivo permitido: sem plano de migração de dados, banco pode ser recriado do zero. Regra única: migration só chega à produção depois de passar no local.
- **Lovable:** ainda conectado (será desconectado manualmente mais tarde). Até lá: não reescrever histórico publicado, manter a `main` sempre funcional, preferir branches + merge para trabalho de agente.

## Stack e comandos

- **Front:** React 19 + TanStack Start/Router (file-based, `src/routes/`), Tailwind v4 + shadcn/ui, react-query, zod. Gerenciador: **bun**.
- **Backend:** Supabase self-hosted (`src/integrations/supabase/client.ts`). Migrations SQL em `/migrations` (000–039 já aplicadas).
- Comandos: `bun install` · `bun run dev` · `bun run build`. (Testes: Vitest/Playwright serão adicionados na pré-obra — ver lista T.)

## Regras não negociáveis

1. **Nunca editar migrations antigas.** A fonte canônica é `supabase/migrations/` (Supabase CLI); migration nova = `bun run db:new <nome>`, com RLS + teste. A pasta `/migrations` (000–039) é arquivo histórico read-only. Seed em `supabase/seed.sql`.
2. **Regra de dinheiro/alçada roda no servidor** (RPC `security definer` com `set search_path`), nunca no front. O front exibe; a RLS decide.
3. **Toda tabela nova nasce com:** RLS habilitada, policies escopadas por `empresas_visiveis()`/`has_role()`, checks de tamanho (`char_length`) e faixa (`valor > 0`, percentuais 0–100).
4. **Views novas: `security_invoker = true`** — views sem isso ignoram RLS (vulnerabilidade S1 conhecida).
5. **Formulários usam zod** espelhando as constraints do banco; sem `any` novos. Tipos do banco são gerados: após criar/aplicar migration, rodar `bun run db:reset && bun run db:types` e commitar o `src/integrations/supabase/database.types.ts` junto (arquivo gerado — nunca editar à mão). `bun run typecheck` deve passar antes de qualquer commit.
6. **Visual: usar as classes existentes de `src/styles/proto.css`** (é o CSS do protótipo, byte a byte). Não criar estilos paralelos nem alterar esse arquivo.
7. **Perfis:** `matriz`, `master`, `supervisor` (a criar), `vendedor`, `franqueado` — franquia bifurca Individual (cockpit de vendedor) vs Full (área de grupo). Gate visual em `app-shell.tsx` (`canSee`) **não é segurança** — a policy é.
8. **Não commitar segredos.** Chaves e URLs vêm de env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SELF_SUPABASE_SERVICE_ROLE_KEY` — esta só em server functions).
9. Arquivos grandes (`novo-lead.tsx`, `acessos.tsx`, `configuracoes.tsx`): ao mexer, extrair componentes/hooks em vez de crescer o arquivo.
10. `src/data/proto-pages.json` e `ProtoPage` são resíduo do protótipo — não usar em telas novas; serão removidos (task G5.4).

## Equipe de agentes e fluxo de trabalho

Agentes em `.claude/agents/` e skills em `.claude/skills/`. **Fluxo obrigatório para qualquer task do plano:**

1. **`planejador`** produz o plano, apresenta ao usuário e **aguarda aprovação explícita antes de qualquer implementação**.
2. Após a aprovação, o especialista da stack implementa usando a skill aplicável: **`banco`** (SQL/RLS/RPC, skill `nova-migration`), **`front`** (telas, skill `nova-tela`), **`infra`** (Docker/CI/deploy) ou **`testes`** (suítes, skill `teste-rls` quando houver RLS).
3. **`testes`** cria ou ajusta os testes necessários e executa as validações proporcionais à mudança.
4. **`revisor`** audita o diff e precisa aprová-lo. Se reprovar, o trabalho volta ao especialista para correção, passa novamente pelos testes e retorna ao `revisor`.
5. **Nenhum commit, push ou Pull Request pode ser criado antes da aprovação do `revisor`.**

Economia de token (vale para todos): Grep/Glob antes de Read; protótipo (655 KB) só via grep recortado; arquivos grandes lidos por trecho; não reimprimir arquivos inteiros nas respostas.

## Definition of Done

- Task de banco: migration versionada + RLS + teste + aplicada em staging.
- Task de front: tela igual ao protótipo V10 + zod + sem `any` + teste do comportamento por perfil quando aplicável.
