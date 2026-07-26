# Documentação Técnica — CoteCerto V10

**Atualizado em:** 23/07/2026

## Arquitetura

- Front: React 19, TanStack Start/Router, React Query, Tailwind v4, shadcn/ui e Zod.
- Backend: Supabase/Postgres self-hosted, RLS e RPCs `security definer`.
- Migrations: `supabase/migrations/` é a fonte canônica; há 82 no corte atual.
- Tipos: `src/integrations/supabase/database.types.ts`, gerado pela CLI.
- UX: `cotecerto_prototipo_v10.html` e `src/styles/proto.css`.
- Produção: imagem GHCR atrás de nginx/Cloudflare, integrada ao Supabase existente.

## Hierarquia e escopo

Perfis: `matriz`, `master`, `supervisor`, `vendedor` e `franqueado`.
`profiles.superior_id` forma a cadeia de reporte. `empresas_visiveis()` resolve
o escopo multinível usado pelas policies. Franquia bifurca por modalidade
persistida `individual|full`; heurística por nome não deve ser reintroduzida.

| Experiência         | Escopo                                         |
| ------------------- | ---------------------------------------------- |
| Matriz              | rede completa e configuração global            |
| Master              | operação própria e descendentes                |
| Supervisor          | equipe e franquias diretamente supervisionadas |
| Franquia Full       | grupo próprio e seus vendedores                |
| Franquia Individual | cockpit de venda                               |
| Vendedor            | dados próprios e itens atribuídos              |

`canSee` e guards de rota melhoram UX, mas a autorização real é a RLS.

## Segurança e integridade

- Views novas usam `security_invoker = true`.
- Tabelas novas nascem com RLS, grants mínimos e policies por rede/papel.
- Regras monetárias e de alçada ficam em RPCs, nunca no navegador.
- RPCs privilegiadas definem `search_path` e validam o chamador.
- Textos, faixas, percentuais, documentos e JSONB possuem constraints.
- Formulários espelham constraints em Zod; novos `any` são proibidos.
- `service_role` e segredos Quiver são exclusivos do servidor.

## Fluxo de desconto

1. O solicitante pede desconto na cotação.
2. O servidor determina política e superior imediato.
3. O pedido pode ser aprovado, contraproposto, negado ou escalado.
4. Falta de alçada/política escala até a Matriz.
5. A trilha é persistida; proposta paga/cancelada é protegida.
6. RLS limita inbox e leitura ao nível/rede autorizados.

## Motor de comissão

O domínio inclui regras e campanhas, ledger multinível, competência, progressão
CLT, fator, overrides, royalties, fechamento e bônus Elite. Cálculos e mutações
são server-side e possuem testes golden. A UI exibe resultados e auditoria; não
recalcula valores.

## Renovações, premiações e negociação

- Cron identifica apólices na janela e expira pendências vencidas.
- RPC de renovação cria o novo fluxo preservando `tipo_venda`.
- Premiações são lançadas pela Matriz e lidas conforme a rede.
- Propostas possuem versões, status de negociação e RPCs próprias.

## Integração Quiver

`src/lib/quiver.functions.ts` concentra operações server-side e
`src/lib/quiver-webhook.ts` valida callbacks. URL, client key e secret vêm de
variáveis `SELF_QUIVER_*`. O wizard persiste os campos reais adicionados nas
migrations de 22–23/07. Callback deve ser autenticado e idempotente.

## Fluxo obrigatório de mudança

1. Planejar e obter aprovação para task V10.
2. Implementar na stack responsável.
3. Para banco: migration nova, RLS, teste, `db:reset` e `db:types`.
4. Rodar lint, typecheck, testes proporcionais e build.
5. Revisar o diff contra `AGENTS.md`.
6. Só então versionar e promover para produção.

## Comandos de validação

```bash
bun run db:reset
bun run db:types
bun run lint
bun run typecheck
bun run test:unit
bun run test:db
bun run test:e2e
bun run build
```
