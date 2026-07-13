---
name: nova-tela
description: Construir ou alterar uma tela do CoteCerto a partir do protótipo V10 (extração por grep, classes do proto.css, escopo por perfil, zod). Use para qualquer task de front que crie página/rota ou mude UI existente.
---

# Nova tela — padrão CoteCerto

## Passos

1. **Extrair a referência do protótipo (nunca ler o arquivo inteiro — 655 KB):**
   ```bash
   grep -o 'id="page-CHAVE".\{0,3000\}' cotecerto_prototipo_v10.html   # markup
   awk '/function render_CHAVE/,/^function [a-z]/' cotecerto_prototipo_v10.html | head -200  # lógica
   ```
   Chaves das telas: ver `docs/MAPA_PROTOTIPO_PERFIS.md` §3 (home, maprov, xdash, mconf...).
2. **Escopo por perfil:** consultar o MAPA §3–5 — quem vê a tela, com que dados (`activeGroup`), que % (`groupPct`), que campos condicionais.
3. **Rota:** arquivo em `src/routes/_authenticated/<grupo>/nome.tsx` (file-based). Gate de menu em `app-shell.tsx` (`canSee`) — lembrando: RLS é a segurança, o menu só reflete.
4. **Visual:** somente classes de `src/styles/proto.css` (grep pela classe para confirmar que existe). Sem CSS novo, sem Tailwind solto onde o protótipo tem classe própria.
5. **Dados:** react-query + tipos gerados do Supabase (sem `any`). Mutações que envolvem dinheiro/alçada chamam RPC.
6. **Formulários:** react-hook-form + zod espelhando as constraints do banco; `maxLength` nos inputs; mensagens de erro em português.
7. **Arquivo > 300 linhas?** Extraia componentes/hooks para `src/components/` — nunca crescer os gigantes (novo-lead, acessos, configuracoes).
8. **Fechar:** teste do comportamento por perfil (skill `teste-rls` p/ dados; E2E se for fluxo) + conferência visual contra o protótipo aberto no navegador.
