# Auditoria — botão "mostrar/ocultar senha" em todos os campos de senha · 11/08/2026

Levantamento de todos os campos `type="password"` do app, comparando com o padrão do protótipo
(`.pw-toggle` + ícone `#i-eye`, usado em `loginPw`, `ns1`/`ns2` de criar-senha, e `dg_pw`/`dp_pw`/
`dc_pw` das confirmações de diretor).

## Campos encontrados

| Campo | Onde | Tinha o botão? |
| --- | --- | --- |
| Senha (login) | `src/routes/auth.index.tsx` | ❌ |
| Nova senha / Confirmar senha | `src/routes/auth.criar-senha.tsx` | ✅ (já existia) |
| Senha de acesso (cadastro por Convite) | `src/components/auth/campos-cadastro.tsx` (via `convite.$token.tsx`) | ❌ |
| Senha de login (confirmação de diretor) | `src/components/acessos/senha-diretor-modal.tsx` | ❌ |
| Senha (mín. 6) — criar usuário | `src/components/operacao/configuracoes/create-user-modal.tsx` | ❌ |

4 de 5 campos não tinham o botão — só a tela de criar senha (link do e-mail Boas-vindas) já
seguia o padrão do protótipo.

## Correção

Adicionado o mesmo padrão (`button.pw-toggle` + `#i-eye`/"OCULTAR", alternando `type` entre
`password`/`text`) nos 4 campos que faltavam:

- `src/routes/auth.index.tsx` — campo Senha do login.
- `src/components/auth/campos-cadastro.tsx` — campo de senha do formulário de cadastro
  (compartilhado pela tela de Convite Supper). Como o componente é genérico por `FieldDef`,
  o estado de visibilidade agora é por `key` do campo (`Record<string, boolean>`), não um único
  booleano — o formulário só tem um campo de senha hoje, mas o componente já fica correto se um
  dia tiver mais de um.
- `src/components/acessos/senha-diretor-modal.tsx` — confirmação de diretor.
- `src/components/operacao/configuracoes/create-user-modal.tsx` — criação manual de usuário.

`auth.index.tsx` e `convite.$token.tsx` são rotas públicas (fora de `_authenticated`) e não
carregavam o sprite de ícones (`<ProtoIcons />`) — sem ele, o `<use href="#i-eye">` não resolvia
e o ícone do olho não aparecia (esse mesmo problema silencioso já existia em
`auth.criar-senha.tsx`, sem ter sido notado antes). Adicionei `<ProtoIcons />` nas duas rotas.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 353/353.
- `playwright test tests/e2e/personas.spec.ts`: 7/7.
- Verificação visual: login (campo Senha) e cadastro por Convite Supper (campo Senha de acesso)
  — clicar no ícone de olho revela o texto digitado e o botão muda para "OCULTAR"; clicar de novo
  volta a mascarar.
