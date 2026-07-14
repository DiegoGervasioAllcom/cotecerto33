# Documentação do CoteCerto 3.3 — Implementado × Pendente

## Objetivo

Entregar um único documento navegável (DOCX + resumo em Markdown) que sirva como onboarding para quem entra no projeto agora, cobrindo:

- O que já está no ar
- Como cada peça foi construída (arquivos, migrations, RPCs, integrações)
- O que ainda falta em relação ao protótipo e às diretrizes já discutidas

## Fontes que vou usar como "verdade"

1. **Protótipo visual** original (referenciado em `src/styles/proto.css`, `src/components/proto-page.tsx`, `proto-icons.tsx`) — base de todas as telas.
2. **Migrations 001 → 039** em `migrations/` — spec real do banco.
3. **Rotas** em `src/routes/**` — spec real das telas.
4. **Histórico de decisões do chat** (o que o usuário pediu e foi/aceito ou adiado).
5. `AGENTS.md` e `.lovable/plan.md` se contiverem diretrizes vigentes.

> Observação: não foram anexados a este projeto os PDFs/documentos originais de escopo. Vou trabalhar com as fontes acima, que representam o estado atual acordado. Se você tiver um documento-mestre de requisitos, me envie e eu incorporo antes de finalizar.

## Estrutura do documento (DOCX)

1. **Visão geral e stack** — TanStack Start, Supabase self-hosted, papéis (matriz/master/vendedor), URL/anon key, seed admin.
2. **Arquitetura**
   - Rotas públicas × `_authenticated/` (SPA, `ssr: false`)
   - `AuthProvider` + presença (`use-presence.ts`) + auditoria de login
   - Padrão de servidor: RPCs security definer + triggers + `pg_cron`
3. **Modelo de dados por domínio** (com tabela migration → tabelas/RPCs/triggers criados)
   - Base & auth: 001, 003–006, 025–026, 035, 039
   - Personalização & catálogo: 005, 010, 034, 036
   - Cotação: 007–011
   - Pipeline & leads: 013, 015–022, 033
   - Distribuição & SLA: 023–024, 027–031, 032 (presença)
   - Perda: 012, 014, 033
   - Propostas & financeiro: 037, 038
4. **Telas implementadas** — uma seção por tela com:
   - Rota (arquivo)
   - Origem visual (protótipo)
   - Fontes de dados (tabelas/RPCs)
   - Ações disponíveis
   - Regras de permissão
5. **Integrações externas** — ViaCEP, FIPE, placeholder de cálculo de seguradoras, impressão (`src/lib/print.ts`), export PDF/CSV.
6. **Segurança & auditoria** — RLS por papel, `has_role`, `login_audit`, presença, `_authenticated` gate.
7. **O que falta / próximos passos** (comparando protótipo × código atual):
   - Tela de visualização de `login_audit` para matriz (tabela existe, UI não)
   - API real de cálculo das seguradoras (hoje simulado)
   - Renovações: automação de aviso ao vendedor
   - Premiações: apenas placeholder, sem regras no banco
   - Relatórios: consolidar exportações além do PDF da Visão Geral
   - Integrações (aba em Configurações) — modelo criado, UIs de conexão pendentes
   - Mensagens: envio real (WhatsApp/e-mail) — hoje apenas biblioteca de templates
   - Testes automatizados (nenhum hoje)
   - Documentação de operação do `pg_cron` (SLA/expiração)
8. **Anexos**
   - Índice de migrations com uma linha por arquivo
   - Índice de rotas
   - Glossário (matriz, master, vendedor, SLA, triagem, remalho, etc.)

## Entrega

- `/mnt/documents/cotecerto-3.3-documentacao.docx` — documento principal, gerado com `docx-js` seguindo a skill DOCX (US Letter, Arial, tabelas com DXA, sem bullets unicode).
- `/mnt/documents/cotecerto-3.3-resumo.md` — versão curta em Markdown para leitura rápida.
- Ambos expostos via `<presentation-artifact>` no fim da execução.

## Detalhes técnicos

- Vou ler em paralelo: todas as migrations, todos os arquivos em `src/routes/**`, `src/lib/*.ts(x)`, `src/components/app-shell.tsx`, `AGENTS.md`, `.lovable/plan.md`.
- Não vou alterar nenhum arquivo do app — a entrega é só documental (arquivos em `/mnt/documents`).
- Após gerar o DOCX, converto para PDF/imagens e inspeciono página a página (QA obrigatório da skill) antes de entregar.
- Se algo estiver ambíguo entre protótipo e código, marco como "**Divergência a decidir**" no documento em vez de assumir.

## Fora do escopo deste plano

- Implementar qualquer item listado em "O que falta" — este plano é apenas a documentação. Depois de aprovado o documento, abrimos planos separados por pendência priorizada.
