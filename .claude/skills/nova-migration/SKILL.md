---
name: nova-migration
description: Criar uma migration nova no CoteCerto seguindo o padrão do projeto (numeração, RLS, checks, grants, teste). Use sempre que uma task exigir mudança de schema, policy, RPC ou trigger no Supabase.
---

# Nova migration — padrão CoteCerto

## Passos

1. **Número:** próximo da sequência em `/migrations` (`ls migrations | tail -1`). Formato: `NNN_nome_curto.sql`. NUNCA editar 000–039.
2. **Cabeçalho:** comentário com o que a migration faz e a task do plano (ex.: `-- 042 — hierarquia: enum supervisor + superior_id (task G1.1)`).
3. **Idempotência:** `create table if not exists`, `drop policy if exists` antes de `create policy`, enums via `do $$ ... exception when duplicate_object then null; end $$;`.
4. **Toda tabela nova inclui, nesta ordem:**
   - colunas com checks: `check (char_length(col) <= N)` em text; `check (valor > 0)` em dinheiro; `check (pct between 0 and 100)` em percentual
   - `grant` mínimo necessário (select para authenticated; escrita preferencialmente via RPC)
   - `alter table ... enable row level security`
   - policies escopadas por `public.empresas_visiveis(auth.uid())` e/ou `public.has_role(auth.uid(), 'perfil')` — NUNCA `using (true)` em tabela de negócio
   - índices para as FKs consultadas
5. **Views:** `create or replace view ... with (security_invoker = true)`.
6. **Functions:** `security definer` sempre com `set search_path = public`; validação de regra de negócio DENTRO da function.
7. **Testar local:** `supabase db reset` (aplica tudo do zero) → rodar o teste de RLS correspondente (skill `teste-rls`).
8. **Registrar:** se a migration corresponder à tabela de `docs/DOC_TECNICA_V10.md` §3, confirmar aderência; se divergir do planejado, atualizar o doc.

## Referências rápidas de padrão no código existente

- Policy escopada: `migrations/001_init.sql` (bloco leads/clientes/oportunidades/propostas)
- RPC com validação: `migrations/004_cadastrar_franquia_admin.sql`
- Trigger + security definer: `migrations/038_conta_corrente_comissoes.sql`
- Cron: `migrations/030_sla_expiracao_servidor.sql`
